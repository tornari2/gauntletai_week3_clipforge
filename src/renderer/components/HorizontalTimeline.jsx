import React from 'react'

const HorizontalTimeline = ({ timeline, onClipSelect, onClipDelete, onClipDrop, onTimelineClipDelete, onClipTrim }) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getClipStyle = (timelineClip) => {
    // Make clips fill the entire track width regardless of duration
    return {
      left: '0%',
      width: '100%',
      minWidth: '20px' // Ensure clips are visible even if very short
    }
  }

  return (
    <div className="horizontal-timeline">
      <div className="timeline-header">
        <h3>Timeline</h3>
        <div className="timeline-duration">
          Duration: {formatTime(timeline.duration)}
        </div>
      </div>
      
      <div className="timeline-container">
        {/* Time Ruler Overlay */}
        <div className="timeline-ruler">
          <div className="ruler-track-labels">
            <div className="ruler-spacer"></div>
            <div className="ruler-content">
              {(() => {
                const maxDuration = Math.max(timeline.duration, 10) // Minimum 10 seconds
                const rulerMarks = []
                const markInterval = maxDuration <= 30 ? 5 : maxDuration <= 120 ? 10 : 30 // 5s, 10s, or 30s intervals
                
                for (let i = 0; i <= maxDuration; i += markInterval) {
                  rulerMarks.push(
                    <div 
                      key={i} 
                      className="ruler-mark"
                      style={{ left: `${(i / maxDuration) * 100}%` }}
                    >
                      <div className="ruler-tick"></div>
                      <div className="ruler-label">{formatTime(i)}</div>
                    </div>
                  )
                }
                return rulerMarks
              })()}
            </div>
          </div>
        </div>
        
        {timeline.tracks.map(track => (
          <div key={track.id} className="timeline-track">
            <div className="track-label">
              {track.name}
            </div>
            <div 
              className="track-content"
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }}
              onDrop={(e) => {
                e.preventDefault()
                try {
                  const clipData = e.dataTransfer.getData('application/json')
                  if (clipData) {
                    const clip = JSON.parse(clipData)
                    if (onClipDrop) {
                      onClipDrop(clip, track.id)
                    }
                  }
                } catch (error) {
                  console.error('Error handling drop:', error)
                }
              }}
            >
              {track.clips.length === 0 ? (
                <div className="track-empty">
                  Drop clips on {track.name}
                </div>
              ) : (
                track.clips.map((timelineClip, index) => (
                  <div
                    key={`${timelineClip.clipId}-${index}`}
                    className="timeline-clip-bar"
                    style={getClipStyle(timelineClip)}
                    onClick={() => onClipSelect(timelineClip.clip)}
                    title={`${timelineClip.clip.fileName} (${formatTime(timelineClip.duration)})`}
                  >
                    <div className="clip-name">
                      {timelineClip.clip.fileName.length > 15 
                        ? timelineClip.clip.fileName.substring(0, 15) + '...'
                        : timelineClip.clip.fileName
                      }
                    </div>
                    <div className="clip-duration">
                      {formatTime(timelineClip.duration)}
                    </div>
                    {timelineClip.clip.isRecording && (
                      <div className="recording-indicator">🎥</div>
                    )}
                    <button
                      className="timeline-clip-delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onTimelineClipDelete) {
                          onTimelineClipDelete(track.id, timelineClip)
                        }
                      }}
                      title="Delete from timeline"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default HorizontalTimeline
