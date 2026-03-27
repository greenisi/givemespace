const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("agentOneDesktop", {
  platform: process.platform
});
