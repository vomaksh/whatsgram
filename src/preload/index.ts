import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('loadingAPI', {
  onConnectionStatusChange: (callback: (status: string) => void) => {
    ipcRenderer.on('connection-status', (_event, status: string) => callback(status))
  },
  retry: () => ipcRenderer.send('retry-load')
})
