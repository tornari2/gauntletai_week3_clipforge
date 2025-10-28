import React from 'react'
import FileImport from './FileImport'

const Timeline = ({ clips, selectedClip, onClipSelect, onClipDelete, onVideoImported }) => {
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (clips.length === 0) {
    return (
      <div className="timeline">
        <div className="timeline-empty">
          <p>No media imported yet</p>
          <p className="text-muted">Import a video to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="timeline">
      <div className="timeline-header">
        <h3 className="timeline-title">Media Library</h3>
        <FileImport onVideoImported={onVideoImported} />
      </div>
      <div className="timeline-container">
        {clips.map((clip) => (
          <div
            key={clip.id}
            className={`timeline-clip ${selectedClip?.id === clip.id ? 'selected' : ''}`}
          >
            <div className="timeline-clip-content" onClick={() => onClipSelect(clip)}>
              <div className="timeline-clip-thumbnail">
                <div className="thumbnail-placeholder">🎬</div>
              </div>
              <div className="timeline-clip-info">
                <div className="timeline-clip-name" title={clip.fileName}>
                  {clip.fileName.length > 20 
                    ? clip.fileName.substring(0, 20) + '...' 
                    : clip.fileName
                  }
                </div>
                <div className="timeline-clip-duration">
                  {formatDuration(clip.duration)}
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
    </div>
  )
}

export default Timeline
