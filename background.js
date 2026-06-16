// Open onboarding page on extension install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'IMPROVE_TEXT') {
    handleImproveText(request, sendResponse);
    return true; // Keep the message channel open for asynchronous sendResponse
  } else if (request.action === 'GET_SETTINGS') {
    getSettings().then(settings => sendResponse(settings));
    return true;
  }
});

async function handleImproveText(request, sendResponse) {
  const { text, tone, customInstruction } = request;

  try {
    // 1. Get configurations from storage
    const settings = await getSettings();
    const provider = settings.apiProvider || 'gemini';

    // Build instruction prompts
    const tonePrompts = {
      professional: "Rewrite the text to be highly professional, polite, articulate, and well-structured, suitable for formal business correspondence or emails. Maintain a respectful, clear, and authoritative tone.",
      casual: "Rewrite the text to be friendly, casual, and conversational, while maintaining clarity and correct grammar. Perfect for quick team chats, Slack messages, or informal emails.",
      improve: "Refine the grammar, vocabulary, spelling, punctuation, and sentence flow of the text, making it sound natural, polished, and elegant while strictly preserving the original meaning and layout formatting (like line breaks or lists). Avoid sounding overly formal or robotic.",
      concise: "Shorten the text to make it extremely direct and concise. Remove fluff, redundancy, and passive language while retaining all core details, meaning, and essential context.",
      expand: "Elaborate on the ideas in the text. Add descriptive details, transitions, and polished vocabulary to make it more comprehensive, engaging, and fully-formed, without repeating points."
    };

    const toneInstruction = tonePrompts[tone] || tonePrompts['improve'];
    const customPrompt = customInstruction ? `Additional custom instruction: ${customInstruction}` : '';
    
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

${customPrompt}`;

    // 2. Call chosen provider
    if (provider === 'demo') {
      const responseText = await runDemoMode(text, tone, customInstruction);
      sendResponse({ success: true, text: responseText });
    } else if (provider === 'openai') {
      const responseText = await callOpenAI(text, systemPrompt, settings);
      sendResponse({ success: true, text: responseText });
    } else if (provider === 'gemini') {
      const responseText = await callGemini(text, systemPrompt, settings);
      sendResponse({ success: true, text: responseText });
    } else if (provider === 'nvidia') {
      const responseText = await callNVIDIA(text, systemPrompt, settings);
      sendResponse({ success: true, text: responseText });
    } else if (provider === 'ollama') {
      const responseText = await callOllama(text, systemPrompt, settings);
      sendResponse({ success: true, text: responseText });
    } else {
      throw new Error(`Unknown API provider: ${provider}`);
    }
  } catch (error) {
    console.error('ScribeAI Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Fetch stored settings safely
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'apiProvider',
      'openaiKey',
      'openaiModel',
      'geminiKey',
      'geminiModel',
      'nvidiaKey',
      'nvidiaModel',
      'ollamaUrl',
      'ollamaModel',
      'defaultTone',
      'customInstruction'
    ], (settings) => {
      resolve(settings);
    });
  });
}

// Demo/Simulation Mode
function runDemoMode(text, tone, customInstruction) {
  return new Promise((resolve) => {
    setTimeout(() => {
      let refined = text;
      
      // Clean up text for presentation
      const cleaned = text.trim();
      
      switch (tone) {
        case 'professional':
          refined = `Dear recipient,\n\nI am writing to share the following message: "${cleaned}". Please let me know if you require any further clarification or assistance regarding this matter.\n\nBest regards,\n[ScribeAI Refined]`;
          break;
        case 'casual':
          refined = `Hey! just wanted to reach out: ${cleaned.toLowerCase()} 😊 hope you have a great day!`;
          break;
        case 'concise':
          refined = cleaned.length > 20 ? `${cleaned.slice(0, Math.floor(cleaned.length * 0.65))}...` : cleaned;
          break;
        case 'expand':
          refined = `Regarding the topic: "${cleaned}", this is an important area where we should pay close attention. Specifically, we want to ensure all details are aligned and we communicate clearly moving forward.`;
          break;
        case 'improve':
        default:
          refined = `✨ [Polished] ${cleaned.charAt(0).toUpperCase() + cleaned.slice(1)}.`;
          break;
      }
      
      if (customInstruction) {
        refined += `\n\n*(Note: Simulated custom instruction "${customInstruction}" was applied)*`;
      }
      
      resolve(refined);
    }, 1000); // 1s delay to feel like a real API call
  });
}

// OpenAI API Call
async function callOpenAI(text, systemPrompt, settings) {
  const apiKey = settings.openaiKey;
  const model = settings.openaiModel || 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error("OpenAI API Key is missing. Please open the ScribeAI options popup to configure it.");
  }

  const url = 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Text to rewrite:\n${text}` }
      ],
      temperature: 0.3 // Lower temperature for more precise improvements
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || `HTTP error! Status: ${response.status}`;
    throw new Error(`OpenAI API error: ${errorMsg}`);
  }

  const data = await response.json();
  const refinedText = data.choices?.[0]?.message?.content;
  if (!refinedText) {
    throw new Error("Received an empty response from OpenAI.");
  }

  return cleanOutput(refinedText);
}

// Google Gemini API Call
async function callGemini(text, systemPrompt, settings) {
  const HARDCODED_GEMINI_KEY = "AQ.Ab8RN6J4v2xilWoei73ZIZ0ChIu-WQ2Q16OUEH0MYBDpWXKKcQ";
  const apiKey = settings.geminiKey || HARDCODED_GEMINI_KEY;
  
  let model = settings.geminiModel || 'gemini-flash-latest';
  // Map to the active 'gemini-flash-latest' and 'gemini-pro-latest' aliases to prevent 404 errors
  if (model === 'gemini-1.5-flash' || model === 'gemini-1.5-flash-latest') {
    model = 'gemini-flash-latest';
  } else if (model === 'gemini-1.5-pro' || model === 'gemini-1.5-pro-latest') {
    model = 'gemini-pro-latest';
  }

  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please open the ScribeAI options popup to configure it.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `Text to rewrite:\n${text}` }
          ]
        }
      ],
      system_instruction: {
        parts: [
          { text: systemPrompt }
        ]
      },
      generationConfig: {
        temperature: 0.3
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || `HTTP error! Status: ${response.status}`;
    throw new Error(`Gemini API error: ${errorMsg}`);
  }

  const data = await response.json();
  const refinedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!refinedText) {
    throw new Error("Received an empty response from Gemini.");
  }

  return cleanOutput(refinedText);
}

// NVIDIA API Call (OpenAI-compatible)
async function callNVIDIA(text, systemPrompt, settings) {
  const HARDCODED_NVIDIA_KEY = "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";
  const apiKey = settings.nvidiaKey || HARDCODED_NVIDIA_KEY;
  const model = settings.nvidiaModel || 'meta/llama-3.1-70b-instruct';

  if (!apiKey) {
    throw new Error("NVIDIA API Key is missing. Please open the ScribeAI options popup to configure it.");
  }

  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Text to rewrite:\n${text}` }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || errorData.detail || `HTTP error! Status: ${response.status}`;
    throw new Error(`NVIDIA API error: ${errorMsg}`);
  }

  const data = await response.json();
  const refinedText = data.choices?.[0]?.message?.content;
  if (!refinedText) {
    throw new Error("Received an empty response from NVIDIA.");
  }

  return cleanOutput(refinedText);
}

// Utility helper to strip formatting if LLM ignores system instructions
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

// Ollama API Call
async function callOllama(text, systemPrompt, settings) {
  const url = `${settings.ollamaUrl || 'http://localhost:11434'}/v1/chat/completions`;
  const model = settings.ollamaModel || 'llama3';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Text to rewrite:\n${text}` }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || errorData.detail || `HTTP error! Status: ${response.status}`;
    throw new Error(`Ollama error: ${errorMsg}. Make sure Ollama is running at ${settings.ollamaUrl} and model '${model}' is pulled.`);
  }

  const data = await response.json();
  const refinedText = data.choices?.[0]?.message?.content;
  if (!refinedText) {
    throw new Error("Received an empty response from Ollama.");
  }

  return cleanOutput(refinedText);
}
