const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zcodeSwitcher', {
  getState: () => ipcRenderer.invoke('state:get'),
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  createProfile: (name) => ipcRenderer.invoke('profiles:create', name),
  autoSyncProfile: () => ipcRenderer.invoke('profiles:auto-sync'),
  updateProfile: (id) => ipcRenderer.invoke('profiles:update', id),
  switchProfile: (id, launchAfter) => ipcRenderer.invoke('profiles:switch', id, launchAfter),
  deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', id),
  stopZCode: () => ipcRenderer.invoke('zcode:stop'),
  launchZCode: () => ipcRenderer.invoke('zcode:launch')
});
