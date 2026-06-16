const { app, BrowserWindow, ipcMain, screen, clipboard } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Configure autoUpdater logging to console
autoUpdater.logger = console;

// Disable Chromium sandboxing to prevent network blocks in translocated/sandboxed Gatekeeper contexts
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 350,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    hasShadow: true,
    vibrancy: 'hud',
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.error(`[RENDERER CONSOLE] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const { setupShortcut } = require('./setup-shortcut');

// Ensure the app displays properly and transparent windows are supported
app.whenReady().then(() => {
  setupShortcut();
  createWindow();

  // Check for updates and notify the user natively
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error("Failed to check for updates:", err);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC communication channels
ipcMain.on('resize-window', (event, width, height) => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    const w = parseInt(width, 10) || bounds.width;
    const h = parseInt(height, 10) || bounds.height;

    const display = screen.getDisplayMatching(bounds);
    const area = display.bounds;

    const x = Math.round(area.x + (area.width - w) / 2);
    const y = Math.round(area.y + (area.height - h) / 2);

    mainWindow.setBounds({
      x: x,
      y: y,
      width: w,
      height: h
    }, true); // Smooth animation on macOS
  }
});

ipcMain.on('insert-text', (event, text) => {
  clipboard.writeText(text);
  process.stdout.write(text, () => {
    app.exit(0);
  });
});

ipcMain.on('close-app', () => {
  app.exit(1);
});

// Send arguments to renderer after load
ipcMain.on('get-init-text', (event) => {
  const args = process.argv.slice(1).filter(arg => 
    !arg.startsWith('--') && 
    arg !== '.' && 
    !arg.endsWith('main.js') && 
    !arg.includes('/node_modules/')
  );
  const inputText = args[args.length - 1] || "";
  event.reply('init-text', inputText);
});

const API_KEY = "AQ.Ab8RN6J4v2xilWoei73ZIZ0ChIu-WQ2Q16OUEH0MYBDpWXKKcQ";
const MODEL = "gemini-flash-latest";

ipcMain.handle('run-api-call', async (event, { provider, systemPrompt, initialText, geminiKey, geminiModel }) => {
  try {
    if (provider === 'gemini' || provider === 'gemini-custom') {
      let apiKey = API_KEY;
      let model = MODEL;

      if (provider === 'gemini-custom') {
        apiKey = geminiKey ? geminiKey.trim() : "";
        model = geminiModel ? geminiModel.trim() : "gemini-1.5-flash";

        if (!apiKey) {
          throw new Error("Gemini API Key is missing. Please configure it in settings.");
        }

        // Map to active aliases to prevent 404 errors
        if (model === 'gemini-1.5-flash' || model === 'gemini-1.5-flash-latest') {
          model = 'gemini-flash-latest';
        } else if (model === 'gemini-1.5-pro' || model === 'gemini-1.5-pro-latest') {
          model = 'gemini-pro-latest';
        }
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: `Text to rewrite:\n${initialText}` }
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
      };

      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      } catch (fetchErr) {
        throw new Error("Failed to connect to Gemini API. Please check your internet connection.");
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = (errData.error && errData.error.message) || `HTTP error ${response.status}`;
        throw new Error(`Gemini Error: ${errMsg}`);
      }

      const data = await response.json();
      try {
        return data.candidates[0].content.parts[0].text;
      } catch (e) {
        throw new Error("Received an empty or malformed response from Gemini.");
      }
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    console.error("API Call execution failed:", error);
    throw error;
  }
});

ipcMain.handle('google-auth', async (event) => {
  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 600,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const authUrl = `https://pqcqtpvmgziejnauidsu.supabase.co/auth/v1/authorize?provider=google&redirect_to=http://localhost`;
    authWindow.loadURL(authUrl);

    let resolved = false;

    function handleCallback(url) {
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
        try {
          const urlObj = new URL(url);
          const hash = urlObj.hash;
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            resolved = true;
            resolve({ accessToken, refreshToken });
            authWindow.close();
          }
        } catch (err) {
          console.error("Error parsing auth callback URL:", err);
        }
      }
    }

    authWindow.webContents.on('will-navigate', (e, url) => {
      handleCallback(url);
    });

    authWindow.webContents.on('will-redirect', (e, url) => {
      handleCallback(url);
    });

    authWindow.on('closed', () => {
      if (!resolved) {
        reject(new Error('Window closed by user before authentication completed.'));
      }
    });
  });
});

