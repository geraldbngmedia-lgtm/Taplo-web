const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("taplo", {
  getDesktopSources: () => ipcRenderer.invoke("get-desktop-sources"),
  loadWorkspaceData: () => ipcRenderer.invoke("workspace:load"),
  saveWorkspaceData: (data) => ipcRenderer.invoke("workspace:save", data),
});
