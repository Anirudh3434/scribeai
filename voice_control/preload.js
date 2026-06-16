const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeApp: () => ipcRenderer.send('close-app'),
  runAppleScript: (script) => ipcRenderer.invoke('run-applescript', script),
  runShell: (command) => ipcRenderer.invoke('run-shell', command),
  showWindow: () => ipcRenderer.send('show-window'),
  hideWindow: () => ipcRenderer.send('hide-window')
});
