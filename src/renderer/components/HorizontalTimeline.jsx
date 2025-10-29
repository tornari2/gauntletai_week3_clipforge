import React, { useState, useRef } from 'react'

const HorizontalTimeline = ({ timeline, onClipSelect, onClipDelete, onClipDrop, onTimelineClipDelete, onClipTrim, selectedClip }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [dragData, setDragData] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [currentTrimValues, setCurrentTrimValues] = useState({}) // Track current trim values during drag
  const [dragOverTrack, setDragOverTrack] = useState(null) // Track which track is being hovered over
  const trackRef = useRef(null)
  const animationFrameRef = useRef(null)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getClipStyle = (timelineClip, currentTrimStart = null, currentTrimEnd = null) => {
    // Calculate position and width based on trim values and timeline duration
    const timelineDuration = timeline.duration > 0 ? timeline.duration : 10 // Use actual timeline duration
    
    // Use current trim values if provided (during dragging), otherwise use stored values
    const trimStart = currentTrimStart !== null ? currentTrimStart : timelineClip.trimStart
    const trimEnd = currentTrimEnd !== null ? currentTrimEnd : timelineClip.trimEnd
    
    // Calculate the visual position and width
    // The clip stays at its timeline position (startTime)
    // The width is based on the full video duration (not trimmed)
    // Trimming is handled visually through CSS or other means, not by changing position/width
    const startPercentage = (timelineClip.startTime / timelineDuration) * 100
    const widthPercentage = (timelineClip.duration / timelineDuration) * 100
    
    console.log('Timeline Debug:', {
      timelineDuration,
      clipStartTime: timelineClip.startTime,
      clipDuration: timelineClip.duration,
      trimStart,
      trimEnd,
      startPercentage,
      widthPercentage
    })
    
    return {
      left: `${startPercentage}%`,
      width: `${Math.max(widthPercentage, 2)}%`, // Minimum 2% width for visibility
      minWidth: '20px' // Ensure clips are visible even if very short
    }
  }

  const handleResizeStart = (e, timelineClip, handleType) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only allow trimming if this clip is selected
    if (!selectedClip || selectedClip.id !== timelineClip.clipId) {
      console.log('Resize blocked: clip not selected')
      return
    }
    
    setIsDragging(true)
    setDragData({
      clip: timelineClip,
      handleType, // 'left' or 'right'
      startX: e.clientX,
      originalTrimStart: timelineClip.trimStart,
      originalTrimEnd: timelineClip.trimEnd,
      originalDuration: timelineClip.duration
    })
    
    console.log('Resize started:', handleType, timelineClip)
  }

  const handleResizeMove = (e) => {
    if (!isDragging || !dragData) return
    
    e.preventDefault()
    
    // Cancel previous animation frame if it exists
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    // Use requestAnimationFrame for smooth updates
    animationFrameRef.current = requestAnimationFrame(() => {
      const deltaX = e.clientX - dragData.startX
      const trackWidth = trackRef.current?.offsetWidth || 1
      const timelineDuration = timeline.duration || 10
      
      // Improved pixel-to-time conversion with better sensitivity
      const pixelsPerSecond = trackWidth / timelineDuration
      const timeDelta = deltaX / pixelsPerSecond
      
      let newTrimStart = dragData.originalTrimStart
      let newTrimEnd = dragData.originalTrimEnd
      
      if (dragData.handleType === 'left') {
        // Left handle affects the start of the video (trimStart)
        newTrimStart = Math.max(0, dragData.originalTrimStart + timeDelta)
        newTrimStart = Math.min(newTrimStart, dragData.originalTrimEnd - 0.1) // Minimum 0.1s duration
      } else if (dragData.handleType === 'right') {
        // Right handle affects the end of the video (trimEnd)
        newTrimEnd = Math.min(dragData.clip.clip.duration, dragData.originalTrimEnd + timeDelta)
        newTrimEnd = Math.max(newTrimEnd, dragData.originalTrimStart + 0.1) // Minimum 0.1s duration
      }
      
      // Store current trim values for visual feedback
      setCurrentTrimValues({
        [dragData.clip.clipId]: {
          trimStart: newTrimStart,
          trimEnd: newTrimEnd
        }
      })
      
      // Update the clip in real-time for visual feedback
      if (onClipTrim) {
        onClipTrim(dragData.clip.clipId, {
          trimStart: newTrimStart,
          trimEnd: newTrimEnd
        })
      }
    })
  }

  const handleResizeEnd = () => {
    if (!isDragging || !dragData) return
    
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    // Clear current trim values
    setCurrentTrimValues({})
    
    setIsDragging(false)
    setDragData(null)
    console.log('Resize ended')
  }

  // Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isDragging, dragData])

  // Handle right-click context menu
  const handleContextMenu = (e, timelineClip, trackId) => {
    e.preventDefault()
    e.stopPropagation()
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      clip: timelineClip,
      trackId: trackId
    })
  }

  const handleContextMenuAction = (action, timelineClip, trackId) => {
    if (action === 'delete' && onTimelineClipDelete) {
      onTimelineClipDelete(trackId, timelineClip)
    }
    setContextMenu(null)
  }

  // Close context menu when clicking elsewhere
  React.useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null)
    }
    
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  return (
    <div className="horizontal-timeline">
      <div className="timeline-header">
        <h3>Timeline</h3>
        <div className="timeline-duration">
          Duration: {formatTime(timeline.duration)} (Debug: {timeline.duration}s)
        </div>
      </div>
      
      <div className="timeline-container">
        {/* Time Ruler Overlay - only show if there are clips on the timeline */}
        {(() => {
          const hasClips = timeline.tracks.some(track => track.clips.length > 0)
          if (!hasClips) return null
          
          return (
            <div className="timeline-ruler">
              <div className="ruler-track-labels">
                <div className="ruler-spacer"></div>
                <div className="ruler-content">
                  {(() => {
                    console.log('Ruler: Received timeline object:', timeline)
                    console.log('Ruler: timeline.duration value:', timeline.duration)
                    console.log('Ruler: timeline.duration type:', typeof timeline.duration)
                    
                    const maxDuration = timeline.duration > 0 ? timeline.duration : 10 // Use actual timeline duration
                    const rulerMarks = []
                    
                    // For 11-minute timeline (660 seconds), show marks every 30 seconds
                    // This will give us 22 marks total (0:00, 0:30, 1:00, 1:30, ... 10:30, 11:00)
                    const markInterval = 30 // Every 30 seconds for better visibility
                    
                    console.log('Ruler: maxDuration =', maxDuration, 'markInterval =', markInterval)
                    
                    for (let i = 0; i <= maxDuration; i += markInterval) {
                      const position = (i / maxDuration) * 100
                      console.log(`Ruler mark at ${i}s -> ${position}%`)
                      rulerMarks.push(
                        <div 
                          key={i} 
                          className="ruler-mark"
                          style={{ left: `${position}%` }}
                        >
                          <div className="ruler-tick"></div>
                          <div className="ruler-label">{formatTime(i)}</div>
                        </div>
                      )
                    }
                    console.log('Ruler: Total marks generated:', rulerMarks.length)
                    return rulerMarks
                  })()}
                </div>
              </div>
            </div>
          )
        })()}
        
        {timeline.tracks.map(track => (
          <div key={track.id} className="timeline-track">
            <div className="track-label">
              {track.name}
            </div>
            <div 
              ref={trackRef}
              className={`track-content ${dragOverTrack === track.id ? 'drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                e.dataTransfer.dropEffect = 'copy'
                setDragOverTrack(track.id)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                // Only clear drag state if we're leaving the track entirely
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setDragOverTrack(null)
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setDragOverTrack(null)
                try {
                  const clipData = e.dataTransfer.getData('application/json')
                  if (clipData) {
                    const clip = JSON.parse(clipData)
                    if (onClipDrop) {
                      console.log('Timeline: Processing drop for clip:', clip.id, 'on track:', track.id)
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
                track.clips.map((timelineClip, index) => {
                  // Get current trim values if this clip is being dragged
                  const currentTrim = currentTrimValues[timelineClip.clipId]
                  const currentTrimStart = currentTrim ? currentTrim.trimStart : null
                  const currentTrimEnd = currentTrim ? currentTrim.trimEnd : null
                  
                  return (
                    <div
                      key={`${timelineClip.clipId}-${index}`}
                      className={`timeline-clip-bar ${isDragging && dragData?.clip === timelineClip ? 'dragging' : ''} ${selectedClip && selectedClip.id === timelineClip.clipId ? 'selected' : ''}`}
                      style={getClipStyle(timelineClip, currentTrimStart, currentTrimEnd)}
                      onClick={() => onClipSelect(timelineClip)}
                      onContextMenu={(e) => handleContextMenu(e, timelineClip, track.id)}
                      title={`${timelineClip.clip.fileName} (${formatTime(timelineClip.duration)}) - Right-click for options`}
                    >
                      {/* Left resize handle */}
                      <div
                        className={`timeline-clip-resize-handle left ${selectedClip && selectedClip.id === timelineClip.clipId ? 'enabled' : 'disabled'}`}
                        onMouseDown={(e) => handleResizeStart(e, timelineClip, 'left')}
                        title={selectedClip && selectedClip.id === timelineClip.clipId ? "Drag to trim start" : "Click to select first"}
                      />
                      
                      {/* Right resize handle */}
                      <div
                        className={`timeline-clip-resize-handle right ${selectedClip && selectedClip.id === timelineClip.clipId ? 'enabled' : 'disabled'}`}
                        onMouseDown={(e) => handleResizeStart(e, timelineClip, 'right')}
                        title={selectedClip && selectedClip.id === timelineClip.clipId ? "Drag to trim end" : "Click to select first"}
                      />
                      
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
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="timeline-clip-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
        >
          <div
            className="timeline-clip-context-menu-item danger"
            onClick={() => handleContextMenuAction('delete', contextMenu.clip, contextMenu.trackId)}
          >
            Delete from timeline
          </div>
        </div>
      )}
    </div>
  )
}

export default HorizontalTimeline
