const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('resumeApp', {
  getDefaultStandard: () => ipcRenderer.invoke('app:get-default-standard'),
  getDeepSeekModels: () => ipcRenderer.invoke('app:get-deepseek-models'),
  loadKey: () => ipcRenderer.invoke('settings:load-key'),
  saveKey: (apiKey) => ipcRenderer.invoke('settings:save-key', apiKey),
  clearKey: () => ipcRenderer.invoke('settings:clear-key'),
  saveModel: (modelKey) => ipcRenderer.invoke('settings:save-model', modelKey),
  loadStandard: () => ipcRenderer.invoke('standard:load'),
  saveStandard: (standard) => ipcRenderer.invoke('standard:save', standard),
  clearStandard: () => ipcRenderer.invoke('standard:clear'),
  selectAndParseResume: () => ipcRenderer.invoke('resume:select-and-parse'),
  analyze: (payload) => ipcRenderer.invoke('ai:analyze', payload),
  loadLeaderboard: () => ipcRenderer.invoke('leaderboard:load'),
  saveLeaderboard: (items) => ipcRenderer.invoke('leaderboard:save', items),
  clearLeaderboard: () => ipcRenderer.invoke('leaderboard:clear'),
  openDataFolder: () => ipcRenderer.invoke('app:open-data-folder')
});
