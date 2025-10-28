const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Video import
  importVideo: () => ipcRenderer.invoke('import-video'),
  
  // Video metadata
  getVideoDuration: (filePath) => ipcRenderer.invoke('get-video-duration', filePath),
  
  // Process dropped files
  processDroppedFile: (fileName, filePath) => ipcRenderer.invoke('process-dropped-file', { fileName, filePath }),
  
  
  // Listen for dropped video events
  onVideoDropped: (callback) => {
    ipcRenderer.on('video-dropped', (event, videoData) => callback(videoData))
  },
  
  // Listen for dropped video errors
  onVideoDropError: (callback) => {
    ipcRenderer.on('video-drop-error', (event, error) => callback(error))
  },
  
  // File dialogs
  saveDialog: () => ipcRenderer.invoke('save-dialog'),
  
  // Video export
  exportVideo: (options) => ipcRenderer.invoke('export-video', options),
  
  // Export event listeners
  onExportProgress: (callback) => {
    ipcRenderer.on('export-progress', (event, data) => callback(data))
  },
  
  onExportComplete: (callback) => {
    ipcRenderer.on('export-complete', (event) => callback())
  },
  
  onExportError: (callback) => {
    ipcRenderer.on('export-error', (event, error) => callback(error))
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
})
