// Standalone Electron runner for WebLLM test suite
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile(path.join(__dirname, 'test-webllm.html'));

  // Capture console output from the renderer
  win.webContents.on('console-message', (event, level, message) => {
    console.log(message);

    // Auto-close when tests finish
    if (message.startsWith('__TEST_COMPLETE__')) {
      setTimeout(() => {
        app.exit(0);
      }, 2000);
    }
  });
});
