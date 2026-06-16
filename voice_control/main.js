const { app, BrowserWindow, ipcMain, systemPreferences } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 380,
    frame: false,
    transparent: true,
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

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Ask for media access on macOS
  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone').then(granted => {
      console.log('Microphone access granted:', granted);
    });
    systemPreferences.askForMediaAccess('camera').then(granted => {
      console.log('Camera access granted:', granted);
    });
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler to close the app
ipcMain.on('close-app', () => {
  app.quit();
});

ipcMain.on('show-window', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('hide-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

// IPC Handler to run AppleScript
ipcMain.handle('run-applescript', async (event, script) => {
  return new Promise((resolve) => {
    // Escape single quotes for zsh execution
    const escapedScript = script.replace(/'/g, "'\\''");
    exec(`osascript -e '${escapedScript}'`, (error, stdout, stderr) => {
      if (error) {
        console.error('AppleScript error:', stderr);
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, output: stdout.trim() });
      }
    });
  });
});

// IPC Handler to run Shell commands
ipcMain.handle('run-shell', async (event, command) => {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Shell error:', stderr);
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, output: stdout.trim() });
      }
    });
  });
});
