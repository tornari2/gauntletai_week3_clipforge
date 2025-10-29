const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Video import
  importVideo: () => ipcRenderer.invoke('import-video'),
  
  // Video metadata
  getVideoDuration: (filePath) => ipcRenderer.invoke('get-video-duration', filePath),
  getVideoMetadata: (filePath, fallbackDuration) => ipcRenderer.invoke('get-video-metadata', filePath, fallbackDuration),
  generateThumbnail: (filePath, outputPath) => ipcRenderer.invoke('generate-thumbnail', filePath, outputPath),
  
  // Removed processDroppedFile - drag & drop is disabled
  
  
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
  
  // Recording APIs
  listVideoSources: () => ipcRenderer.invoke('list-video-sources'),
  listAudioSources: () => ipcRenderer.invoke('list-audio-sources'),
  startScreenRecording: (sourceId) => ipcRenderer.invoke('start-screen-recording', sourceId),
  startWebcamRecording: (deviceId) => ipcRenderer.invoke('start-webcam-recording', deviceId),
  startPipRecording: (sourceId, deviceId) => ipcRenderer.invoke('start-pip-recording', sourceId, deviceId),
  stopRecording: (recordingData) => ipcRenderer.invoke('stop-recording', recordingData),
  saveRecordingFile: (arrayBuffer, fileName) => ipcRenderer.invoke('save-recording-file', arrayBuffer, fileName),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  restoreWindow: () => ipcRenderer.invoke('restore-window'),
  
  // Recording event listeners
  onScreenRecordingSource: (callback) => {
    ipcRenderer.on('screen-recording-source', (event, data) => callback(data))
  },
  
  onWebcamRecordingDevice: (callback) => {
    ipcRenderer.on('webcam-recording-device', (event, data) => callback(data))
  },
  
  onPipRecordingSources: (callback) => {
    ipcRenderer.on('pip-recording-sources', (event, data) => callback(data))
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
})
