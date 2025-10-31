import React, { useState, useCallback } from 'react'
import FileImport from './FileImport'
import RecordingPanel from './RecordingPanel'

const MediaLibrary = ({ clips, selectedClip, onClipSelect, onClipDelete, onVideoImported, onClipDragStart, onRecordingComplete }) => {
  const [showRecordingModal, setShowRecordingModal] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingType, setRecordingType] = useState(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const stopRecordingRef = React.useRef(null)
  const recordingIntervalRef = React.useRef(null)

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatResolution = (width, height) => {
    if (!width || !height) return 'Unknown'
    return `${width}×${height}`
  }

  const handleRecordingComplete = (recordingData) => {
    setShowRecordingModal(false)
    setIsRecording(false)
    setRecordingType(null)
    setRecordingTime(0)
    stopRecordingRef.current = null
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
    if (onRecordingComplete) {
      onRecordingComplete(recordingData)
    }
  }
  
  const handleRecordingStarted = useCallback((type, stopFn) => {
    // Close modal when recording starts
    console.log('MediaLibrary: Recording started, type:', type, 'stopFn:', typeof stopFn)
    setShowRecordingModal(false)
    setIsRecording(true)
    setRecordingType(type)
    setRecordingTime(0)
    stopRecordingRef.current = stopFn
    
    // Start timer in MediaLibrary
    const startTime = Date.now()
    recordingIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setRecordingTime(elapsed)
    }, 100)
  }, [])
  
  const handleRecordingTimeUpdate = useCallback((time) => {
    // This is called from RecordingControls, but we're managing timer here now
    // Keeping for compatibility but timer is managed in handleRecordingStarted
  }, [])
  
  const handleStopRecording = useCallback(() => {
    console.log('MediaLibrary: Stop button clicked, stopFn exists:', !!stopRecordingRef.current)
    if (stopRecordingRef.current) {
      console.log('MediaLibrary: Calling stop function')
      stopRecordingRef.current()
    } else {
      console.error('MediaLibrary: No stop function available!')
    }
  }, [])

  // Listen for dropped video events from main process
  React.useEffect(() => {
    if (!window.electronAPI) return
    
    const handleVideoDropped = (videoData) => {
      console.log('MediaLibrary: Received dropped video from main process:', videoData)
      onVideoImported(videoData)
    }
    
    const handleVideoDropError = (error) => {
      console.error('MediaLibrary: Video drop error:', error)
      alert(`Failed to import video: ${error}`)
    }
    
    // Get cleanup functions
    const cleanupDropped = window.electronAPI.onVideoDropped?.(handleVideoDropped)
    const cleanupError = window.electronAPI.onVideoDropError?.(handleVideoDropError)
    
    // Cleanup: remove listeners
    return () => {
      cleanupDropped?.()
      cleanupError?.()
    }
  }, [onVideoImported])

  return (
    <div className="timeline media-library">
      <div className="timeline-header media-library-header">
        <h3 className="timeline-title">Media Library</h3>
      </div>
      
      {clips.length === 0 ? (
        <div className="timeline-empty">
          <div className="empty-icon">📁</div>
          <p>No media imported yet</p>
          <p className="text-muted">Click the import button to add videos</p>
        </div>
      ) : (
        <div className="timeline-container">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className={`timeline-clip ${selectedClip?.id === clip.id ? 'selected' : ''} preview-only`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(clip))
                e.dataTransfer.effectAllowed = 'copy'
                if (onClipDragStart) {
                  onClipDragStart(clip)
                }
              }}
            >
              <div className="timeline-clip-content" onClick={() => onClipSelect(clip)}>
                <div className="timeline-clip-header">
                  <div className="timeline-clip-name" title={clip.fileName}>
                    {clip.isRecording && <span className="recording-badge">🎥</span>}
                    {clip.fileName.length > 35 
                      ? clip.fileName.substring(0, 35) + '...' 
                      : clip.fileName
                    }
                  </div>
                </div>
                <div className="timeline-clip-body">
                  <div className="timeline-clip-thumbnail">
                    {clip.thumbnailPath ? (
                      <img 
                        src={`file://${clip.thumbnailPath}`}
                        alt={clip.fileName}
                        className="thumbnail-image"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div className="thumbnail-placeholder" style={{ display: clip.thumbnailPath ? 'none' : 'flex' }}>
                      🎬
                    </div>
                  </div>
                  <div className="timeline-clip-metadata">
                    <div className="metadata-item">
                      <span className="metadata-label">Dur:</span>
                      <span className="metadata-value">{formatDuration(clip.duration)}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Res:</span>
                      <span className="metadata-value">{formatResolution(clip.width, clip.height)}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Size:</span>
                      <span className="metadata-value">{formatFileSize(clip.fileSize)}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Codec:</span>
                      <span className="metadata-value">{clip.codec || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                className="timeline-clip-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onClipDelete(clip.id)
                }}
                title="Delete clip"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div style={{ padding: '16px', borderTop: '1px solid #333' }}>
        <FileImport onVideoImported={onVideoImported} />
        <div className="file-import-header" style={{ marginTop: '12px' }}>
          {isRecording ? (
            <button 
              className="btn btn-danger"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleStopRecording()
              }}
              style={{ 
                backgroundColor: '#dc3545', 
                borderColor: '#dc3545',
                cursor: 'pointer',
                pointerEvents: 'auto',
                zIndex: 1000
              }}
            >
              🔴 Stop Recording ({recordingType}) - {formatDuration(recordingTime)}
            </button>
          ) : (
            <button 
              className="btn btn-record"
              onClick={() => setShowRecordingModal(true)}
            >
              Record Video
            </button>
          )}
        </div>
      </div>

      {/* Recording Modal - Keep RecordingPanel ALWAYS mounted, just hide the modal */}
      <div 
        className="modal-overlay" 
        style={{ display: showRecordingModal && !isRecording ? 'flex' : 'none' }}
        onClick={() => setShowRecordingModal(false)}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Recording</h3>
            <button 
              className="modal-close"
              onClick={() => setShowRecordingModal(false)}
              title="Close"
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <RecordingPanel 
              key="recording-panel"
              onRecordingComplete={handleRecordingComplete}
              onRecordingStarted={handleRecordingStarted}
              onRecordingTimeUpdate={handleRecordingTimeUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default MediaLibrary
