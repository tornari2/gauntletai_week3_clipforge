import React from 'react'
import FileImport from './FileImport'

const MediaLibrary = ({ clips, selectedClip, onClipSelect, onClipDelete, onVideoImported, onClipDragStart }) => {
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

  // Listen for dropped video events from main process
  React.useEffect(() => {
    if (window.electronAPI && window.electronAPI.onVideoDropped) {
      window.electronAPI.onVideoDropped((videoData) => {
        console.log('MediaLibrary: Received dropped video from main process:', videoData)
        onVideoImported(videoData)
      })
    }
    
    if (window.electronAPI && window.electronAPI.onVideoDropError) {
      window.electronAPI.onVideoDropError((error) => {
        console.error('MediaLibrary: Video drop error:', error)
        alert(`Failed to import video: ${error}`)
      })
    }
  }, [onVideoImported])

  return (
    <div className="timeline">
      <div className="timeline-header">
        <h3 className="timeline-title">Media Library</h3>
        <FileImport onVideoImported={onVideoImported} />
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
                      <span className="metadata-label">Duration:</span>
                      <span className="metadata-value">{formatDuration(clip.duration)}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Resolution:</span>
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
    </div>
  )
}

export default MediaLibrary
