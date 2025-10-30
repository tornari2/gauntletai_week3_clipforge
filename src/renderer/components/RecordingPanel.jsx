import React, { useState, useEffect } from 'react'
import SourceSelector from './SourceSelector'
import RecordingControls from './RecordingControls'

const RecordingPanel = ({ onRecordingComplete }) => {
  const [videoSources, setVideoSources] = useState([])
  const [audioSources, setAudioSources] = useState([])
  const [selectedVideoSource, setSelectedVideoSource] = useState(null)
  const [selectedAudioSource, setSelectedAudioSource] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load available sources on component mount
  useEffect(() => {
    loadSources()
  }, [])

  const loadSources = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load video sources (screens/windows)
      const videoSourcesData = await window.electronAPI.listVideoSources()
      setVideoSources(videoSourcesData)

      // Load audio sources (microphones)
      const audioSourcesData = await window.electronAPI.listAudioSources()
      setAudioSources(audioSourcesData)

      // Also get audio devices from navigator.mediaDevices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            id: device.deviceId,
            name: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
            type: 'microphone'
          }))
        setAudioSources(audioInputs)
      } catch (err) {
        console.warn('Could not enumerate audio devices:', err)
        // If audio permission is denied, show a helpful message
        if (err.name === 'NotAllowedError') {
          setError('Microphone permission denied. Please grant permission in System Preferences > Security & Privacy > Microphone.')
          return
        }
      }

    } catch (err) {
      console.error('Error loading sources:', err)
      
      // Provide specific error messages for common permission issues
      if (err.message.includes('Screen recording permission denied')) {
        setError('Screen recording permission denied. Please grant permission in System Preferences > Security & Privacy > Screen Recording.')
      } else if (err.message.includes('Permission denied')) {
        setError('Recording permission denied. Please check System Preferences > Security & Privacy.')
      } else {
        setError(`Failed to load recording sources: ${err.message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecordingComplete = (recordingData) => {
    console.log('Recording completed:', recordingData)
    if (onRecordingComplete) {
      onRecordingComplete(recordingData)
    }
  }

  // Check if user is trying to record window that includes the app
  const checkForSelfRecording = () => {
    if (selectedVideoSource) {
      // Only check for self-recording if it's a window source, not a screen source
      if (selectedVideoSource.type === 'window') {
        const sourceName = selectedVideoSource.name.toLowerCase()
        if (sourceName.includes('clipedit') || sourceName.includes('electron') || 
            sourceName.includes('cursor') || sourceName.includes('vite')) {
          return true
        }
      }
    }
    return false
  }

  const isSelfRecording = checkForSelfRecording()

  if (isLoading) {
    return (
      <div className="recording-panel">
        <div className="recording-panel-header">
          <h3>🎥 Recording</h3>
        </div>
        <div className="recording-panel-content">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading recording sources...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="recording-panel">
        <div className="recording-panel-header">
          <h3>🎥 Recording</h3>
        </div>
        <div className="recording-panel-content">
          <div className="error-state">
            <p className="error-message">{error}</p>
            
            {error.includes('permission') && (
              <div className="permission-guide">
                <h4>How to Grant Permissions:</h4>
                <ol>
                  <li>Open <strong>System Preferences</strong> (or System Settings on macOS 13+)</li>
                  <li>Go to <strong>Security & Privacy</strong></li>
                  <li>Click the <strong>Privacy</strong> tab</li>
                  <li>Select <strong>Screen Recording</strong> from the left sidebar</li>
                  <li>Check the box next to <strong>ClipEdit</strong> (or your terminal app if running in dev mode)</li>
                  <li>If you don't see ClipEdit, try running the app again and the permission dialog should appear</li>
                  <li>Repeat for <strong>Microphone</strong> if you want to record audio</li>
                </ol>
                <p className="permission-note">
                  <strong>Note:</strong> You may need to restart the app after granting permissions.
                </p>
              </div>
            )}
            
            <button 
              className="btn btn-secondary"
              onClick={loadSources}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="recording-panel">
      <div className="recording-panel-header">
        <h3>🎥 Recording</h3>
      </div>
      
        <div className="recording-panel-content">
          <SourceSelector
            videoSources={videoSources}
            audioSources={audioSources}
            selectedVideoSource={selectedVideoSource}
            selectedAudioSource={selectedAudioSource}
            onVideoSourceSelect={setSelectedVideoSource}
            onAudioSourceSelect={setSelectedAudioSource}
          />
          
          {isSelfRecording && (
            <div className="self-recording-warning">
              <div className="warning-icon">⚠️</div>
              <div className="warning-content">
                <h4>Cannot Record This Window</h4>
                <p>You're trying to record the window containing this app, which will cause issues.</p>
                <div className="warning-solutions">
                  <p><strong>Solutions:</strong></p>
                  <ul>
                    <li>Select a different screen from the dropdown</li>
                    <li>Minimize this app and select the desktop screen</li>
                    <li>Use a different monitor if available</li>
                  </ul>
                  <button 
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      if (window.electronAPI && window.electronAPI.minimizeWindow) {
                        window.electronAPI.minimizeWindow()
                      }
                    }}
                    style={{ marginTop: '8px' }}
                  >
                    📱 Minimize App
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <RecordingControls
            selectedVideoSource={selectedVideoSource}
            selectedAudioSource={selectedAudioSource}
            onRecordingComplete={handleRecordingComplete}
            disabled={isSelfRecording}
          />
        </div>
    </div>
  )
}

export default RecordingPanel

