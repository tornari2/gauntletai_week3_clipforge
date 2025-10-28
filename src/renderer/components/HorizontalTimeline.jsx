import React from 'react'

const HorizontalTimeline = ({ timeline, onClipSelect, onClipDelete, onClipDrop }) => {
  const [dragOverTrack, setDragOverTrack] = React.useState(null)
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getClipStyle = (timelineClip) => {
    const leftPercent = (timelineClip.startTime / Math.max(timeline.duration, 1)) * 100
    const widthPercent = (timelineClip.duration / Math.max(timeline.duration, 1)) * 100
    
    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      minWidth: '20px' // Ensure clips are visible even if very short
    }
  }

  const handleDragOver = (e, trackId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverTrack(trackId)
  }

  const handleDragLeave = (e) => {
    // Only clear drag over if we're leaving the track content area
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTrack(null)
    }
  }

  const handleDrop = (e, trackId) => {
    e.preventDefault()
    setDragOverTrack(null)
    try {
      const clipData = JSON.parse(e.dataTransfer.getData('application/json'))
      if (onClipDrop) {
        onClipDrop(clipData, trackId)
      }
    } catch (error) {
      console.error('Error parsing dropped clip data:', error)
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
        {timeline.tracks.map(track => (
          <div key={track.id} className="timeline-track">
            <div className="track-label">
              {track.name}
            </div>
            <div 
              className={`track-content ${dragOverTrack === track.id ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, track.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, track.id)}
            >
              {track.clips.length === 0 ? (
                <div className="track-empty">
                  Drop clips here
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
