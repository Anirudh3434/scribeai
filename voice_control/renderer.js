// DOM Elements
const btnClose = document.getElementById('btn-close');
const btnMic = document.getElementById('btn-mic');
const glowRing = document.getElementById('glow-ring');
const statusText = document.getElementById('status-text');
const transcriptText = document.getElementById('transcript-text');
const liveIndicator = document.getElementById('live-indicator');
const logContainer = document.getElementById('log-container');

// Settings Elements
const logoText = document.querySelector('.logo-text');
const settingsDrawer = document.getElementById('settings-drawer');
const btnSettingsClose = document.getElementById('btn-settings-close');
const btnSettingsSave = document.getElementById('btn-settings-save');
const ollamaUrlInput = document.getElementById('ollama-url');
const ollamaModelInput = document.getElementById('ollama-model');
const wakeWordActiveInput = document.getElementById('wake-word-active');

// Waveform Visualizer Element
const canvas = document.getElementById('waveform-canvas');
let audioContext, analyser, dataArray, source;
let animationFrameId;
let phase = 0;

// Eye Control Elements
const btnEyeControl = document.getElementById('btn-eye-control');
const eyeBtnText = document.getElementById('eye-btn-text');
const webcamContainer = document.getElementById('webcam-preview-container');
const videoElement = document.getElementById('webcam');
const meshCanvas = document.getElementById('mesh-canvas');
const blinkIndicator = document.getElementById('blink-indicator');

// Load configurations
let ollamaUrl = localStorage.getItem('macvoice_ollama_url') || 'http://localhost:11434';
let ollamaModel = localStorage.getItem('macvoice_ollama_model') || 'gemma2:2b';
let wakeWordModeActive = localStorage.getItem('macvoice_wake_word_active') !== 'false'; // defaults to true

ollamaUrlInput.value = ollamaUrl;
ollamaModelInput.value = ollamaModel;
wakeWordActiveInput.checked = wakeWordModeActive;

// IPC fallback to local HTTP server when running in standard browser (like Google Chrome)
const isElectron = typeof window.electronAPI !== 'undefined';
const urlParams = new URLSearchParams(window.location.search);
const isBackgroundDaemon = urlParams.get('mode') === 'background';

const sysAPI = {
  closeApp: () => {
    if (isElectron) {
      window.electronAPI.closeApp();
    } else {
      statusText.textContent = "Close window manually in browser.";
    }
  },
  runAppleScript: async (script) => {
    if (isElectron) {
      return await window.electronAPI.runAppleScript(script);
    } else {
      try {
        const res = await fetch('/run-applescript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: "Local server not running. Start it with 'npm run server'" };
      }
    }
  },
  runShell: async (command) => {
    if (isElectron) {
      return await window.electronAPI.runShell(command);
    } else {
      try {
        const res = await fetch('/run-shell', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: "Local server not running. Start it with 'npm run server'" };
      }
    }
  },
  wakeUp: async () => {
    if (isElectron) {
      if (typeof window.electronAPI.wakeUp === 'function') {
        return await window.electronAPI.wakeUp();
      }
      return { success: false };
    } else {
      try {
        const res = await fetch('/wake-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: "Local server not running." };
      }
    }
  }
};

// Speech Recognition Variables
let recognition;
let isListening = false;
let isThinking = false;
let recognitionRestartTimeout = null;
let temporaryDirectCommandMode = false; // Flag to allow a direct command after wake word triggers

// Safe wrapper to start speech recognition (prevents errors in Electron)
function startSpeechRecognition() {
  if (isElectron) {
    console.log("Speech recognition is handled by Chrome background daemon.");
    return;
  }
  if (!recognition) return;
  try {
    recognition.start();
  } catch (e) {
    console.error("Failed to start speech recognition:", e);
  }
}

// Initialize Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  statusText.textContent = "Error: Speech Recognition API not supported in this environment.";
  btnMic.disabled = true;
} else {
  recognition = new SpeechRecognition();
  recognition.continuous = true; // Stay on for continuous wake-word listening
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  // Speech Events
  recognition.onstart = () => {
    isListening = true;
    glowRing.classList.add('listening');
    if (wakeWordModeActive && !temporaryDirectCommandMode) {
      statusText.textContent = "Say 'Hi Buddy' or 'Hi Buddy [command]'";
    } else {
      statusText.textContent = "Listening... Speak command now.";
    }
    liveIndicator.classList.add('active');
  };

  recognition.onresult = (event) => {
    if (isThinking) return;

    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const transcript = (finalTranscript || interimTranscript).trim();
    if (transcript && transcript !== '...') {
      transcriptText.textContent = transcript;
    }

    const isWakeWordChecking = wakeWordModeActive && !temporaryDirectCommandMode;
    if (isWakeWordChecking) {
      const lowerText = transcript.toLowerCase();
      // Listen to multiple variations of "hi buddy" to increase trigger accuracy
      const wakeWords = ["hi buddy", "hey buddy", "high buddy", "bye buddy", "hello buddy"];
      
      let matchedWakeWord = null;
      for (const ww of wakeWords) {
        if (lowerText.includes(ww)) {
          matchedWakeWord = ww;
          break;
        }
      }
      
      if (matchedWakeWord) {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          console.log("Wake word detected:", matchedWakeWord);
          recognition.stop();
          
          // Bring Google Chrome/Electron to the front/foreground (like Siri)
          sysAPI.wakeUp();
          
          // Extract and clean the command text following the wake word
          const index = lowerText.indexOf(matchedWakeWord);
          let commandText = transcript.substring(index + matchedWakeWord.length).trim();
          commandText = commandText.replace(/^[,.?!:;\s]+/, '').trim(); // Strip leading punctuation
          
          if (commandText.length > 1) {
            // Wake word + command in same breath (e.g. "Hey Buddy open Teams")
            processVoiceCommand(commandText);
          } else {
            // Wake word only - trigger chime and wait for command on next turn
            playBeep(600, 0.08);
            setTimeout(() => playBeep(800, 0.08), 80);
            
            temporaryDirectCommandMode = true;
            statusText.textContent = "Listening... Speak command now.";
          }
        }
      }
    } else {
      // Direct command execution mode (manual, or temporary following wake word)
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal && transcript.length > 1) {
        recognition.stop();
        temporaryDirectCommandMode = false; // reset flag
        processVoiceCommand(transcript);
      }
    }
  };

  recognition.onend = () => {
    isListening = false;
    glowRing.classList.remove('listening');
    liveIndicator.classList.remove('active');
    
    // Clear temporary mode if it times out
    if (temporaryDirectCommandMode) {
      temporaryDirectCommandMode = false;
    }
    
    // Auto-restart recognition in both modes if not currently querying Ollama and not speaking
    const currentlySpeaking = window.speechSynthesis && window.speechSynthesis.speaking;
    if (!isThinking && !currentlySpeaking) {
      clearTimeout(recognitionRestartTimeout);
      recognitionRestartTimeout = setTimeout(() => {
        if (!isListening && !isThinking && !(window.speechSynthesis && window.speechSynthesis.speaking)) {
          try {
            startSpeechRecognition();
          } catch (e) {
            console.error("Failed to auto-restart recognition:", e);
          }
        }
      }, 400); // Small cooldown
    } else if (!isThinking && !currentlySpeaking) {
      statusText.textContent = "Click Mic or Press Space to Command";
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'no-speech') {
      // Ignore no-speech errors in continuous mode, they are common and harmless
      return;
    }
    statusText.textContent = `Error: ${event.error}`;
    isListening = false;
    glowRing.classList.remove('listening');
    liveIndicator.classList.remove('active');
  };
}

// Mic Button Click Handler
btnMic.addEventListener('click', toggleListening);

function toggleListening() {
  if (isElectron) {
    statusText.textContent = "Voice input managed by Chrome (http://localhost:5566)";
    playBeep(350, 0.15);
    return;
  }
  if (!recognition) return;
  if (isListening) {
    // Turning off wake word mode temporarily if manually clicked off
    recognition.stop();
    statusText.textContent = "Stopped listening.";
  } else {
    // If they manually turn it on, start it
    startSpeechRecognition();
  }
}

// Space Bar Global listener
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    toggleListening();
  } else if (e.key === 'Escape') {
    if (!settingsDrawer.classList.contains('hidden')) {
      toggleSettings();
    } else {
      sysAPI.closeApp();
    }
  }
});

// Close button click
btnClose.addEventListener('click', () => {
  sysAPI.closeApp();
});

// Settings Drawer Toggle
logoText.addEventListener('dblclick', toggleSettings);
btnSettingsClose.addEventListener('click', toggleSettings);

function toggleSettings() {
  settingsDrawer.classList.toggle('hidden');
}

btnSettingsSave.addEventListener('click', () => {
  ollamaUrl = ollamaUrlInput.value.trim() || 'http://localhost:11434';
  ollamaModel = ollamaModelInput.value.trim() || 'gemma2:2b';
  wakeWordModeActive = wakeWordActiveInput.checked;
  
  localStorage.setItem('macvoice_ollama_url', ollamaUrl);
  localStorage.setItem('macvoice_ollama_model', ollamaModel);
  localStorage.setItem('macvoice_wake_word_active', wakeWordModeActive);
  
  // Update recognition behavior
  if (recognition) {
    recognition.stop();
  }
  
  toggleSettings();
  statusText.textContent = "Settings saved!";
  setTimeout(() => {
    if (wakeWordModeActive) {
      statusText.textContent = "Say 'Hi Buddy' or 'Hi Buddy [command]'";
      if (!isListening) startSpeechRecognition();
    } else {
      statusText.textContent = "Click Mic or Press Space to Command";
    }
  }, 1500);
});

// Play a premium retro robotic sound beep using the Web Audio API
function playBeep(frequency = 600, duration = 0.08, type = 'sine') {
  if (isBackgroundDaemon) return;
  try {
    const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    // Low, premium volume level
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error("Failed to play beep sound:", e);
  }
}

// Core AI Action Translation
async function processVoiceCommand(transcript) {
  isThinking = true;
  glowRing.classList.add('thinking');
  statusText.textContent = "Analyzing command...";

  // Play a prompt beep signifying recognition has begun
  playBeep(800, 0.07);

  // Clear log placeholder if it's there
  const placeholder = logContainer.querySelector('.log-placeholder');
  if (placeholder) placeholder.remove();

  // Create Translating Log Entry
  const logItem = document.createElement('div');
  logItem.className = 'log-item';
  logItem.innerHTML = `
    <div class="log-title-row">
      <span class="log-title">"${transcript}"</span>
      <span class="log-status translating">Translating...</span>
    </div>
  `;
  logContainer.insertBefore(logItem, logContainer.firstChild);

  const systemPrompt = `You are a macOS Voice Agent and Conversational Assistant. Translate the voice input into a single JSON object.
Output ONLY JSON. Do NOT output markdown code blocks, thoughts, explanations, or conversational text.

Options:
1. {"type": "applescript", "command": "<AppleScript code>", "response": "<Natural robotic verbal response to speak to user>"}
   Use for system UI actions like opening/closing apps, keystrokes, UI buttons, system volume, sleep, etc.
   Examples:
   - "open slack" -> {"type": "applescript", "command": "tell application \\"Slack\\" to activate", "response": "Opening Slack"}
   - "mute volume" -> {"type": "applescript", "command": "set volume with output muted", "response": "Muting system volume"}
   - "turn up volume" -> {"type": "applescript", "command": "set volume output volume ((output volume of (get volume settings)) + 15)", "response": "Increasing volume"}
   - "turn down volume" -> {"type": "applescript", "command": "set volume output volume ((output volume of (get volume settings)) - 15)", "response": "Decreasing volume"}
   - "type hello everyone" -> {"type": "applescript", "command": "tell application \\"System Events\\" to keystroke \\"hello everyone\\"", "response": "Typing message"}
   - "press enter" -> {"type": "applescript", "command": "tell application \\"System Events\\" to key code 36", "response": "Pressing Enter"}

2. {"type": "shell", "command": "<Zsh command>", "response": "<Natural robotic verbal response to speak to user>"}
   Use for filesystem commands, shell tools, or opening browser URLs.
   Examples:
   - "what is the date" -> {"type": "shell", "command": "date '+%I:%M %p'", "response": "Checking the date"}
   - "open youtube in browser" -> {"type": "shell", "command": "open \\"https://www.youtube.com\\"", "response": "Opening YouTube"}
   - "open safari" -> {"type": "shell", "command": "open -a \\"Safari\\"", "response": "Opening Safari"}

CRITICAL RULES FOR SHELL COMMANDS:
* To open a macOS application, you MUST use the "-a" flag: e.g. open -a "Safari" or open -a "Google Chrome". Never output open "AppName" directly without "-a", as this will fail.

3. {"type": "speak", "response": "<Detailed response answering the question or greeting the user>"}
   Use for general questions, facts, logic, coding help, greetings, chit-chat, or general advice that are NOT macOS commands. Do not write a command for this type.
   Examples:
   - "hello" -> {"type": "speak", "response": "Hello! I am functioning at maximum capacity. How can I assist you?"}
   - "who is the president" -> {"type": "speak", "response": "The current President of the United States is Joe Biden."}
   - "what is the capital of France" -> {"type": "speak", "response": "The capital of France is Paris."}
   - "why is the sky blue" -> {"type": "speak", "response": "The sky is blue because Earth's atmosphere scatters shorter wavelengths of light, like blue, in all directions."}

4. {"type": "unsupported", "command": "<Friendly reason error message>", "response": "<Friendly spoken explanation of why this action cannot be performed>"}
   Use ONLY if a command is requested that is extremely unsafe, destructive (like deleting system directories), or entirely unintelligible.

CRITICAL: Return ONLY valid raw JSON. Absolutely no markdown fences like \`\`\``;

  const url = `${ollamaUrl}/v1/chat/completions`;
  const payload = {
    model: ollamaModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Voice command: "${transcript}"` }
    ],
    temperature: 0.1
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Ollama Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content;
    if (!resultText) {
      throw new Error("Received an empty response from Ollama.");
    }

    console.log("Raw Ollama response:", resultText);
    const action = parseActionJson(resultText);

    // If running as background microphone daemon, forward action to Electron via server and skip local execution
    if (isBackgroundDaemon) {
      try {
        await fetch('/execute-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, transcript })
        });
        finishProcessing("Forwarded action.");
      } catch (e) {
        console.error("Failed to forward action:", e);
        finishProcessing("Connection failed.");
      }
      return;
    }

    // Update log item with translated script
    const statusBadge = logItem.querySelector('.log-status');
    
    if (action.type === 'unsupported') {
      statusBadge.className = 'log-status error';
      statusBadge.textContent = 'Unsupported';
      logItem.innerHTML += `<div class="log-cmd" style="color: #f87171;">Reason: ${action.command}</div>`;
      playBeep(350, 0.15);
      finishProcessing("Command not supported.");
      speakText(action.response || `Unsupported command. Reason: ${action.command}`);
      return;
    }

    // Handle general questions, chit-chat, and conversational greetings
    if (action.type === 'speak' || action.type === 'answer') {
      statusBadge.className = 'log-status success';
      statusBadge.textContent = 'Success';
      
      const answerDiv = document.createElement('div');
      answerDiv.className = 'log-cmd';
      answerDiv.style.color = '#a78bfa'; // Futuristic light purple/indigo accent
      answerDiv.textContent = action.response;
      logItem.appendChild(answerDiv);
      
      playBeep(600, 0.05);
      setTimeout(() => playBeep(800, 0.05), 60);

      finishProcessing(`Answered: ${transcript}`);
      speakText(action.response);
      return;
    }

    // Speak natural response phrase immediately before running macOS commands
    if (action.response) {
      speakText(action.response);
    }

    statusBadge.className = 'log-status translating';
    statusBadge.textContent = 'Executing...';
    
    // Display command being run
    const cmdDiv = document.createElement('div');
    cmdDiv.className = 'log-cmd';
    cmdDiv.textContent = `[${action.type.toUpperCase()}] ${action.command}`;
    logItem.appendChild(cmdDiv);

    // Run Command via IPC / API
    let execResult;
    if (action.type === 'applescript') {
      execResult = await sysAPI.runAppleScript(action.command);
    } else if (action.type === 'shell') {
      execResult = await sysAPI.runShell(action.command);
    }

    if (execResult.success) {
      statusBadge.className = 'log-status success';
      statusBadge.textContent = 'Success';
      
      // Play a satisfying double beep on successful execution
      playBeep(600, 0.05);
      setTimeout(() => playBeep(800, 0.05), 60);

      finishProcessing(`Executed: ${transcript}`);
      
      // If there is CLI stdout (e.g. date, time, calculations), speak that output after a slight delay
      if (execResult.output) {
        console.log("Execution output:", execResult.output);
        setTimeout(() => {
          speakText(execResult.output);
        }, 800);
      }
    } else {
      statusBadge.className = 'log-status error';
      statusBadge.textContent = 'Failed';
      logItem.innerHTML += `<div style="color: #f87171; font-size: 10px; margin-top: 3px; font-family: monospace;">Error: ${execResult.error}</div>`;
      
      playBeep(350, 0.15);
      finishProcessing("Execution failed.");
      speakText(`Failed to execute command.`);
    }

  } catch (error) {
    console.error("Command processing error:", error);
    const statusBadge = logItem.querySelector('.log-status');
    statusBadge.className = 'log-status error';
    statusBadge.textContent = 'Error';
    logItem.innerHTML += `<div style="color: #f87171; font-size: 10px; margin-top: 3px; font-family: monospace;">Connection Error: ${error.message}</div>`;
    
    playBeep(250, 0.2);
    finishProcessing("Error calling Ollama. Is it running?");
    speakText(`Error communicating with Ollama.`);
  }
}

function finishProcessing(message) {
  glowRing.classList.remove('thinking');
  statusText.textContent = message;
  isThinking = false;
  
  // Only restart if not currently speaking. If speaking, speakText's onend will trigger restart.
  const currentlySpeaking = window.speechSynthesis && window.speechSynthesis.speaking;
  if (!currentlySpeaking) {
    setTimeout(() => {
      if (wakeWordModeActive) {
        statusText.textContent = "Say 'Hi Buddy' or 'Hi Buddy [command]'";
        if (!isListening) {
          try {
            startSpeechRecognition();
          } catch (e) {}
        }
      } else {
        statusText.textContent = "Click Mic or Press Space to Command";
      }
    }, 2500);
  }
}

// Speak response text via Speech Synthesis with robotic effect and auto-listening safety
let voices = [];
if ('speechSynthesis' in window) {
  voices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    voices = window.speechSynthesis.getVoices();
  };
}

function speakText(text) {
  if (isBackgroundDaemon) return;
  if ('speechSynthesis' in window) {
    // Stop recognition if active to prevent self-recognition/echo feedback
    if (isListening && recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }

    // Cancel any current speaking to instantly respond to new events
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find a premium high-quality voice for crystal-clear sound output
    const premiumVoiceNames = [
      'google us english',
      'alex',
      'samantha',
      'daniel',
      'google uk english male',
      'google'
    ];
    let selectedVoice = null;
    
    if (voices && voices.length > 0) {
      for (const name of premiumVoiceNames) {
        selectedVoice = voices.find(v => v.name.toLowerCase().includes(name));
        if (selectedVoice) break;
      }
      // If no premium voice, fallback to a standard English voice
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en'));
      }
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log("Using premium human-like voice:", selectedVoice.name);
    }
    
    // Set parameters to standard natural human values (natural speed, natural pitch)
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Resume listening after speaking is done
    const resumeListening = () => {
      setTimeout(() => {
        // Only resume if thinking is finished, we aren't listening, and TTS is completely done
        const currentlySpeaking = window.speechSynthesis && window.speechSynthesis.speaking;
        if (wakeWordModeActive && !isThinking && !isListening && !currentlySpeaking) {
          statusText.textContent = "Say 'Hi Buddy' or 'Hi Buddy [command]'";
          try {
            startSpeechRecognition();
          } catch (e) {}
        } else if (!wakeWordModeActive && !isThinking && !isListening && !currentlySpeaking) {
          statusText.textContent = "Click Mic or Press Space to Command";
        }
      }, 600); // 600ms buffer after speech finishes
    };
    
    utterance.onend = resumeListening;
    utterance.onerror = resumeListening;
    
    window.speechSynthesis.speak(utterance);
  }
}

// JSON Parser utility
function parseActionJson(text) {
  let cleaned = text.trim();
  
  // Strip backticks if present
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines[lines.length - 1] === '```') lines.pop();
    cleaned = lines.join('\n').trim();
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (err) {}
    }
    throw new Error("Invalid action JSON structure: " + text);
  }
}

// Audio visualizer setup
async function startAudioVisualizer() {
  if (audioContext) return; // Already initialized
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Web Audio API setup
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    drawWaveform();
  } catch (err) {
    console.error("Visualizer audio setup failed:", err);
    // Draw empty standby line if mic is blocked or fails
    drawEmptyLine();
  }
}

function drawWaveform() {
  animationFrameId = requestAnimationFrame(drawWaveform);
  
  let volume = 0;
  
  if (analyser && isListening) {
    analyser.getByteTimeDomainData(dataArray);
    
    // Calculate volume (RMS)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = (dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    volume = Math.min(Math.max(rms * 10, 0), 1); // Scale volume
  }
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const width = canvas.width;
  const height = canvas.height;
  const centerY = height / 2;
  
  // Draw Siri-like multiple overlay waves
  const waveCount = 3;
  const colors = [
    'rgba(6, 182, 212, 0.75)',  // Cyan
    'rgba(139, 92, 246, 0.55)', // Purple
    'rgba(236, 72, 153, 0.35)'  // Pink
  ];
  
  phase += isListening ? (volume * 0.2 + 0.08) : 0.04;
  
  for (let w = 0; w < waveCount; w++) {
    ctx.beginPath();
    ctx.strokeStyle = colors[w];
    ctx.lineWidth = w === 0 ? 2.5 : 1.2;
    ctx.shadowBlur = w === 0 ? 8 : 0;
    ctx.shadowColor = colors[w];
    
    const offset = w * Math.PI / 2;
    
    for (let x = 0; x < width; x++) {
      const normalizedX = x / width;
      const envelope = Math.sin(normalizedX * Math.PI); // Bell curve envelope
      
      const frequency = 4 + w * 1.5;
      const angle = (normalizedX * Math.PI * frequency) - phase - offset;
      
      // Standby amplitude is small; active amplitude scales with sound volume
      const maxAmplitude = height * 0.45;
      const baseAmp = isListening ? 3 : 0.8;
      const amplitude = volume * maxAmplitude * envelope + baseAmp * envelope;
      
      const y = centerY + Math.sin(angle) * amplitude;
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}

function drawEmptyLine() {
  animationFrameId = requestAnimationFrame(drawEmptyLine);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const width = canvas.width;
  const height = canvas.height;
  const centerY = height / 2;
  
  phase += 0.03;
  
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.35)';
  ctx.lineWidth = 1.5;
  
  for (let x = 0; x < width; x++) {
    const normalizedX = x / width;
    const envelope = Math.sin(normalizedX * Math.PI);
    const angle = (normalizedX * Math.PI * 4) - phase;
    const y = centerY + Math.sin(angle) * 0.8 * envelope;
    
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

// ----------------------------------------------------
// Phase 2: Eye Tracking & Blink Control Logic
// ----------------------------------------------------

let eyeControlActive = false;
let camera = null;
let faceMesh = null;

// Gaze and mouse speed configurations
const sensitivityX = 75000;
const sensitivityY = 55000;
const smoothingFactor = 0.22;
const blinkThreshold = 0.17; // EAR threshold below which eyes are closed

let smoothedX = window.screen.width / 2;
let smoothedY = window.screen.height / 2;
let blinkFrames = 0;
let lastClickTime = 0;

let lastSentX = 0;
let lastSentY = 0;
let isSendingMouse = false;

// Calibration variables
let calibFrames = 0;
let calibSumX = 0;
let calibSumY = 0;
let basePupilX = 0;
let basePupilY = 0;
let calibrated = false;

// Register click listener for Eye Control Button
btnEyeControl.addEventListener('click', toggleEyeControl);

function toggleEyeControl() {
  if (eyeControlActive) {
    // Stop eye control
    eyeControlActive = false;
    btnEyeControl.classList.remove('active');
    eyeBtnText.textContent = "Enable Eye Control";
    webcamContainer.classList.add('hidden');
    
    // Clear canvas
    const canvasCtx = meshCanvas.getContext('2d');
    canvasCtx.clearRect(0, 0, meshCanvas.width, meshCanvas.height);
    
    statusText.textContent = "Eye control disabled.";
    setTimeout(() => {
      statusText.textContent = wakeWordModeActive ? "Say 'Hi Buddy' or 'Hi Buddy [command]'" : "Click Mic or Press Space to Command";
    }, 1500);
  } else {
    // Start eye control
    eyeControlActive = true;
    btnEyeControl.classList.add('active');
    eyeBtnText.textContent = "Disable Eye Control";
    webcamContainer.classList.remove('hidden');
    
    statusText.textContent = "Initializing camera mesh...";
    resetCalibration();
    
    if (!faceMesh) {
      initFaceMesh();
    }
  }
}

function resetCalibration() {
  calibFrames = 0;
  calibSumX = 0;
  calibSumY = 0;
  calibrated = false;
}

function initFaceMesh() {
  // Check if MediaPipe is loaded from CDN
  if (typeof FaceMesh === 'undefined') {
    statusText.textContent = "Error: MediaPipe FaceMesh libraries not loaded yet.";
    return;
  }
  
  faceMesh = new FaceMesh({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }
  });
  
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true, // Crucial to load iris coordinates (indexes 468 to 477)
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  
  faceMesh.onResults((results) => {
    if (!eyeControlActive) return;
    
    // Draw the face mesh in the preview canvas
    drawMesh(results);
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      handleGazeAndBlink(results.multiFaceLandmarks[0], results.image);
    }
  });
  
  // Start webcam feed via MediaPipe Camera utils
  camera = new Camera(videoElement, {
    onFrame: async () => {
      if (eyeControlActive) {
        await faceMesh.send({ image: videoElement });
      }
    },
    width: 320,
    height: 240
  });
  
  camera.start().catch((err) => {
    console.error("Camera start failed:", err);
    statusText.textContent = "Webcam access denied or unavailable.";
    toggleEyeControl();
  });
}

function drawMesh(results) {
  const canvasCtx = meshCanvas.getContext('2d');
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, meshCanvas.width, meshCanvas.height);
  
  // Draw mirror image of webcam
  canvasCtx.translate(meshCanvas.width, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(results.image, 0, 0, meshCanvas.width, meshCanvas.height);
  canvasCtx.restore();
  
  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];
    
    // Convert coordinate points to canvas dimensions
    const getCanvasPt = (pt) => {
      return {
        x: (1 - pt.x) * meshCanvas.width, // Mirrored X
        y: pt.y * meshCanvas.height
      };
    };
    
    // Eyelid landmark indexes
    const leftEyeIdx = [33, 160, 158, 133, 153, 144];
    const rightEyeIdx = [362, 385, 387, 263, 373, 380];
    
    // Draw eyelid contours in purple
    canvasCtx.strokeStyle = '#8b5cf6';
    canvasCtx.lineWidth = 1;
    
    const drawOutline = (idxList) => {
      canvasCtx.beginPath();
      for (let i = 0; i < idxList.length; i++) {
        const pt = getCanvasPt(landmarks[idxList[i]]);
        if (i === 0) canvasCtx.moveTo(pt.x, pt.y);
        else canvasCtx.lineTo(pt.x, pt.y);
      }
      canvasCtx.closePath();
      canvasCtx.stroke();
    };
    
    drawOutline(leftEyeIdx);
    drawOutline(rightEyeIdx);
    
    // Draw pupils in cyan
    const leftPupil = landmarks[468];
    const rightPupil = landmarks[473];
    
    const lp = getCanvasPt(leftPupil);
    const rp = getCanvasPt(rightPupil);
    
    canvasCtx.beginPath();
    canvasCtx.arc(lp.x, lp.y, 2.5, 0, 2 * Math.PI);
    canvasCtx.arc(rp.x, rp.y, 2.5, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#06b6d4';
    canvasCtx.fill();
  }
}

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function calculateEAR(top, bottom, left, right) {
  const vertical = getDistance(top, bottom);
  const horizontal = getDistance(left, right);
  return vertical / horizontal;
}

function handleGazeAndBlink(landmarks, image) {
  const screenW = window.screen.width;
  const screenH = window.screen.height;
  
  // 1. BLINK DETECTION
  // Eyelids: Top, Bottom, Inner, Outer corners
  const leftEAR = calculateEAR(landmarks[159], landmarks[145], landmarks[33], landmarks[133]);
  const rightEAR = calculateEAR(landmarks[386], landmarks[374], landmarks[362], landmarks[263]);
  const avgEAR = (leftEAR + rightEAR) / 2;
  
  if (avgEAR < blinkThreshold) {
    blinkFrames++;
    if (blinkFrames === 3) { // Held closed for exactly 3 frames (avoids brief random updates)
      blinkIndicator.classList.add('active');
      const now = Date.now();
      if (now - lastClickTime > 800) { // Throttle clicks to 800ms
        lastClickTime = now;
        triggerMouseClickToServer(Math.round(smoothedX), Math.round(smoothedY));
      }
    }
  } else {
    blinkFrames = 0;
    blinkIndicator.classList.remove('active');
  }
  
  // 2. EYE TRACKING (PUPIL COORDINATE TRACKING)
  const leftPupil = landmarks[468];
  const rightPupil = landmarks[473];
  
  // Eye center points
  const leftCenter = { x: (landmarks[33].x + landmarks[133].x)/2, y: (landmarks[33].y + landmarks[133].y)/2 };
  const rightCenter = { x: (landmarks[362].x + landmarks[263].x)/2, y: (landmarks[362].y + landmarks[263].y)/2 };
  
  // Displacement values
  const dxL = leftPupil.x - leftCenter.x;
  const dyL = leftPupil.y - leftCenter.y;
  const dxR = rightPupil.x - rightCenter.x;
  const dyR = rightPupil.y - rightCenter.y;
  
  const avgDx = (dxL + dxR) / 2;
  const avgDy = (dyL + dyR) / 2;
  
  // Calibration sequence
  if (!calibrated) {
    calibSumX += avgDx;
    calibSumY += avgDy;
    calibFrames++;
    
    if (calibFrames >= 30) {
      basePupilX = calibSumX / calibFrames;
      basePupilY = calibSumY / calibFrames;
      calibrated = true;
      statusText.textContent = "Eye Control Calibrated!";
      setTimeout(() => {
        statusText.textContent = "Control cursor with your eyes. Blink to click!";
      }, 1500);
    } else {
      statusText.textContent = `Calibrating... Keep head still (${Math.round(calibFrames / 30 * 100)}%)`;
    }
    return;
  }
  
  // Distance delta relative to neutral calibration looking point
  const dispX = avgDx - basePupilX;
  const dispY = avgDy - basePupilY;
  
  // Translate pupil shift coordinates into absolute macOS screen space (inverted for mirrored camera)
  const rawTargetX = screenW / 2 - (dispX * sensitivityX);
  const rawTargetY = screenH / 2 + (dispY * sensitivityY);
  
  // Clamp boundaries to prevent coordinate overflow
  const targetX = Math.min(Math.max(rawTargetX, 0), screenW);
  const targetY = Math.min(Math.max(rawTargetY, 0), screenH);
  
  // Low-pass exponential filter to filter out raw camera jitter
  smoothedX = smoothedX * (1 - smoothingFactor) + targetX * smoothingFactor;
  smoothedY = smoothedY * (1 - smoothingFactor) + targetY * smoothingFactor;
  
  // Send coordinates to local server
  moveCursorToServer(Math.round(smoothedX), Math.round(smoothedY));
}

async function moveCursorToServer(x, y) {
  if (isSendingMouse) return;
  // Reduce network overhead: only send if displacement is at least 3 pixels
  if (Math.abs(x - lastSentX) < 4 && Math.abs(y - lastSentY) < 4) return;
  
  isSendingMouse = true;
  lastSentX = x;
  lastSentY = y;
  
  try {
    await fetch('/move-mouse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y })
    });
  } catch (err) {
    console.error("Failed to send mouse movement:", err);
  } finally {
    isSendingMouse = false;
  }
}

async function triggerMouseClickToServer(x, y) {
  try {
    await fetch('/click-mouse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y })
    });
    console.log("Registered click at cursor coordinate:", x, y);
  } catch (err) {
    console.error("Failed to trigger mouse click:", err);
  }
}

// Automatically start listening on initial load if wake word is active
window.addEventListener('DOMContentLoaded', () => {
  if (isElectron) {
    // Show Electron window initially
    try {
      window.electronAPI.showWindow();
    } catch(e) {}
    
    statusText.textContent = "Listening... Say 'Hi Buddy' or 'Hi Buddy [command]'.";
    
    // Connect to Server-Sent Events (SSE) from server
    const eventSource = new EventSource('/events');
    
    eventSource.addEventListener('wake-up', () => {
      try {
        window.electronAPI.showWindow();
      } catch(e) {}
      playBeep(600, 0.08);
      setTimeout(() => playBeep(800, 0.08), 80);
      statusText.textContent = "Listening... Speak command now.";
      glowRing.classList.add('listening');
    });
    
    eventSource.addEventListener('action', async (e) => {
      const data = JSON.parse(e.data);
      const { action, transcript } = data;
      
      try {
        window.electronAPI.showWindow();
      } catch(e) {}
      
      // Update UI logs
      const placeholder = logContainer.querySelector('.log-placeholder');
      if (placeholder) placeholder.remove();
      
      const logItem = document.createElement('div');
      logItem.className = 'log-item';
      logItem.innerHTML = `
        <div class="log-title-row">
          <span class="log-title">"${transcript}"</span>
          <span class="log-status translating">Executing...</span>
        </div>
      `;
      logContainer.insertBefore(logItem, logContainer.firstChild);
      
      const statusBadge = logItem.querySelector('.log-status');
      
      if (action.type === 'unsupported') {
        statusBadge.className = 'log-status error';
        statusBadge.textContent = 'Unsupported';
        logItem.innerHTML += `<div class="log-cmd" style="color: #f87171;">Reason: ${action.command}</div>`;
        playBeep(350, 0.15);
        speakText(action.response || `Unsupported command.`);
        return;
      }
      
      if (action.type === 'speak' || action.type === 'answer') {
        statusBadge.className = 'log-status success';
        statusBadge.textContent = 'Success';
        const cmdDiv = document.createElement('div');
        cmdDiv.className = 'log-cmd';
        cmdDiv.style.color = '#a78bfa';
        cmdDiv.textContent = action.response;
        logItem.appendChild(cmdDiv);
        
        playBeep(600, 0.05);
        setTimeout(() => playBeep(800, 0.05), 60);
        
        speakText(action.response);
        return;
      }
      
      // Speak response phrase immediately before running
      if (action.response) {
        speakText(action.response);
      }
      
      const cmdDiv = document.createElement('div');
      cmdDiv.className = 'log-cmd';
      cmdDiv.textContent = `[${action.type.toUpperCase()}] ${action.command}`;
      logItem.appendChild(cmdDiv);
      
      // Execute AppleScript / Shell locally in Electron
      let execResult;
      if (action.type === 'applescript') {
        execResult = await sysAPI.runAppleScript(action.command);
      } else if (action.type === 'shell') {
        execResult = await sysAPI.runShell(action.command);
      }
      
      if (execResult && execResult.success) {
        statusBadge.className = 'log-status success';
        statusBadge.textContent = 'Success';
        
        playBeep(600, 0.05);
        setTimeout(() => playBeep(800, 0.05), 60);
        
        if (execResult.output) {
          setTimeout(() => {
            speakText(execResult.output);
          }, 800);
        }
      } else {
        statusBadge.className = 'log-status error';
        statusBadge.textContent = 'Failed';
        logItem.innerHTML += `<div style="color: #f87171; font-size: 10px; margin-top: 3px; font-family: monospace;">Error: ${execResult ? execResult.error : 'Execution failed'}</div>`;
        playBeep(350, 0.15);
        speakText("Failed to execute command.");
      }
    });
  } else {
    // Chrome environment: start speech recognition
    if (wakeWordModeActive && recognition) {
      setTimeout(() => {
        try {
          startSpeechRecognition();
        } catch (e) {}
      }, 1000);
    }
  }

  // Initialize and start audio visualizer
  startAudioVisualizer();
});
