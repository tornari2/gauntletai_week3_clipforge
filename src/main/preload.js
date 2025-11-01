const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Video import
  importVideo: () => ipcRenderer.invoke('import-video'),
  
  // Subtitle import
  importSubtitle: () => ipcRenderer.invoke('import-subtitle'),
  
  // Video metadata
  getVideoDuration: (filePath) => ipcRenderer.invoke('get-video-duration', filePath),
  getVideoMetadata: (filePath, fallbackDuration) => ipcRenderer.invoke('get-video-metadata', filePath, fallbackDuration),
  generateThumbnail: (filePath, outputPath) => ipcRenderer.invoke('generate-thumbnail', filePath, outputPath),
  
  // Removed processDroppedFile - drag & drop is disabled
  
  
  // Listen for dropped video events
  onVideoDropped: (callback) => {
    const handler = (event, videoData) => callback(videoData)
    ipcRenderer.on('video-dropped', handler)
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('video-dropped', handler)
    }
  },
  
  // Listen for dropped video errors
  onVideoDropError: (callback) => {
    const handler = (event, error) => callback(error)
    ipcRenderer.on('video-drop-error', handler)
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('video-drop-error', handler)
    }
  },
  
  // File dialogs
  saveDialog: () => ipcRenderer.invoke('save-dialog'),
  
  // Video export
  exportVideo: (options) => ipcRenderer.invoke('export-video', options),
  exportTimeline: (options) => ipcRenderer.invoke('export-timeline', options),
  exportTimelineWithSubtitles: (options) => ipcRenderer.invoke('export-timeline-with-subtitles', options),
  
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
  
  // Transcription APIs
  getOpenAIApiKey: () => ipcRenderer.invoke('get-openai-api-key'),
  setOpenAIApiKey: (apiKey) => ipcRenderer.invoke('set-openai-api-key', apiKey),
  transcribeAudio: (options) => ipcRenderer.invoke('transcribe-audio', options),
  
  // Transcription event listeners
  onTranscriptionProgress: (callback) => {
    ipcRenderer.on('transcription-progress', (event, data) => callback(data))
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
