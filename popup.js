const SUPABASE_URL = "https://pqcqtpvmgziejnauidsu.supabase.co";
const SUPABASE_KEY = "sb_publishable_8SEXfi2S0YYKH1_YAmT3fQ_B3CPD1Fl";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const apiProviderSelect = document.getElementById('api-provider');
  const openaiSettings = document.getElementById('openai-settings');
  const geminiSettings = document.getElementById('gemini-settings');
  const nvidiaSettings = document.getElementById('nvidia-settings');
  const ollamaSettings = document.getElementById('ollama-settings');
  
  const openaiKeyInput = document.getElementById('openai-key');
  const openaiModelSelect = document.getElementById('openai-model');
  const geminiKeyInput = document.getElementById('gemini-key');
  const geminiModelSelect = document.getElementById('gemini-model');
  const nvidiaKeyInput = document.getElementById('nvidia-key');
  const nvidiaModelSelect = document.getElementById('nvidia-model');
  const ollamaUrlInput = document.getElementById('ollama-url');
  const ollamaModelInput = document.getElementById('ollama-model');
  
  const defaultToneSelect = document.getElementById('default-tone');
  const customInstructionInput = document.getElementById('custom-instruction');
  
  const saveBtn = document.getElementById('save-btn');
  const saveSuccess = document.getElementById('save-success');
  const statusBadge = document.getElementById('status-badge');
  
  const toggleOpenaiVis = document.getElementById('toggle-openai-visibility');
  const toggleGeminiVis = document.getElementById('toggle-gemini-visibility');
  const toggleNvidiaVis = document.getElementById('toggle-nvidia-visibility');

  // Auth DOM Elements
  const popupAccountLoggedIn = document.getElementById('popup-account-logged-in');
  const popupAccountLoggedOut = document.getElementById('popup-account-logged-out');
  const popupUserName = document.getElementById('popup-user-name');
  const popupUserEmail = document.getElementById('popup-user-email');
  const popupLogoutBtn = document.getElementById('popup-logout-btn');
  
  const popupTabSignin = document.getElementById('popup-tab-signin');
  const popupTabSignup = document.getElementById('popup-tab-signup');
  const popupFormSignin = document.getElementById('popup-form-signin');
  const popupFormSignup = document.getElementById('popup-form-signup');
  
  const popupSigninEmail = document.getElementById('popup-signin-email');
  const popupSigninPassword = document.getElementById('popup-signin-password');
  const popupSigninError = document.getElementById('popup-signin-error');
  const popupSubmitSignin = document.getElementById('popup-submit-signin');
  
  const popupSignupName = document.getElementById('popup-signup-name');
  const popupSignupEmail = document.getElementById('popup-signup-email');
  const popupSignupPassword = document.getElementById('popup-signup-password');
  const popupSignupError = document.getElementById('popup-signup-error');
  const popupSubmitSignup = document.getElementById('popup-submit-signup');
  const popupGoogleBtn = document.getElementById('popup-google-btn');

  // Toggle API Settings Display based on provider
  function toggleSettingsDisplay(provider) {
    openaiSettings.classList.add('hidden');
    geminiSettings.classList.add('hidden');
    nvidiaSettings.classList.add('hidden');
    ollamaSettings.classList.add('hidden');

    if (provider === 'openai') {
      openaiSettings.classList.remove('hidden');
    } else if (provider === 'gemini') {
      geminiSettings.classList.remove('hidden');
    } else if (provider === 'nvidia') {
      nvidiaSettings.classList.remove('hidden');
    } else if (provider === 'ollama') {
      ollamaSettings.classList.remove('hidden');
    }
    updateStatusBadge(provider);
  }

  function updateStatusBadge(provider) {
    statusBadge.className = 'badge';
    if (provider === 'demo') {
      statusBadge.classList.add('demo');
      statusBadge.textContent = 'Demo Mode';
    } else {
      statusBadge.classList.add('live');
      statusBadge.textContent = 'Live API';
    }
  }

  // Load saved settings
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
  ], async (settings) => {
    if (settings.apiProvider) {
      apiProviderSelect.value = settings.apiProvider;
      toggleSettingsDisplay(settings.apiProvider);
    } else {
      apiProviderSelect.value = 'gemini';
      toggleSettingsDisplay('gemini'); // Default to Google Gemini mode
    }

    if (settings.openaiKey) openaiKeyInput.value = settings.openaiKey;
    if (settings.openaiModel) openaiModelSelect.value = settings.openaiModel;
    if (settings.geminiKey) geminiKeyInput.value = settings.geminiKey;
    if (settings.geminiModel) geminiModelSelect.value = settings.geminiModel;
    if (settings.nvidiaKey) nvidiaKeyInput.value = settings.nvidiaKey;
    if (settings.nvidiaModel) nvidiaModelSelect.value = settings.nvidiaModel;
    
    // Set Ollama defaults if not configured
    ollamaUrlInput.value = settings.ollamaUrl || 'http://localhost:11434';
    ollamaModelInput.value = settings.ollamaModel || 'llama3';
    
    if (settings.defaultTone) defaultToneSelect.value = settings.defaultTone;
    if (settings.customInstruction) customInstructionInput.value = settings.customInstruction;
    await updateAccountDisplay();
  });

  async function updateAccountDisplay() {
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        const name = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        popupAccountLoggedIn.style.display = 'flex';
        popupAccountLoggedOut.style.display = 'none';
        popupUserName.textContent = `Logged in as ${name}`;
        popupUserEmail.textContent = session.user.email;
      } else {
        popupAccountLoggedIn.style.display = 'none';
        popupAccountLoggedOut.style.display = 'flex';
      }
    } catch (e) {
      console.error("Error getting session in popup:", e);
      popupAccountLoggedIn.style.display = 'none';
      popupAccountLoggedOut.style.display = 'flex';
    }
  }

  // Watch for provider change
  apiProviderSelect.addEventListener('change', (e) => {
    toggleSettingsDisplay(e.target.value);
  });

  // Password visibility triggers
  function setupPasswordToggle(button, input) {
    const eyeSvg = `<svg class="toggle-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
    const eyeOffSvg = `<svg class="toggle-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

    button.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        button.innerHTML = eyeOffSvg;
      } else {
        input.type = 'password';
        button.innerHTML = eyeSvg;
      }
    });
  }
  setupPasswordToggle(toggleOpenaiVis, openaiKeyInput);
  setupPasswordToggle(toggleGeminiVis, geminiKeyInput);
  setupPasswordToggle(toggleNvidiaVis, nvidiaKeyInput);

  // Save Config
  saveBtn.addEventListener('click', () => {
    const provider = apiProviderSelect.value;
    const config = {
      apiProvider: provider,
      openaiKey: openaiKeyInput.value.trim(),
      openaiModel: openaiModelSelect.value,
      geminiKey: geminiKeyInput.value.trim(),
      geminiModel: geminiModelSelect.value,
      nvidiaKey: nvidiaKeyInput.value.trim(),
      nvidiaModel: nvidiaModelSelect.value,
      ollamaUrl: ollamaUrlInput.value.trim() || 'http://localhost:11434',
      ollamaModel: ollamaModelInput.value.trim() || 'llama3',
      defaultTone: defaultToneSelect.value,
      customInstruction: customInstructionInput.value.trim()
    };

    // Show loading state
    saveBtn.disabled = true;
    const btnText = saveBtn.querySelector('.btn-text');
    const spinner = saveBtn.querySelector('.spinner');
    btnText.textContent = 'Saving...';
    spinner.classList.remove('hidden');

    chrome.storage.local.set(config, () => {
      setTimeout(() => {
        // Restore button state
        saveBtn.disabled = false;
        btnText.textContent = 'Save Settings';
        spinner.classList.add('hidden');
        
        // Show success indicator
        saveSuccess.classList.remove('hidden');
        
        // Hide success indicator after 3 seconds
        setTimeout(() => {
          saveSuccess.classList.add('hidden');
        }, 3000);
      }, 500);
    });
  });

  // Auth Tab Toggles
  if (popupTabSignin && popupTabSignup) {
    popupTabSignin.addEventListener('click', () => {
      popupTabSignin.style.borderBottomColor = 'var(--accent)';
      popupTabSignin.style.color = 'var(--accent)';
      popupTabSignup.style.borderBottomColor = 'transparent';
      popupTabSignup.style.color = 'var(--muted)';
      popupFormSignin.style.display = 'flex';
      popupFormSignup.style.display = 'none';
      popupSigninError.textContent = '';
    });

    popupTabSignup.addEventListener('click', () => {
      popupTabSignup.style.borderBottomColor = 'var(--accent)';
      popupTabSignup.style.color = 'var(--accent)';
      popupTabSignin.style.borderBottomColor = 'transparent';
      popupTabSignin.style.color = 'var(--muted)';
      popupFormSignup.style.display = 'flex';
      popupFormSignin.style.display = 'none';
      popupSignupError.textContent = '';
    });
  }

  // Sign In Handler
  if (popupSubmitSignin) {
    popupSubmitSignin.addEventListener('click', async () => {
      const email = popupSigninEmail.value.trim();
      const password = popupSigninPassword.value;
      
      if (!email || !password) {
        popupSigninError.textContent = 'Please fill in all fields.';
        return;
      }
      
      popupSigninError.style.color = "";
      popupSigninError.textContent = "";
      popupSubmitSignin.disabled = true;
      const originalText = popupSubmitSignin.textContent;
      popupSubmitSignin.textContent = "Signing In...";
      
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password
        });
        
        if (error) {
          popupSigninError.textContent = error.message;
        } else {
          await updateAccountDisplay();
          popupSigninEmail.value = '';
          popupSigninPassword.value = '';
          popupSigninError.textContent = '';
        }
      } catch (err) {
        popupSigninError.textContent = "Connection error. Please try again.";
      } finally {
        popupSubmitSignin.disabled = false;
        popupSubmitSignin.textContent = originalText;
      }
    });
  }

  // Sign Up Handler
  if (popupSubmitSignup) {
    popupSubmitSignup.addEventListener('click', async () => {
      const name = popupSignupName.value.trim();
      const email = popupSignupEmail.value.trim();
      const password = popupSignupPassword.value;
      
      if (!name || !email || !password) {
        popupSignupError.textContent = 'Please fill in all fields.';
        return;
      }
      
      if (password.length < 6) {
        popupSignupError.textContent = 'Password must be at least 6 characters.';
        return;
      }
      
      popupSignupError.style.color = "";
      popupSignupError.textContent = "";
      popupSubmitSignup.disabled = true;
      const originalText = popupSubmitSignup.textContent;
      popupSubmitSignup.textContent = "Creating Account...";
      
      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              full_name: name
            }
          }
        });
        
        if (error) {
          popupSignupError.textContent = error.message;
        } else {
          if (data.session) {
            await updateAccountDisplay();
            popupSignupName.value = '';
            popupSignupEmail.value = '';
            popupSignupPassword.value = '';
            popupSignupError.textContent = '';
          } else {
            popupSignupError.style.color = "var(--success)";
            popupSignupError.textContent = 'Sign up successful! Please check your email to verify.';
          }
        }
      } catch (err) {
        popupSignupError.textContent = "Connection error. Please try again.";
      } finally {
        popupSubmitSignup.disabled = false;
        popupSubmitSignup.textContent = originalText;
      }
    });
  }

  // Google Sign In Handler
  if (popupGoogleBtn) {
    popupGoogleBtn.addEventListener('click', async () => {
      popupSigninError.textContent = "";
      popupSignupError.textContent = "";
      
      const originalText = popupGoogleBtn.innerHTML;
      popupGoogleBtn.disabled = true;
      popupGoogleBtn.querySelector('span').textContent = "Signing In...";
      
      try {
        const redirectUrl = chrome.identity.getRedirectURL();
        const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
        
        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        }, async (responseUrl) => {
          if (chrome.runtime.lastError || !responseUrl) {
            const errMsg = (chrome.runtime.lastError && chrome.runtime.lastError.message) || "Authentication failed or cancelled.";
            popupSigninError.textContent = errMsg;
            popupGoogleBtn.disabled = false;
            popupGoogleBtn.innerHTML = originalText;
            return;
          }
          
          try {
            const urlObj = new URL(responseUrl);
            const params = new URLSearchParams(urlObj.hash.substring(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            
            if (accessToken && refreshToken) {
              const { data, error } = await supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (error) {
                popupSigninError.textContent = error.message;
              } else {
                await updateAccountDisplay();
              }
            } else {
              popupSigninError.textContent = "Failed to parse credentials from Google response.";
            }
          } catch (parseErr) {
            popupSigninError.textContent = "Error processing sign-in result.";
          } finally {
            popupGoogleBtn.disabled = false;
            popupGoogleBtn.innerHTML = originalText;
          }
        });
      } catch (err) {
        popupSigninError.textContent = "Identity provider launch failed.";
        popupGoogleBtn.disabled = false;
        popupGoogleBtn.innerHTML = originalText;
      }
    });
  }

  // Log Out Handler
  if (popupLogoutBtn) {
    popupLogoutBtn.addEventListener('click', async () => {
      try {
        await supabaseClient.auth.signOut();
        await updateAccountDisplay();
      } catch (err) {
        console.error("Error signing out:", err);
      }
    });
  }
});
