(function() {
  // Prevent duplicate injection
  if (window.hasOwnProperty('__scribeAI_injected')) return;
  window.__scribeAI_injected = true;

  // State Variables
  let activeElement = null;
  let originalInputContent = '';
  let lastRefinedContent = '';
  let originalSelectionStart = null;
  let originalSelectionEnd = null;
  let wasContentEditable = false;
  let hasPendingUndo = false;
  let activeTone = 'improve';

  // Elements (inside Shadow DOM)
  let shadowRoot = null;
  let overlay = null;
  let triggerBtn = null;
  let panel = null;
  let header = null;
  let inputView = null;
  let loadingView = null;
  let successView = null;
  let resultView = null;
  let submitBtn = null;
  let closeBtn = null;
  let textareaCustom = null;
  let previewBox = null;
  let insertBtn = null;
  let undoBtn = null;
  let errorBox = null;

  // Inject global highlight styles into the main page document (outside Shadow DOM)
  function injectGlobalStyles() {
    if (document.getElementById('scribeai-global-styles')) return;
    const style = document.createElement('style');
    style.id = 'scribeai-global-styles';
    style.textContent = `
      @keyframes scribeai-pulse-glow {
        0% { box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.35); }
        50% { box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.6), 0 0 10px rgba(124, 58, 237, 0.3); }
        100% { box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.35); }
      }
      .scribeai-highlight-input {
        border-color: #7c3aed !important;
        outline: none !important;
        animation: scribeai-pulse-glow 2s infinite ease-in-out !important;
        transition: border-color 0.25s ease !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize ScribeAI Overlay
  function initOverlay() {
    injectGlobalStyles();
    if (document.getElementById('scribeai-host-root')) return;

    const host = document.createElement('div');
    host.id = 'scribeai-host-root';
    host.style.position = 'absolute';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '100%';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'open' });

    // Stylesheet rules
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

      .scribeai-scope {
        font-family: 'Outfit', sans-serif;
        color-scheme: dark;
        font-size: 13px;
      }

      @keyframes scribeai-btn-pulse {
        0% { box-shadow: 0 4px 12px rgba(124, 58, 237, 0.5), 0 0 0 0px rgba(124, 58, 237, 0.4); }
        70% { box-shadow: 0 4px 16px rgba(124, 58, 237, 0.7), 0 0 0 8px rgba(124, 58, 237, 0); }
        100% { box-shadow: 0 4px 12px rgba(124, 58, 237, 0.5), 0 0 0 0px rgba(124, 58, 237, 0); }
      }

      /* Floating Action Button */
      #scribeai-trigger {
        position: fixed;
        z-index: 2147483647;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
        border: 1px solid rgba(255, 255, 255, 0.25);
        box-shadow: 0 4px 12px rgba(124, 58, 237, 0.5);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 0;
        opacity: 1;
        pointer-events: auto;
        color: #fff;
        animation: scribeai-btn-pulse 2s infinite ease-in-out;
      }

      #scribeai-trigger:hover {
        transform: scale(1.12);
        box-shadow: 0 6px 16px rgba(124, 58, 237, 0.6);
      }

      #scribeai-trigger:active {
        transform: scale(0.92);
      }

      .scribeai-icon {
        width: 16px;
        height: 16px;
        color: inherit;
        display: block;
      }

      /* Background Blur Overlay Backdrop */
      #scribeai-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(5, 3, 10, 0.45);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 2147483646;
        transition: opacity 0.25s ease;
        pointer-events: auto;
      }

      /* Centered Floating Card Panel */
      #scribeai-panel {
        position: fixed;
        z-index: 2147483647;
        width: 460px;
        max-height: 85vh;
        left: 50% !important;
        top: 50% !important;
        transform: translate(-50%, -50%) !important;
        overflow: hidden;
        background: rgba(15, 12, 27, 0.98);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(124, 58, 237, 0.25);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(124, 58, 237, 0.15);
        display: flex;
        flex-direction: column;
        gap: 16px;
        color: #f3f4f6;
        transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                    height 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                    padding 0.3s cubic-bezier(0.16, 1, 0.3, 1),
                    background-color 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        background-image: radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.15) 0%, transparent 60%);
        pointer-events: auto;
        box-sizing: border-box;
      }

      #scribeai-panel.scribeai-compact {
        width: 300px;
        padding: 20px;
        gap: 12px;
        background: rgba(10, 8, 20, 0.99);
        border-color: rgba(124, 58, 237, 0.4);
      }

      .scribeai-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        padding-bottom: 12px;
        margin-bottom: 4px;
      }

      .scribeai-title {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.2px;
        background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .scribeai-close-btn {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        outline: none;
      }

      .scribeai-close-btn:hover {
        color: #f3f4f6;
        background: rgba(255, 255, 255, 0.06);
      }

      .scribeai-close-svg {
        width: 14px;
        height: 14px;
        color: inherit;
        display: block;
      }

      /* View Containers */
      #scribeai-input-view, #scribeai-result-view {
        display: flex;
        flex-direction: column;
        gap: 14px;
        animation: fadeIn 0.25s ease-out;
      }

      #scribeai-success-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 16px 0 8px 0;
        animation: fadeIn 0.25s ease-out;
      }

      .scribeai-success-text {
        font-size: 13px;
        font-weight: 600;
        color: #10b981;
        letter-spacing: 0.2px;
      }

      .scribeai-presets-label {
        font-size: 11.5px;
        color: #9ca3af;
        font-weight: 500;
      }

      .scribeai-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 2px;
      }

      .scribeai-chip {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #d1d5db;
        border-radius: 99px;
        padding: 6px 14px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
        outline: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .scribeai-chip:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
      }

      .scribeai-chip.active {
        background: rgba(124, 58, 237, 0.15);
        border-color: #7c3aed;
        color: #c084fc;
      }

      .scribeai-chip-svg {
        width: 12px;
        height: 12px;
        color: inherit;
        display: block;
      }

      .scribeai-form-group textarea {
        width: 100%;
        height: 75px;
        min-height: 75px;
        max-height: 75px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        color: #f3f4f6;
        font-size: 12.5px;
        line-height: 1.4;
        padding: 10px;
        resize: none;
        box-sizing: border-box;
        font-family: inherit;
        outline: none;
        transition: border-color 0.2s;
      }

      .scribeai-form-group textarea:focus {
        border-color: #7c3aed;
        background: rgba(255, 255, 255, 0.06);
      }

      .scribeai-action-btn {
        background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
        border: none;
        color: white;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
        box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
        outline: none;
      }

      .scribeai-action-btn:hover {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        box-shadow: 0 6px 18px rgba(124, 58, 237, 0.45);
      }

      /* Loader View Styles */
      #scribeai-loading-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 16px 0 8px 0;
        animation: fadeIn 0.25s ease-out;
      }

      .scribeai-pulse-ring {
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(124, 58, 237, 0.08);
        border-radius: 50%;
        border: 1px solid rgba(124, 58, 237, 0.2);
        box-shadow: 0 0 20px rgba(124, 58, 237, 0.1);
      }

      .scribeai-double-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(124, 58, 237, 0.1);
        border-radius: 50%;
        border-top-color: #7c3aed;
        border-bottom-color: #a78bfa;
        animation: spin 1s cubic-bezier(0.5, 0.1, 0.5, 0.9) infinite;
      }

      .scribeai-loading-text {
        font-size: 13px;
        font-weight: 500;
        color: #9ca3af;
        letter-spacing: 0.2px;
      }

      /* Success Checkmark Anim */
      .scribeai-success-checkmark {
        width: 52px;
        height: 52px;
        margin: 0 auto;
      }

      .scribeai-check-icon {
        width: 44px;
        height: 44px;
        position: relative;
        border-radius: 50%;
        box-sizing: content-box;
        border: 4px solid #10b981;
        margin: 0 auto;
        transform: scale(0);
        animation: scribeai-checkmark-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
      }

      .scribeai-check-icon::after {
        content: '';
        position: absolute;
        left: 12px;
        top: 22px;
        width: 8px;
        height: 16px;
        border: solid #10b981;
        border-width: 0 4px 4px 0;
        transform: rotate(45deg);
        transform-origin: 0 100%;
        opacity: 0;
        animation: scribeai-checkmark-draw 0.35s ease-out 0.35s forwards;
      }

      @keyframes scribeai-checkmark-pop {
        to { transform: scale(1); }
      }

      @keyframes scribeai-checkmark-draw {
        0% {
          height: 0;
          width: 0;
          opacity: 0;
        }
        40% {
          height: 0;
          width: 8px;
          opacity: 1;
        }
        100% {
          height: 16px;
          width: 8px;
          opacity: 1;
        }
      }

      /* Preview and Actions */
      .scribeai-preview-label {
        font-size: 11.5px;
        color: #9ca3af;
        font-weight: 500;
        margin-top: 4px;
      }

      #scribeai-preview-box {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 10px;
        font-size: 13px;
        line-height: 1.5;
        max-height: 180px;
        overflow-y: auto;
        outline: none;
        min-height: 90px;
        color: #f3f4f6;
        box-sizing: border-box;
        font-family: inherit;
        white-space: pre-wrap;
      }

      #scribeai-preview-box:focus {
        border-color: rgba(124, 58, 237, 0.5);
        background: rgba(255, 255, 255, 0.05);
      }

      .scribeai-action-group {
        display: flex;
        gap: 10px;
      }

      .scribeai-primary-btn {
        flex: 1;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
        font-family: inherit;
        outline: none;
      }

      .scribeai-primary-btn:hover {
        background: #059669;
      }

      .scribeai-secondary-btn {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #d1d5db;
        border-radius: 6px;
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
        outline: none;
      }

      .scribeai-secondary-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: white;
      }

      .scribeai-error-box {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.2);
        color: #fca5a5;
        font-size: 11px;
        border-radius: 8px;
        padding: 8px;
        line-height: 1.4;
      }

      .scribeai-hidden {
        display: none !important;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;

    // Root HTML template
    const scope = document.createElement('div');
    scope.className = 'scribeai-scope';
    scope.innerHTML = `
      <div id="scribeai-overlay" class="scribeai-hidden"></div>
      <button id="scribeai-trigger" class="scribeai-hidden" title="Improve with ScribeAI">
        <svg class="scribeai-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/>
          <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z"/>
        </svg>
      </button>
      
      <div id="scribeai-panel" class="scribeai-hidden">
        <div class="scribeai-header" id="scribeai-header">
          <div class="scribeai-title">ScribeAI Assistant <span style="font-size: 10px; font-weight: normal; color: #a78bfa; margin-left: 6px; opacity: 0.85; display: inline-block; vertical-align: middle;">powered by Gemini</span></div>
          <button id="scribeai-close" class="scribeai-close-btn">
            <svg class="scribeai-close-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        
        <!-- View 1: Inputs and Presets -->
        <div id="scribeai-input-view">
          <div class="scribeai-presets-label">Select Tone:</div>
          <div class="scribeai-chips">
            <button class="scribeai-chip active" data-tone="improve">
              <svg class="scribeai-chip-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/>
                <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z"/>
              </svg>
              <span>Refine</span>
            </button>
            <button class="scribeai-chip" data-tone="professional">
              <svg class="scribeai-chip-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <span>Business</span>
            </button>
            <button class="scribeai-chip" data-tone="casual">
              <svg class="scribeai-chip-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Casual</span>
            </button>
            <button class="scribeai-chip" data-tone="concise">
              <svg class="scribeai-chip-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <span>Short</span>
            </button>
            <button class="scribeai-chip" data-tone="expand">
              <svg class="scribeai-chip-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span>Expand</span>
            </button>
          </div>
          
          <div class="scribeai-form-group">
            <textarea id="scribeai-custom" placeholder="e.g. Translate to French, use bullet points..."></textarea>
          </div>
          
          <button id="scribeai-submit" class="scribeai-action-btn">Improve Writing</button>
        </div>
        
        <!-- View 2: Generation/Loading state -->
        <div id="scribeai-loading-view" class="scribeai-hidden">
          <div class="scribeai-pulse-ring">
            <div class="scribeai-double-spinner"></div>
          </div>
          <div class="scribeai-loading-text">ScribeAI is writing...</div>
        </div>

        <!-- View 3: Success checkmark state -->
        <div id="scribeai-success-view" class="scribeai-hidden">
          <div class="scribeai-success-checkmark">
            <div class="scribeai-check-icon"></div>
          </div>
          <div class="scribeai-success-text">Refinement Complete!</div>
        </div>
        
        <!-- View 4: Completed suggestion preview -->
        <div id="scribeai-result-view" class="scribeai-hidden">
          <div class="scribeai-preview-label">Suggested Version (Editable):</div>
          <div id="scribeai-preview-box" contenteditable="true" spellcheck="false"></div>
          
          <div class="scribeai-action-group">
            <button id="scribeai-insert" class="scribeai-primary-btn">Insert Text</button>
            <button id="scribeai-undo" class="scribeai-secondary-btn scribeai-hidden">Undo</button>
          </div>
        </div>
        
        <div id="scribeai-error" class="scribeai-error-box scribeai-hidden"></div>
      </div>
    `;

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(scope);

    // Bind DOM References
    overlay = shadowRoot.getElementById('scribeai-overlay');
    triggerBtn = shadowRoot.getElementById('scribeai-trigger');
    panel = shadowRoot.getElementById('scribeai-panel');
    header = shadowRoot.getElementById('scribeai-header');
    inputView = shadowRoot.getElementById('scribeai-input-view');
    loadingView = shadowRoot.getElementById('scribeai-loading-view');
    successView = shadowRoot.getElementById('scribeai-success-view');
    resultView = shadowRoot.getElementById('scribeai-result-view');
    submitBtn = shadowRoot.getElementById('scribeai-submit');
    closeBtn = shadowRoot.getElementById('scribeai-close');
    textareaCustom = shadowRoot.getElementById('scribeai-custom');
    previewBox = shadowRoot.getElementById('scribeai-preview-box');
    insertBtn = shadowRoot.getElementById('scribeai-insert');
    undoBtn = shadowRoot.getElementById('scribeai-undo');
    errorBox = shadowRoot.getElementById('scribeai-error');

    setupListeners();
  }

  // Event Listeners Setup
  function setupListeners() {
    // Backdrop click dismiss
    overlay.addEventListener('click', (e) => {
      console.log("ScribeAI: Backdrop clicked. Closing.");
      e.stopPropagation();
      hideAll();
    });

    // Floating Button click: Open Refinement Panel
    triggerBtn.addEventListener('click', (e) => {
      console.log("ScribeAI: Trigger button clicked!");
      e.stopPropagation();
      openPanel();
    });

    // Close Panel button
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hidePanel();
    });

    // Tone selection chips
    const chips = shadowRoot.querySelectorAll('.scribeai-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeTone = chip.getAttribute('data-tone');
      });
    });

    // Submit request to Background worker
    submitBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await triggerRefinement();
    });

    // Insert Text replacement
    insertBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      insertText();
    });

    // Undo action
    undoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      undoInsert();
    });

    // Click outside handler to dismiss floating elements
    document.addEventListener('click', (e) => {
      const host = document.getElementById('scribeai-host-root');
      if (host && host.contains(e.target)) return; // Inside extension UI
      if (activeElement && activeElement.contains(e.target)) return; // Inside target input
      
      hideAll();
    });

    // Periodically update active floating positions on scroll or window resize
    window.addEventListener('scroll', repositionElements, { passive: true });
    window.addEventListener('resize', repositionElements);
  }

  // Input detection triggers
  document.addEventListener('focusin', handleInputActivity);
  document.addEventListener('input', handleInputActivity);

  function handleInputActivity(e) {
    const target = e.target;
    const isTextarea = target.tagName === 'TEXTAREA';
    const isTextInput = target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'search');
    const isContentEditable = target.isContentEditable || target.getAttribute('contenteditable') === 'true';

    if (isTextarea || isTextInput || isContentEditable) {
      console.log("ScribeAI: Input activity detected on:", target);
      activeElement = target;
      wasContentEditable = isContentEditable;

      const text = getElementText(target);
      if (text.trim().length > 3) {
        initOverlay();
        // If panel is hidden, show the floating trigger
        if (panel.classList.contains('scribeai-hidden')) {
          repositionTrigger();
          triggerBtn.classList.remove('scribeai-hidden');
        } else {
          // If panel is open, keep it aligned
          repositionPanel();
        }
      } else {
        if (triggerBtn) triggerBtn.classList.add('scribeai-hidden');
      }
    }
  }

  // Position the floating action button
  function repositionTrigger() {
    if (!activeElement || !triggerBtn) return;
    const rect = activeElement.getBoundingClientRect();
    
    let top, left;
    const btnSize = 34;
    const padding = 6;

    if (rect.height < 36) {
      // Small/single-line inputs: place outside on the right
      top = rect.top + (rect.height - btnSize) / 2;
      left = rect.right + 4;
    } else {
      // Multi-line textareas: place inside bottom-right
      top = rect.bottom - btnSize - padding;
      left = rect.right - btnSize - padding;
      
      // Account for potential scrollbars
      if (activeElement.scrollHeight > activeElement.clientHeight) {
        left -= 12; // Adjust inward
      }
    }

    // Bind styling
    triggerBtn.style.top = `${top}px`;
    triggerBtn.style.left = `${left}px`;
  }

  // Position the main modal panel
  function repositionPanel() {
    if (!panel) return;
    // Keep it centered - CSS handles top/left/transform centering.
    panel.style.top = '';
    panel.style.left = '';
    panel.style.transform = '';
  }

  function repositionElements() {
    if (triggerBtn && !triggerBtn.classList.contains('scribeai-hidden')) {
      repositionTrigger();
    }
    if (panel && !panel.classList.contains('scribeai-hidden')) {
      repositionPanel();
    }
  }

  // Get active text
  function getElementText(el) {
    if (wasContentEditable) {
      return el.innerText || '';
    }
    return el.value || '';
  }

  // Set active text
  function setElementText(el, text) {
    if (wasContentEditable) {
      el.innerText = text;
    } else {
      el.value = text;
    }
    // Dispatch standard framework events
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Open the Panel UI
  function openPanel() {
    console.log("ScribeAI: openPanel starting. activeElement:", activeElement);
    if (!activeElement) {
      console.warn("ScribeAI: activeElement is null inside openPanel! Aborting.");
      return;
    }

    // 1. Instantly show the panel and highlight inputs for immediate feedback
    console.log("ScribeAI: Removing scribeai-hidden from panel...");
    overlay.classList.remove('scribeai-hidden');
    panel.classList.remove('scribeai-hidden');
    triggerBtn.classList.add('scribeai-hidden');
    
    // Reset views and classes
    panel.classList.remove('scribeai-compact');
    header.classList.remove('scribeai-hidden');
    inputView.classList.remove('scribeai-hidden');
    loadingView.classList.add('scribeai-hidden');
    successView.classList.add('scribeai-hidden');
    resultView.classList.add('scribeai-hidden');
    errorBox.classList.add('scribeai-hidden');
    
    textareaCustom.value = '';

    console.log("ScribeAI: Adding highlight class to active input...");
    activeElement.classList.add('scribeai-highlight-input');

    if (hasPendingUndo) {
      undoBtn.classList.remove('scribeai-hidden');
    } else {
      undoBtn.classList.add('scribeai-hidden');
    }

    repositionPanel();
    
    // Focus the custom input
    setTimeout(() => {
      if (textareaCustom) {
        textareaCustom.focus();
        textareaCustom.setSelectionRange(textareaCustom.value.length, textareaCustom.value.length);
      }
    }, 150);

    // 2. Fetch tone configurations fail-safely in background
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (settings) => {
          if (chrome.runtime.lastError) {
            console.warn("ScribeAI settings load error:", chrome.runtime.lastError.message);
            return;
          }
          const savedTone = settings?.defaultTone || 'improve';
          activeTone = savedTone;
          const chips = shadowRoot.querySelectorAll('.scribeai-chip');
          chips.forEach(chip => {
            if (chip.getAttribute('data-tone') === savedTone) {
              chip.classList.add('active');
            } else {
              chip.classList.remove('active');
            }
          });
        });
      }
    } catch (err) {
      console.warn("ScribeAI: Extension context is orphaned or reloaded. Please refresh the page.", err);
    }
  }

  // Call API for improving the text
  async function triggerRefinement() {
    if (!activeElement) return;

    // Capture text (prioritize active text selection if present)
    let textToImprove = '';
    originalSelectionStart = null;
    originalSelectionEnd = null;

    if (wasContentEditable) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
        textToImprove = selection.toString();
      } else {
        textToImprove = activeElement.innerText;
      }
    } else {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      if (start !== end && (end - start) > 0) {
        textToImprove = activeElement.value.substring(start, end);
        originalSelectionStart = start;
        originalSelectionEnd = end;
      } else {
        textToImprove = activeElement.value;
      }
    }

    if (!textToImprove.trim()) {
      showError("Please enter some text in the field first.");
      return;
    }

    // Store absolute backup of full field for global Undo history
    originalInputContent = wasContentEditable ? activeElement.innerHTML : activeElement.value;

    // Show loading & shrink panel to compact
    panel.classList.add('scribeai-compact');
    header.classList.add('scribeai-hidden');
    inputView.classList.add('scribeai-hidden');
    resultView.classList.add('scribeai-hidden');
    successView.classList.add('scribeai-hidden');
    errorBox.classList.add('scribeai-hidden');
    loadingView.classList.remove('scribeai-hidden');
    
    submitBtn.disabled = true;
    repositionPanel();

    const customText = textareaCustom.value.trim();

    // Send query to background worker
    chrome.runtime.sendMessage({
      action: 'IMPROVE_TEXT',
      text: textToImprove,
      tone: activeTone,
      customInstruction: customText
    }, (response) => {
      // Restore submit button state
      submitBtn.disabled = false;

      if (response && response.success) {
        // Hide loading
        loadingView.classList.add('scribeai-hidden');
        
        // Show success tick checkmark animation
        successView.classList.remove('scribeai-hidden');
        
        lastRefinedContent = response.text;
        previewBox.innerText = response.text;
        
        // Wait 1.2s for the animation to play
        setTimeout(() => {
          successView.classList.add('scribeai-hidden');
          panel.classList.remove('scribeai-compact');
          
          // Show results and header
          header.classList.remove('scribeai-hidden');
          resultView.classList.remove('scribeai-hidden');
          
          repositionPanel();
        }, 1200);
      } else {
        // If fail, restore panel and show error
        loadingView.classList.add('scribeai-hidden');
        panel.classList.remove('scribeai-compact');
        header.classList.remove('scribeai-hidden');
        inputView.classList.remove('scribeai-hidden');
        const errorMsg = response?.error || "Unable to refine writing. Please ensure your API settings are configured.";
        showError(errorMsg);
      }
    });
  }

  // Replace text in host input field
  function insertText() {
    if (!activeElement) return;

    const refinedText = previewBox.innerText;

    if (wasContentEditable) {
      // Replace entire innerText to ensure framework state integrity
      setElementText(activeElement, refinedText);
    } else {
      const hasSelection = originalSelectionStart !== null && originalSelectionEnd !== null;
      if (hasSelection) {
        const originalVal = activeElement.value;
        activeElement.value = originalVal.substring(0, originalSelectionStart) +
                              refinedText +
                              originalVal.substring(originalSelectionEnd);
        // Highlight the newly inserted selection
        activeElement.selectionStart = originalSelectionStart;
        activeElement.selectionEnd = originalSelectionStart + refinedText.length;
        
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        activeElement.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        setElementText(activeElement, refinedText);
      }
    }

    // Toggle Undo status
    hasPendingUndo = true;
    undoBtn.classList.remove('scribeai-hidden');
    
    // Dynamic micro-animation success on Insert button
    const prevText = insertBtn.textContent;
    insertBtn.textContent = "Inserted! ✓";
    insertBtn.style.background = "#047857";
    setTimeout(() => {
      insertBtn.textContent = prevText;
      insertBtn.style.background = "";
      hidePanel();
    }, 1200);
  }

  // Undo and restore original values
  function undoInsert() {
    if (!activeElement || !hasPendingUndo) return;

    if (wasContentEditable) {
      activeElement.innerHTML = originalInputContent;
    } else {
      activeElement.value = originalInputContent;
    }
    
    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    activeElement.dispatchEvent(new Event('change', { bubbles: true }));

    hasPendingUndo = false;
    undoBtn.classList.add('scribeai-hidden');

    const prevText = undoBtn.textContent;
    undoBtn.textContent = "Restored! ✓";
    setTimeout(() => {
      undoBtn.textContent = prevText;
      hidePanel();
    }, 1000);
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('scribeai-hidden');
    repositionPanel();
  }

  function hidePanel() {
    if (panel) panel.classList.add('scribeai-hidden');
    if (overlay) overlay.classList.add('scribeai-hidden');
    if (activeElement) {
      activeElement.classList.remove('scribeai-highlight-input');
    }
  }

  function hideAll() {
    if (triggerBtn) triggerBtn.classList.add('scribeai-hidden');
    if (panel) panel.classList.add('scribeai-hidden');
    if (overlay) overlay.classList.add('scribeai-hidden');
    if (activeElement) {
      activeElement.classList.remove('scribeai-highlight-input');
    }
  }
})();
