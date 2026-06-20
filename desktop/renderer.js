// Supabase client removed

let initialText = "";
let refinedText = "";
let activeTone = "improve";

// WebGPU / WebLLM Offline Inference Config
let webLlmEngine = null;
const SELECTED_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
let isDownloadCancelled = false;

async function getWebLlmEngine(onProgress) {
  if (webLlmEngine) return webLlmEngine;
  // Dynamically load WebLLM from esm.run
  const webllm = await import("https://esm.run/@mlc-ai/web-llm");
  webLlmEngine = await webllm.CreateMLCEngine(
    SELECTED_MODEL,
    {
      initProgressCallback: (report) => {
        if (onProgress) onProgress(report.progress, report.text);
      }
    }
  );
  return webLlmEngine;
}

// DOM Elements
const appCard = document.getElementById('app-card');
const appHeader = document.getElementById('app-header');
const inputView = document.getElementById('input-view');
const loadingView = document.getElementById('loading-view');
const successView = document.getElementById('success-view');
const resultView = document.getElementById('result-view');
const errorView = document.getElementById('error-view');
const settingsView = document.getElementById('settings-view');
const welcomeView = document.getElementById('welcome-view');

const customPrompt = document.getElementById('custom-prompt');
const resultBox = document.getElementById('result-box');
const errorMessage = document.getElementById('error-message');
const welcomeBtn = document.getElementById('welcome-btn');

// Onboarding Wizard DOM Elements
let currentOnboardingStep = 1;
const onboardingStep1 = document.getElementById('onboarding-step-1');
const onboardingStep2 = document.getElementById('onboarding-step-2');
const onboardingStep3 = document.getElementById('onboarding-step-3');

const onboardingStartBtn = document.getElementById('onboarding-start-btn');
const welcomeSliderTrack = document.getElementById('welcome-slider-track');
const welcomeSliderDots = document.getElementById('welcome-slider-dots');
let currentWelcomeSlide = 0;

const onboardingProviderSelect = document.getElementById('onboarding-provider');
const onboardingGeminiCustomGroup = document.getElementById('onboarding-gemini-custom-group');
const onboardingGeminiKeyInput = document.getElementById('onboarding-gemini-key');
const onboardingGeminiModelInput = document.getElementById('onboarding-gemini-model');
const configSaveBtn = document.getElementById('config-save-btn');

// Onboarding Step 3 Download elements
const onboardingReadyIcon = document.getElementById('onboarding-ready-icon');
const onboardingReadyTitle = document.getElementById('onboarding-ready-title');
const onboardingReadyDesc = document.getElementById('onboarding-ready-desc');
const onboardingDownloadContainer = document.getElementById('onboarding-download-container');
const onboardingDownloadStatus = document.getElementById('onboarding-download-status');
const onboardingDownloadBar = document.getElementById('onboarding-download-bar');
const onboardingDownloadBtn = document.getElementById('onboarding-download-btn');
const onboardingCancelDownloadBtn = document.getElementById('onboarding-cancel-download-btn');
const onboardingDownloadPct = document.getElementById('onboarding-download-pct');

const toneChips = document.querySelectorAll('.tone-chip');
const submitBtn = document.getElementById('submit-btn');
const insertBtn = document.getElementById('insert-btn');
const cancelBtn = document.getElementById('cancel-btn');
const retryBtn = document.getElementById('retry-btn');
const winCloseBtn = document.getElementById('win-close-btn');
const winSettingsBtn = document.getElementById('win-settings-btn');

// Local Settings Elements
const localProviderSelect = document.getElementById('local-provider');
const localGeminiCustomGroup = document.getElementById('local-gemini-custom-group');
const localGeminiKeyInput = document.getElementById('local-gemini-key');
const localGeminiModelInput = document.getElementById('local-gemini-model');
const saveLocalSettingsBtn = document.getElementById('save-local-settings-btn');
const cancelLocalSettingsBtn = document.getElementById('cancel-local-settings-btn');

const localWebgpuGroup = document.getElementById('local-webgpu-group');
const settingsDownloadBtn = document.getElementById('settings-download-btn');
const settingsDownloadContainer = document.getElementById('settings-download-container');
const settingsDownloadStatus = document.getElementById('settings-download-status');
const settingsDownloadBar = document.getElementById('settings-download-bar');
const settingsCancelDownloadBtn = document.getElementById('settings-cancel-download-btn');
const settingsDownloadPct = document.getElementById('settings-download-pct');


// Start by requesting the initial text from the main process
window.electronAPI.send('get-init-text');

window.electronAPI.on('init-text', (text) => {
  initialText = text;
  if (initialText.trim() === "") {
    window.electronAPI.send('resize-window', 960, 680);
    setOnboardingStep(1);
    showView('welcome-view');
  } else {
    window.electronAPI.send('resize-window', 380, 350);
    showView('input-view');
    customPrompt.focus();
  }
});

// View switching utility
function showView(viewId) {
  const views = [inputView, loadingView, successView, resultView, errorView, settingsView, welcomeView];
  views.forEach(v => {
    if (v.id === viewId) {
      v.classList.add('active');
    } else {
      v.classList.remove('active');
    }
  });

  // Toggle onboarding mode layout style and hide default app header
  if (viewId === 'welcome-view') {
    appCard.classList.add('onboarding-mode');
    appHeader.style.display = 'none';
  } else {
    appCard.classList.remove('onboarding-mode');
    appHeader.style.display = '';
  }

  // Hide the close button and settings button in loading or success states to reduce clutter
  if (viewId === 'loading-view' || viewId === 'success-view') {
    winCloseBtn.style.display = 'none';
    winSettingsBtn.style.display = 'none';
  } else {
    winCloseBtn.style.display = '';
    // Show settings button in input, error, and welcome states (except welcome onboarding view)
    if ((viewId === 'input-view' || viewId === 'error-view' || viewId === 'welcome-view') && viewId !== 'welcome-view') {
      winSettingsBtn.style.display = '';
    } else {
      winSettingsBtn.style.display = 'none';
    }
  }

}


// Local Settings Functions
function loadLocalSettings() {
  const provider = localStorage.getItem('scribeai_provider') || 'gemini-custom';
  const geminiKey = localStorage.getItem('scribeai_gemini_key') || '';
  const geminiModel = localStorage.getItem('scribeai_gemini_model') || 'gemini-1.5-flash';
  
  localProviderSelect.value = provider;
  localGeminiKeyInput.value = geminiKey;
  localGeminiModelInput.value = geminiModel;
  
  if (provider === 'gemini-custom') {
    localGeminiCustomGroup.classList.remove('hidden');
    if (localWebgpuGroup) localWebgpuGroup.classList.add('hidden');
  } else if (provider === 'webgpu') {
    localGeminiCustomGroup.classList.add('hidden');
    if (localWebgpuGroup) localWebgpuGroup.classList.remove('hidden');
  } else {
    localGeminiCustomGroup.classList.add('hidden');
    if (localWebgpuGroup) localWebgpuGroup.classList.add('hidden');
  }
}

winSettingsBtn.addEventListener('click', () => {
  loadLocalSettings();
  const provider = localProviderSelect.value;
  if (provider === 'gemini-custom' || provider === 'webgpu') {
    window.electronAPI.send('resize-window', 380, 470);
  } else {
    window.electronAPI.send('resize-window', 380, 370);
  }
  showView('settings-view');
});

localProviderSelect.addEventListener('change', (e) => {
  if (e.target.value === 'gemini-custom') {
    localGeminiCustomGroup.classList.remove('hidden');
    if (localWebgpuGroup) localWebgpuGroup.classList.add('hidden');
    window.electronAPI.send('resize-window', 380, 470);
  } else if (e.target.value === 'webgpu') {
    localGeminiCustomGroup.classList.add('hidden');
    if (localWebgpuGroup) localWebgpuGroup.classList.remove('hidden');
    window.electronAPI.send('resize-window', 380, 470);
  } else {
    localGeminiCustomGroup.classList.add('hidden');
    if (localWebgpuGroup) localWebgpuGroup.classList.add('hidden');
    window.electronAPI.send('resize-window', 380, 370);
  }
});

saveLocalSettingsBtn.addEventListener('click', async () => {
  localStorage.setItem('scribeai_provider', localProviderSelect.value);
  localStorage.setItem('scribeai_gemini_key', localGeminiKeyInput.value.trim());
  localStorage.setItem('scribeai_gemini_model', localGeminiModelInput.value.trim() || 'gemini-1.5-flash');
  
  await updateProviderOptionsAndMainButtonState();
  window.electronAPI.send('resize-window', 380, 350);
  showView('input-view');
});

cancelLocalSettingsBtn.addEventListener('click', () => {
  window.electronAPI.send('resize-window', 380, 350);
  showView('input-view');
});

// Welcome screen 'Try it Now' transition
const welcomeSkipBtn = document.getElementById('welcome-skip-btn');

const startApp = () => {
  window.electronAPI.send('resize-window', 380, 350);
  showView('input-view');
  customPrompt.focus();
};

welcomeBtn.addEventListener('click', startApp);
if (welcomeSkipBtn) {
  welcomeSkipBtn.addEventListener('click', startApp);
}

// Onboarding Wizard Stepper Logic
function setOnboardingStep(step) {
  currentOnboardingStep = step;
  
  // Show active step content, hide others
  const steps = [onboardingStep1, onboardingStep2, onboardingStep3];
  steps.forEach((s, idx) => {
    if (idx + 1 === step) {
      s.classList.add('active');
    } else {
      s.classList.remove('active');
    }
  });

  if (step === 2) {
    const provider = localStorage.getItem('scribeai_provider') || 'gemini-custom';
    const geminiKey = localStorage.getItem('scribeai_gemini_key') || '';
    const geminiModel = localStorage.getItem('scribeai_gemini_model') || 'gemini-1.5-flash';

    if (onboardingProviderSelect) onboardingProviderSelect.value = provider;
    if (onboardingGeminiKeyInput) onboardingGeminiKeyInput.value = geminiKey;
    if (onboardingGeminiModelInput) onboardingGeminiModelInput.value = geminiModel;

    if (provider === 'gemini-custom') {
      if (onboardingGeminiCustomGroup) onboardingGeminiCustomGroup.classList.remove('hidden');
    } else {
      if (onboardingGeminiCustomGroup) onboardingGeminiCustomGroup.classList.add('hidden');
    }
  }

  if (step === 3) {
    const provider = localStorage.getItem('scribeai_provider') || 'gemini-custom';
    if (onboardingDownloadPct) onboardingDownloadPct.classList.add('hidden');
    if (onboardingReadyIcon) onboardingReadyIcon.classList.remove('hidden');
    if (onboardingReadyDesc) onboardingReadyDesc.classList.remove('hidden');

    if (provider === 'webgpu') {
      if (onboardingReadyTitle) onboardingReadyTitle.textContent = "Download Offline Model";
      if (onboardingReadyDesc) onboardingReadyDesc.innerHTML = "ScribeAI runs locally via WebGPU. To begin, we need to download the offline AI model (~390MB). This runs entirely in your browser cache and is a one-time download.";
      if (onboardingDownloadBtn) onboardingDownloadBtn.classList.remove('hidden');
      if (onboardingDownloadBtn) {
        onboardingDownloadBtn.disabled = false;
        const btnText = onboardingDownloadBtn.querySelector('span');
        if (btnText) btnText.textContent = "Download Offline Model (~390MB)";
      }
      if (onboardingCancelDownloadBtn) onboardingCancelDownloadBtn.classList.add('hidden');
      if (welcomeBtn) welcomeBtn.classList.add('hidden');
      if (onboardingDownloadContainer) onboardingDownloadContainer.classList.add('hidden');
    } else {
      if (onboardingReadyTitle) onboardingReadyTitle.textContent = "ScribeAI is Ready!";
      if (onboardingReadyDesc) onboardingReadyDesc.innerHTML = "You have successfully configured ScribeAI. Select any text across your Mac, press <b>⌘ + Option + S</b>, and start writing better.";
      if (onboardingDownloadBtn) onboardingDownloadBtn.classList.add('hidden');
      if (onboardingCancelDownloadBtn) onboardingCancelDownloadBtn.classList.add('hidden');
      if (welcomeBtn) welcomeBtn.classList.remove('hidden');
      if (onboardingDownloadContainer) onboardingDownloadContainer.classList.add('hidden');
    }
  }

  // Update Stepper indicators
  for (let i = 1; i <= 3; i++) {
    const indicator = document.getElementById(`step-ind-${i}`);
    
    if (indicator) {
      if (i < step) {
        indicator.classList.remove('active');
        indicator.classList.add('completed');
      } else if (i === step) {
        indicator.classList.remove('completed');
        indicator.classList.add('active');
      } else {
        indicator.classList.remove('active', 'completed');
      }
    }
  }
}

// Onboarding step listeners
for (let i = 1; i <= 3; i++) {
  const indicator = document.getElementById(`step-ind-${i}`);
  if (indicator) {
    indicator.addEventListener('click', () => {
      setOnboardingStep(i);
    });
  }
}

function updateWelcomeSlider(slideIndex) {
  currentWelcomeSlide = slideIndex;
  
  // Update track transform
  if (welcomeSliderTrack) {
    welcomeSliderTrack.style.transform = `translateX(-${slideIndex * 25}%)`;
  }
  
  // Update dots active class
  if (welcomeSliderDots) {
    const dots = welcomeSliderDots.querySelectorAll('.welcome-slider-dot');
    dots.forEach((dot, idx) => {
      if (idx === slideIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }
  
  // Update button label
  if (onboardingStartBtn) {
    const btnText = onboardingStartBtn.querySelector('span');
    if (btnText) {
      if (slideIndex === 3) {
        btnText.textContent = "Get Started";
      } else {
        btnText.textContent = "Next Step";
      }
    }
  }
}

if (onboardingStartBtn) {
  onboardingStartBtn.addEventListener('click', () => {
    if (currentWelcomeSlide < 3) {
      updateWelcomeSlider(currentWelcomeSlide + 1);
    } else {
      setOnboardingStep(2);
    }
  });
}

if (welcomeSliderDots) {
  const dots = welcomeSliderDots.querySelectorAll('.welcome-slider-dot');
  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const targetSlide = parseInt(e.target.getAttribute('data-slide'), 10);
      updateWelcomeSlider(targetSlide);
    });
  });
}

if (onboardingDownloadBtn) {
  onboardingDownloadBtn.addEventListener('click', async () => {
    isDownloadCancelled = false;
    onboardingDownloadBtn.disabled = true;
    
    // Hide default text and icon for clean interface (less content)
    if (onboardingReadyIcon) onboardingReadyIcon.classList.add('hidden');
    if (onboardingReadyDesc) onboardingReadyDesc.classList.add('hidden');
    if (onboardingDownloadBtn) onboardingDownloadBtn.classList.add('hidden');
    
    // Show interactive percentage and cancel controls
    if (onboardingDownloadPct) {
      onboardingDownloadPct.textContent = "0%";
      onboardingDownloadPct.classList.remove('hidden');
    }
    if (onboardingCancelDownloadBtn) {
      onboardingCancelDownloadBtn.classList.remove('hidden');
      onboardingCancelDownloadBtn.disabled = false;
      const cancelText = onboardingCancelDownloadBtn.querySelector('span');
      if (cancelText) cancelText.textContent = "Cancel";
    }
    if (onboardingDownloadContainer) onboardingDownloadContainer.classList.remove('hidden');
    if (onboardingDownloadBar) onboardingDownloadBar.style.width = "0%";
    if (onboardingDownloadStatus) onboardingDownloadStatus.textContent = "Connecting to WebGPU...";
    
    try {
      const engine = await getWebLlmEngine((progress, text) => {
        if (isDownloadCancelled) {
          throw new Error("DOWNLOAD_CANCELLED");
        }
        const pct = Math.round(progress * 100);
        if (onboardingDownloadBar) onboardingDownloadBar.style.width = `${pct}%`;
        if (onboardingDownloadPct) onboardingDownloadPct.textContent = `${pct}%`;
        
        let statusMsg = "Downloading model files...";
        if (progress === 0) statusMsg = "Connecting to WebGPU...";
        else if (progress < 0.1) statusMsg = "Initializing download...";
        else if (progress >= 0.98) statusMsg = "Finishing setup...";
        
        if (onboardingDownloadStatus) onboardingDownloadStatus.textContent = statusMsg;
      });
      
      if (onboardingDownloadStatus) onboardingDownloadStatus.textContent = "Model Downloaded Successfully!";
      if (onboardingDownloadPct) onboardingDownloadPct.classList.add('hidden');
      if (onboardingReadyTitle) onboardingReadyTitle.textContent = "ScribeAI is Ready!";
      if (onboardingReadyIcon) onboardingReadyIcon.classList.remove('hidden');
      if (onboardingReadyDesc) {
        onboardingReadyDesc.innerHTML = "You have successfully configured ScribeAI. Select any text across your Mac, press <b>⌘ + Option + S</b>, and start writing better.";
        onboardingReadyDesc.classList.remove('hidden');
      }
      if (onboardingDownloadBtn) onboardingDownloadBtn.classList.add('hidden');
      if (onboardingCancelDownloadBtn) onboardingCancelDownloadBtn.classList.add('hidden');
      if (welcomeBtn) welcomeBtn.classList.remove('hidden');
      if (onboardingDownloadContainer) onboardingDownloadContainer.classList.add('hidden');
    } catch (err) {
      if (onboardingReadyIcon) onboardingReadyIcon.classList.remove('hidden');
      if (onboardingReadyDesc) onboardingReadyDesc.classList.remove('hidden');
      if (onboardingDownloadPct) onboardingDownloadPct.classList.add('hidden');
      
      if (err.message === "DOWNLOAD_CANCELLED") {
        if (onboardingDownloadStatus) onboardingDownloadStatus.textContent = "Download cancelled.";
        if (onboardingCancelDownloadBtn) onboardingCancelDownloadBtn.classList.add('hidden');
        if (onboardingDownloadContainer) onboardingDownloadContainer.classList.add('hidden');
        onboardingDownloadBtn.disabled = false;
        const btnText = onboardingDownloadBtn.querySelector('span');
        if (btnText) btnText.textContent = "Download Offline Model (~390MB)";
        setOnboardingStep(2);
        return;
      }
      if (onboardingDownloadStatus) onboardingDownloadStatus.textContent = `Error: ${err.message || err}`;
      onboardingDownloadBtn.disabled = false;
      const btnText = onboardingDownloadBtn.querySelector('span');
      if (btnText) btnText.textContent = "Retry Download";
      if (onboardingCancelDownloadBtn) onboardingCancelDownloadBtn.classList.add('hidden');
    }
  });
}

if (onboardingCancelDownloadBtn) {
  onboardingCancelDownloadBtn.addEventListener('click', () => {
    isDownloadCancelled = true;
    onboardingCancelDownloadBtn.disabled = true;
    const cancelText = onboardingCancelDownloadBtn.querySelector('span');
    if (cancelText) cancelText.textContent = "Cancelling...";
  });
}

if (settingsDownloadBtn) {
  settingsDownloadBtn.addEventListener('click', async () => {
    isDownloadCancelled = false;
    settingsDownloadBtn.disabled = true;
    
    const configDesc = localWebgpuGroup ? localWebgpuGroup.querySelector('.config-desc') : null;
    if (configDesc) configDesc.classList.add('hidden');
    if (settingsDownloadBtn) settingsDownloadBtn.classList.add('hidden');
    
    if (settingsDownloadPct) {
      settingsDownloadPct.textContent = "0%";
      settingsDownloadPct.classList.remove('hidden');
    }
    if (settingsCancelDownloadBtn) {
      settingsCancelDownloadBtn.classList.remove('hidden');
      settingsCancelDownloadBtn.disabled = false;
      settingsCancelDownloadBtn.textContent = "Cancel";
    }
    if (settingsDownloadContainer) settingsDownloadContainer.classList.remove('hidden');
    if (settingsDownloadBar) settingsDownloadBar.style.width = "0%";
    if (settingsDownloadStatus) settingsDownloadStatus.textContent = "Initializing...";
    
    try {
      const engine = await getWebLlmEngine((progress, text) => {
        if (isDownloadCancelled) {
          throw new Error("DOWNLOAD_CANCELLED");
        }
        const pct = Math.round(progress * 100);
        if (settingsDownloadBar) settingsDownloadBar.style.width = `${pct}%`;
        if (settingsDownloadPct) settingsDownloadPct.textContent = `${pct}%`;
        
        let statusMsg = "Downloading...";
        if (progress === 0) statusMsg = "Connecting...";
        else if (progress < 0.1) statusMsg = "Initializing...";
        else if (progress >= 0.98) statusMsg = "Finishing...";
        
        if (settingsDownloadStatus) settingsDownloadStatus.textContent = statusMsg;
      });
      
      if (settingsDownloadStatus) settingsDownloadStatus.textContent = "Model Downloaded!";
      if (settingsDownloadPct) settingsDownloadPct.classList.add('hidden');
      if (configDesc) configDesc.classList.remove('hidden');
      
      settingsDownloadBtn.textContent = "Model Downloaded (Ready)";
      settingsDownloadBtn.classList.remove('hidden');
      settingsDownloadBtn.disabled = true;
      if (settingsCancelDownloadBtn) settingsCancelDownloadBtn.classList.add('hidden');
      if (settingsDownloadContainer) settingsDownloadContainer.classList.add('hidden');
    } catch (err) {
      if (configDesc) configDesc.classList.remove('hidden');
      if (settingsDownloadPct) settingsDownloadPct.classList.add('hidden');
      if (settingsDownloadBtn) settingsDownloadBtn.classList.remove('hidden');
      
      if (err.message === "DOWNLOAD_CANCELLED") {
        if (settingsDownloadStatus) settingsDownloadStatus.textContent = "Download cancelled.";
        settingsDownloadBtn.disabled = false;
        settingsDownloadBtn.textContent = "Pre-download Offline Model (~390MB)";
        if (settingsCancelDownloadBtn) settingsCancelDownloadBtn.classList.add('hidden');
        if (settingsDownloadContainer) settingsDownloadContainer.classList.add('hidden');
        return;
      }
      if (settingsDownloadStatus) settingsDownloadStatus.textContent = `Error: ${err.message || err}`;
      settingsDownloadBtn.disabled = false;
      settingsDownloadBtn.textContent = "Retry Pre-download";
      if (settingsCancelDownloadBtn) settingsCancelDownloadBtn.classList.add('hidden');
    }
  });
}

if (settingsCancelDownloadBtn) {
  settingsCancelDownloadBtn.addEventListener('click', () => {
    isDownloadCancelled = true;
    settingsCancelDownloadBtn.disabled = true;
    settingsCancelDownloadBtn.textContent = "Cancelling...";
  });
}

async function updateProviderOptionsAndMainButtonState() {
  const provider = localStorage.getItem('scribeai_provider') || 'gemini-custom';

  // Update main submit button state
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Improve Writing";
    submitBtn.removeAttribute('title');
  }
}

// Onboarding Step 2 Config
if (onboardingProviderSelect) {
  onboardingProviderSelect.addEventListener('change', (e) => {
    if (e.target.value === 'gemini-custom') {
      onboardingGeminiCustomGroup.classList.remove('hidden');
    } else {
      onboardingGeminiCustomGroup.classList.add('hidden');
    }
  });
}

if (configSaveBtn) {
  configSaveBtn.addEventListener('click', async () => {
    const provider = onboardingProviderSelect.value;
    localStorage.setItem('scribeai_provider', provider);
    if (provider === 'gemini-custom') {
      localStorage.setItem('scribeai_gemini_key', onboardingGeminiKeyInput.value.trim());
      localStorage.setItem('scribeai_gemini_model', onboardingGeminiModelInput.value.trim() || 'gemini-1.5-flash');
    }
    
    await updateProviderOptionsAndMainButtonState();
    setOnboardingStep(3);
  });
}

// Window Close listener
winCloseBtn.addEventListener('click', () => {
  window.electronAPI.send('close-app');
});

// Tone chip selector
toneChips.forEach(chip => {
  chip.addEventListener('click', () => {
    toneChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeTone = chip.getAttribute('data-tone');
  });
});

// Submit/Refinement execution
submitBtn.addEventListener('click', triggerRefinement);

// Handle Enter to submit in text area (Command + Enter or Control + Enter)
customPrompt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    triggerRefinement();
  }
});

function triggerRefinement() {
  const customInst = customPrompt.value.trim();
  
  // Resize to loading size (280x200) and show view
  window.electronAPI.send('resize-window', 280, 200);
  showView('loading-view');

  // Trigger background API call
  runApiCall(customInst);
}

// API execution
async function runApiCall(customInst) {
  const tonePrompts = {
    professional: "Rewrite the text to be highly professional, polite, articulate, and well-structured, suitable for formal business correspondence or emails. Maintain a respectful, clear, and authoritative tone.",
    casual: "Rewrite the text to be friendly, casual, and conversational, while maintaining clarity and correct grammar. Perfect for quick team chats, Slack messages, or informal emails.",
    improve: "Refine the grammar, vocabulary, spelling, punctuation, and sentence flow of the text, making it sound natural, polished, and elegant while strictly preserving the original meaning and layout formatting (like line breaks or lists). Avoid sounding overly formal or robotic.",
    concise: "Shorten the text to make it extremely direct and concise. Remove fluff, redundancy, and passive language while retaining all core details, meaning, and essential context.",
    expand: "Elaborate on the ideas in the text. Add descriptive details, transitions, and polished vocabulary to make it more comprehensive, engaging, and fully-formed, without repeating points."
  };
  
  const toneInstruction = tonePrompts[activeTone] || tonePrompts.improve;
  const customPromptText = customInst ? `Additional custom instruction: ${customInst}` : "";
  
  const systemPrompt = `You are ScribeAI, a premium AI writing assistant. Your task is to rewrite, refine, or generate text strictly according to the user's instructions.

CRITICAL INSTRUCTION FOR OUTPUT FORMATTING:
1. Return ONLY the final rewritten/generated text.
2. Absolutely NO conversational filler, introductions, or explanations (e.g., do NOT write "Here is the refined text:", "Sure, here is...", "Okay", or "Hope this helps").
3. Do NOT wrap the output in quotation marks, backticks, or markdown code blocks (do NOT use \`\`\` or similar).
4. Preserve the user's paragraph breaks, formatting, list styles, and punctuation wherever possible.
5. If the input text is extremely short, generic, or lacks context (e.g., "test", single words), do NOT complain or ask for details. Return the polished version or the text as-is.
6. If the input is gibberish/placeholders (like "asdf" or "qwerty") and there is an additional custom instruction, IGNORE the gibberish and generate fresh content based on the custom instruction.
7. Do NOT change, correct, or translate proper nouns, people's names, brand names, or specific terminology. Keep them exactly as spelled in the input text (e.g., preserve names like "rohit" exactly, do not change them to other spellings).

DIRECTIVE:
${toneInstruction}

${customPromptText}`;

  const provider = localStorage.getItem('scribeai_provider') || 'gemini-custom';
  const geminiKey = localStorage.getItem('scribeai_gemini_key') || '';
  const geminiModel = localStorage.getItem('scribeai_gemini_model') || 'gemini-1.5-flash';

  if (provider === 'webgpu') {
    const progressContainer = document.getElementById('loading-progress-container');
    const progressBar = document.getElementById('loading-progress-bar');
    const loadingStatus = document.getElementById('loading-status');

    try {
      progressContainer.classList.remove('hidden');
      loadingStatus.textContent = "Checking system WebGPU support...";
      window.electronAPI.send('resize-window', 300, 240);

      const engine = await getWebLlmEngine((progress, text) => {
        const pct = Math.round(progress * 100);
        progressBar.style.width = `${pct}%`;
        loadingStatus.textContent = `Downloading Model: ${pct}%`;
      });

      progressContainer.classList.add('hidden');
      loadingStatus.textContent = "Rewriting text offline...";

      const reply = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Text to rewrite:\n${initialText}` }
        ],
        temperature: 0.3
      });

      refinedText = cleanOutput(reply.choices[0].message.content);
      // Small models mangle names — deterministically restore them from input
      refinedText = restoreNames(initialText, refinedText);
      handleSuccess();
    } catch (error) {
      progressContainer.classList.add('hidden');
      handleError(new Error(`WebGPU Error: ${error.message || error}. Ensure your hardware supports WebGPU.`));
    }
  } else {
    try {
      const rawResult = await window.electronAPI.invoke('run-api-call', {
        provider,
        systemPrompt,
        initialText,
        geminiKey,
        geminiModel
      });
      refinedText = cleanOutput(rawResult);
      handleSuccess();
    } catch (error) {
      handleError(error);
    }
  }
}

function handleSuccess() {
  showView('success-view');

  setTimeout(() => {
    window.electronAPI.send('resize-window', 380, 380);
    resultBox.value = refinedText;
    showView('result-view');
    resultBox.focus();
  }, 1200);
}

function handleError(error) {
  errorMessage.textContent = error.message || "An unknown error occurred.";
  window.electronAPI.send('resize-window', 340, 240);
  showView('error-view');
}

// Levenshtein distance for fuzzy name matching
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Deterministic post-processor: restores names/proper nouns that a small model may have mangled
function restoreNames(inputText, outputText) {
  // Common English words to never treat as names
  const COMMON = new Set([
    // Articles, prepositions, conjunctions, pronouns
    'the','and','for','are','but','not','you','all','can','had','her','was','one',
    'our','out','has','have','from','they','been','said','she','which','their',
    'will','other','about','many','then','them','these','some','would','make',
    'like','him','into','time','very','when','come','could','now','than','first',
    'its','who','after','back','year','also','your','just','know','take','with',
    'that','this','what','here','how','much','most','only','over','such','each',
    'any','both','few','more','own','same','too','use','way','may','per','via',
    // Common verbs
    'get','got','see','saw','been','being','does','did','might','shall','should',
    'must','let','lets','put','set','try','ask','say','tell','give','keep',
    'begin','seem','help','show','hear','play','move','live','look','feel',
    'open','close','turn','start','stop','plan','work','find','need','want',
    'think','thought','believe','expect','hope','wish','leave','bring','write',
    'read','learn','speak','meet','discuss','decide','consider','suggest',
    'provide','include','follow','require','offer','happen','seem','appear',
    'send','check','deploy','submit','install','remove','fix','run','setup',
    // Common nouns
    'day','week','month','year','today','tomorrow','yesterday','morning','night',
    'thing','stuff','part','place','case','point','group','number','world',
    'hand','line','word','side','head','house','long','right','left','end',
    'home','state','area','city','body','mind','rest','face','fact','form',
    'water','room','book','idea','name','list','file','link','page','site',
    'issue','server','system','error','data','code','user','email','phone',
    'client','project','product','feature','service','request','response',
    'report','update','meeting','call','team','sprint','module','dashboard',
    'available','ready','done','working','finished','pending','urgent','quick',
    // Common adjectives & adverbs
    'yes','yeah','sure','okay','well','good','great','nice','fine','bad',
    'new','old','big','small','high','low','full','real','last','next',
    'different','important','large','possible','early','late','young','hard',
    'certain','clear','free','true','whole','major','better','able','likely',
    // Casual/slang (critical to exclude from name matching)
    'hey','hello','dude','bro','guys','man','bruh','lol','asap','fyi',
    'cool','awesome','wow','damn','crap','oops','yep','nope','nah',
    // Days & time
    'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
    'again','already','always','never','often','still','every','soon',
    // Tech terms
    'app','api','url','web','bug','log','dev','ops','test','push','pull',
    'build','deploy','merge','branch','commit','release','config','database',
    'backend','frontend','endpoint','webhook','refactor','integrate','sync',
    // Greetings & closings
    'dear','regards','sincerely','best','kind','warm','please','thanks',
    'thank','sorry','welcome','congratulations','cheers',
    // Miscellaneous common words
    'someone','anyone','everyone','something','anything','everything',
    'nothing','another','between','before','behind','below','above',
    'around','through','during','without','within','along','across',
    'down','away','off','upon','toward','against','among','until',
    'text','rewrite','improve','refine','polish','correct','instruction','version',
    'however','therefore','because','although','whether','since','while',
    'maybe','perhaps','really','actually','basically','simply','usually'
  ]);

  // Extract candidate name-words from input (3+ letters, not common English)
  const inputWords = inputText.match(/\b[a-zA-Z]{3,}\b/g) || [];
  const nameMap = new Map(); // lowercase -> original spelling
  for (const w of inputWords) {
    const lower = w.toLowerCase();
    if (!COMMON.has(lower)) {
      nameMap.set(lower, w);
    }
  }

  if (nameMap.size === 0) return outputText;

  // Scan output words and fix near-misses
  let result = outputText;
  const outputWords = outputText.match(/\b[a-zA-Z]{3,}\b/g) || [];
  const alreadyFixed = new Set();

  for (const outWord of outputWords) {
    const outLower = outWord.toLowerCase();
    if (COMMON.has(outLower)) continue;
    if (nameMap.has(outLower)) continue; // exact match, fine
    if (alreadyFixed.has(outLower)) continue;

    // Check each candidate name for a close fuzzy match
    for (const [nameLower, nameOriginal] of nameMap) {
      if (nameLower === outLower) continue;
      const dist = levenshtein(nameLower, outLower);
      // Allow edit distance ≤ 2 for words of similar length
      if (dist <= 2 && Math.abs(nameLower.length - outLower.length) <= 1) {
        // Preserve the case pattern of the output word
        let replacement = nameOriginal;
        if (outWord[0] === outWord[0].toUpperCase() && nameOriginal[0] === nameOriginal[0].toLowerCase()) {
          replacement = nameOriginal[0].toUpperCase() + nameOriginal.slice(1);
        }
        result = result.replace(new RegExp('\\b' + outWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'), replacement);
        alreadyFixed.add(outLower);
        break;
      }
    }
  }

  return result;
}

function cleanOutput(text) {
  let cleaned = text.trim();
  
  // 1. Strip outer quotes if present
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  
  // 2. Strip markdown code blocks
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    if (lines[0].startsWith("```")) {
      lines.shift();
    }
    if (lines.length && lines[lines.length - 1] === "```") {
      lines.pop();
    }
    cleaned = lines.join("\n").trim();
  }

  // 3. Split the text into paragraphs/blocks
  // We split by one or more newlines, but we also filter out lines that are just dividers
  const lines = cleaned.split(/\r?\n/);
  const blocks = [];
  let currentBlock = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // If the line is a divider, we end the current block and start a new one
    if (/^[-*_~=\s]{3,}$/.test(line)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join("\n").trim());
        currentBlock = [];
      }
    } else if (line === "") {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join("\n").trim());
        currentBlock = [];
      }
    } else {
      currentBlock.push(lines[i]); // Keep original line formatting
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join("\n").trim());
  }

  // 4. Now filter the blocks to remove explanations
  const explanationPatterns = [
    /meets (all )?the specified instructions/i,
    /adhering to the guidelines/i,
    /tone/i,
    /formal business correspondence/i,
    /here is the/i,
    /sure, here/i,
    /polished version/i,
    /rewrite/i,
    /refined/i,
    /I have/i,
    /I've/i,
    /corrected/i,
    /grammar/i,
    /spelling/i,
    /hope this helps/i,
    /let me know/i,
    /specified instructions/i,
    /original text/i,
    /this text meets/i,
    /formal business/i,
    /business correspondence/i,
    /writing assistant/i,
    /condensed version/i,
    /original (prompt|meaning|message)/i,
    /maintains the (essential|original|core)/i,
    /preserves the (essential|original|core|meaning)/i,
    /this version/i,
    /the above/i,
    /text has been/i,
    /has been (rewritten|refined|polished|condensed|shortened)/i
  ];

  const contentBlocks = [];
  for (const block of blocks) {
    const isExplanation = explanationPatterns.some(regex => regex.test(block)) && block.length < 500;
    if (!isExplanation) {
      contentBlocks.push(block);
    }
  }

  // 5. If we have content blocks left, join them
  if (contentBlocks.length > 0) {
    cleaned = contentBlocks.join("\n\n").trim();
  } else {
    // Fallback: if we filtered out everything, keep the first block
    cleaned = blocks[0] || text;
  }

  // 6. Strip outer bold markers if they wrap the entire text
  if (cleaned.startsWith('**') && cleaned.endsWith('**')) {
    cleaned = cleaned.slice(2, -2).trim();
  }

  // 7. Strip outer quotes again just in case
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

// Result insert / cancel actions
insertBtn.addEventListener('click', () => {
  const finalInsertedText = resultBox.value;
  window.electronAPI.send('insert-text', finalInsertedText);
});

cancelBtn.addEventListener('click', () => {
  window.electronAPI.send('close-app');
});

// Key listener for results box (Cmd+Enter to insert)
resultBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    const finalInsertedText = resultBox.value;
    window.electronAPI.send('insert-text', finalInsertedText);
  }
});

// Global key listener (Escape to cancel/quit)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.electronAPI.send('close-app');
  }
});

// Error retry
retryBtn.addEventListener('click', () => {
  window.electronAPI.send('resize-window', 380, 350);
  showView('input-view');
  customPrompt.focus();
});

// Manual updates check button
const checkUpdateBtn = document.getElementById('check-update-btn');
const updateStatusText = document.getElementById('update-status-text');
const updateProgressContainer = document.getElementById('update-progress-container');
const updateProgressBar = document.getElementById('update-progress-bar');
const updateProgressValue = document.getElementById('update-progress-value');

function setUpdateProgress(percent) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  if (updateProgressContainer) updateProgressContainer.classList.remove('hidden');
  if (updateProgressBar) updateProgressBar.style.width = `${safePercent}%`;
  if (updateProgressValue) updateProgressValue.textContent = `${safePercent}%`;
}

function resetUpdateProgress() {
  if (updateProgressContainer) updateProgressContainer.classList.add('hidden');
  if (updateProgressBar) updateProgressBar.style.width = '0%';
  if (updateProgressValue) updateProgressValue.textContent = '0%';
}

if (checkUpdateBtn) {
  checkUpdateBtn.addEventListener('click', () => {
    if (checkUpdateBtn.textContent === 'Install Update') {
      window.electronAPI.send('quit-and-install');
    } else {
      updateStatusText.textContent = "Checking...";
      checkUpdateBtn.disabled = true;
      resetUpdateProgress();
      window.electronAPI.send('check-for-updates-manual');
    }
  });
}

// Listen for auto-updater status changes
window.electronAPI.on('update-status-change', (status, details) => {
  if (!updateStatusText || !checkUpdateBtn) return;

  switch (status) {
    case 'checking':
      updateStatusText.textContent = "Checking...";
      checkUpdateBtn.disabled = true;
      resetUpdateProgress();
      break;
    case 'available':
      updateStatusText.textContent = `v${details} available!`;
      checkUpdateBtn.disabled = true;
      setUpdateProgress(0);
      break;
    case 'not-available':
      updateStatusText.textContent = details ? `v${details} (Up to date)` : "Up to date";
      checkUpdateBtn.disabled = false;
      checkUpdateBtn.textContent = "Check Updates";
      resetUpdateProgress();
      break;
    case 'downloading':
      updateStatusText.textContent = `Downloading: ${details}`;
      checkUpdateBtn.disabled = true;
      setUpdateProgress(parseInt(details, 10));
      break;
    case 'downloaded':
      updateStatusText.textContent = `v${details} ready!`;
      checkUpdateBtn.disabled = false;
      checkUpdateBtn.textContent = "Install Update";
      setUpdateProgress(100);
      break;
    case 'error':
      updateStatusText.textContent = "Check failed";
      checkUpdateBtn.disabled = false;
      checkUpdateBtn.textContent = "Retry Check";
      resetUpdateProgress();
      console.error("Update error detail:", details);
      break;
  }
});
