console.log("preloaded!");

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
    api: {
        createDB: () => ipcRenderer.invoke('createDB'),
        runDB: () => ipcRenderer.invoke('runDB'),
    },
    requires: {
        electron: null,//require('electron'),
    },
    sample: {
        sample: true
    }
})