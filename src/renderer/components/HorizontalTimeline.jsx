import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'

const BASE_PIXELS_PER_SECOND = 10 // Base scale for timeline

const HorizontalTimeline = ({
  timeline, 
  onClipSelect, 
  onClipDelete, 
  onClipDrop, 
  onTimelineClipDelete, 
  onClipTrim,
  onClipReposition,
  onClipSplitAtCenter,
  onClipSplitAtPlayhead,
  onPlayheadMove,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  selectedClip 
}) => {
  const [isDraggingTrim, setIsDraggingTrim] = useState(false)
  const [trimDragData, setTrimDragData] = useState(null)
  const [isDraggingClip, setIsDraggingClip] = useState(false)
  const [clipDragData, setClipDragData] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [dragOverTrack, setDragOverTrack] = useState(null)
  const [snapIndicator, setSnapIndicator] = useState(null)
  
  const timelineRef = useRef(null)
  const animationFrameRef = useRef(null)
  const containerWidthRef = useRef(800)
  const [, forceUpdate] = useState({}) // Force re-render when needed

  // Measure container width and force update
  const measureAndUpdate = () => {
    if (timelineRef.current?.parentElement) {
      const container = timelineRef.current.parentElement
      const availableWidth = container.offsetWidth - 124
      const newWidth = Math.max(availableWidth, 600)
      if (containerWidthRef.current !== newWidth) {
        containerWidthRef.current = newWidth
        forceUpdate({}) // Trigger re-render with new width
      }
    }
  }

  // Calculate pixels per second dynamically based on available width and zoom
  const basePixelsPerSecond = timeline.duration > 0 
    ? containerWidthRef.current / timeline.duration 
    : BASE_PIXELS_PER_SECOND
  const pixelsPerSecond = Math.max(0.1, (basePixelsPerSecond || BASE_PIXELS_PER_SECOND) * (timeline.zoomLevel || 1.0))
  const timelineWidthPx = Math.max(0, (timeline.duration || 0) * pixelsPerSecond)

  // Measure on mount and when timeline changes
  useLayoutEffect(() => {
    measureAndUpdate()
  }, [timeline.duration, timeline.tracks])

  // Measure on resize
  useEffect(() => {
    window.addEventListener('resize', measureAndUpdate)
    return () => window.removeEventListener('resize', measureAndUpdate)
  }, [])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Find snap point for magnetic snapping
  const findSnapPoint = (targetTime, excludeClipId = null) => {
    const snapThreshold = 0.2 // seconds
    const snapPoints = []
    
    // Add snap points from all clip edges (active regions only)
    if (timeline && timeline.tracks) {
      timeline.tracks.forEach(track => {
        if (track && track.clips) {
          track.clips.forEach(clip => {
            if (clip && clip.clipId !== excludeClipId) {
              const activeStart = (clip.startTime || 0) + (clip.trimStart || 0)
              const activeEnd = (clip.startTime || 0) + (clip.trimEnd || 0)
              snapPoints.push(activeStart)
              snapPoints.push(activeEnd)
            }
          })
        }
      })
    }
    
    // Find closest snap point
    let closestPoint = targetTime
    let closestDistance = snapThreshold
    
    snapPoints.forEach(point => {
      if (typeof point === 'number' && !isNaN(point)) {
        const distance = Math.abs(point - targetTime)
        if (distance < closestDistance) {
          closestPoint = point
          closestDistance = distance
        }
      }
    })
    
    return { time: closestPoint, snapped: closestDistance < snapThreshold }
  }


  // Trim handle dragging
  const handleTrimHandleMouseDown = (e, timelineClip, trackId, handleType) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only allow trimming if this clip is selected
    if (!selectedClip || (selectedClip.id !== timelineClip.clipId && selectedClip.id !== timelineClip.clip.id)) {
      console.log('Trim blocked: clip not selected')
      return
    }
    
    setIsDraggingTrim(true)
    setTrimDragData({
      clip: timelineClip,
      trackId,
      handleType, // 'left' or 'right'
      startX: e.clientX,
      originalTrimStart: timelineClip.trimStart,
      originalTrimEnd: timelineClip.trimEnd
    })
  }

  const handleTrimDrag = (e) => {
    if (!isDraggingTrim || !trimDragData) return
    
    e.preventDefault()
    
    const deltaX = e.clientX - trimDragData.startX
    const timeDelta = deltaX / pixelsPerSecond
    
    let newTrimStart = trimDragData.originalTrimStart
    let newTrimEnd = trimDragData.originalTrimEnd
    
    // For split clips, use the split clip's own duration as the limit (not the original video)
    // For regular clips, use the full duration
    const minTrimStart = 0
    const maxTrimEnd = trimDragData.clip.clip.duration
    
    if (trimDragData.handleType === 'left') {
      // Left handle: adjust trimStart
      newTrimStart = Math.max(minTrimStart, trimDragData.originalTrimStart + timeDelta)
      newTrimStart = Math.min(newTrimStart, trimDragData.originalTrimEnd - 0.1) // Min 0.1s
    } else if (trimDragData.handleType === 'right') {
      // Right handle: adjust trimEnd
      newTrimEnd = Math.min(maxTrimEnd, trimDragData.originalTrimEnd + timeDelta)
      newTrimEnd = Math.max(newTrimEnd, trimDragData.originalTrimStart + 0.1) // Min 0.1s
    }
    
    // Update in real-time
    if (onClipTrim) {
      onClipTrim(trimDragData.clip.clipId, {
        trimStart: newTrimStart,
        trimEnd: newTrimEnd
      })
    }
  }

  const handleTrimMouseUp = () => {
    setIsDraggingTrim(false)
    setTrimDragData(null)
  }

  // Clip dragging for repositioning
  const handleClipMouseDown = (e, timelineClip, trackId) => {
    // Don't start drag if clicking on trim handles
    if (e.target.classList.contains('trim-handle')) {
      return
    }
    
    e.preventDefault()
    
    setClipDragData({
      clip: timelineClip,
      trackId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false
    })
  }

  const handleClipDrag = (e) => {
    if (!clipDragData) return
    
    const deltaX = Math.abs(e.clientX - clipDragData.startX)
    const deltaY = Math.abs(e.clientY - clipDragData.startY)
    
    // Start dragging after 3px movement threshold
    if (!clipDragData.moved && (deltaX > 3 || deltaY > 3)) {
      setIsDraggingClip(true)
      setClipDragData({ ...clipDragData, moved: true })
    }
    
    if (isDraggingClip && timelineRef.current) {
      // Calculate target position and track
      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const targetTime = x / pixelsPerSecond
      
      // Find snap point
      const { time: snappedTime, snapped } = findSnapPoint(targetTime, clipDragData.clip.clipId)
      
      if (snapped) {
        setSnapIndicator({ time: snappedTime })
      } else {
        setSnapIndicator(null)
      }
    }
  }

  const handleClipMouseUp = (e) => {
    if (!clipDragData) return
    
    if (isDraggingClip && timelineRef.current) {
      // Perform the reposition
      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      const targetTime = x / pixelsPerSecond
      
      // Find target track
      let targetTrackId = clipDragData.trackId
      timeline.tracks.forEach((track, index) => {
        const trackTop = 50 + index * 80 // Approximate track positions
        const trackBottom = trackTop + 60
        if (y >= trackTop && y < trackBottom) {
          targetTrackId = track.id
        }
      })
      
      // Find snap point
      const { time: snappedTime } = findSnapPoint(targetTime, clipDragData.clip.clipId)
      
      // Calculate target index in track
      const targetTrack = timeline.tracks.find(t => t.id === targetTrackId)
      if (targetTrack) {
        // Find where to insert based on the center of where we're dropping
        let targetIndex = 0
        
        // If dropping in the same track as dragging from, need to handle carefully
        if (targetTrackId === clipDragData.trackId) {
          // Find current index of dragged clip
          const currentIndex = targetTrack.clips.findIndex(c => c.clipId === clipDragData.clip.clipId)
          
          // Calculate target index based on drop position
          // We compare against ALL clips including the dragged one, then adjust
          for (let i = 0; i < targetTrack.clips.length; i++) {
            const clip = targetTrack.clips[i]
            const clipCenter = clip.startTime + (clip.trimEnd - clip.trimStart) / 2
            
            if (snappedTime > clipCenter) {
              targetIndex = i + 1
            }
          }
          
          // The targetIndex is calculated as if the dragged clip isn't there
          // But it IS there, so we need to adjust
          // If we're inserting AFTER where we currently are, we need to decrease by 1
          // because the clip will be removed first
          if (targetIndex > currentIndex) {
            targetIndex = targetIndex - 1
          }
          
          // If target index equals current index, don't reposition (no change needed)
          if (targetIndex === currentIndex) {
            // Clip stays in same position - no need to call onClipReposition
            // Just select the clip
            if (onClipSelect) {
              onClipSelect(clipDragData.clip)
            }
            setSnapIndicator(null)
            setIsDraggingClip(false)
            setClipDragData(null)
            return
          }
        } else {
          // Moving to different track - simpler logic
          for (let i = 0; i < targetTrack.clips.length; i++) {
            const clip = targetTrack.clips[i]
            const clipCenter = clip.startTime + (clip.trimEnd - clip.trimStart) / 2
            
            if (snappedTime > clipCenter) {
              targetIndex = i + 1
            }
          }
        }
        
        if (onClipReposition) {
          onClipReposition(
            clipDragData.clip.clipId,
            clipDragData.trackId,
            targetTrackId,
            targetIndex
          )
        }
        
        // Select the clip after repositioning
        if (onClipSelect) {
          onClipSelect(clipDragData.clip)
        }
      }
      
      setSnapIndicator(null)
    } else if (!clipDragData.moved) {
      // Just a click, not a drag - select the clip
      if (onClipSelect) {
        onClipSelect(clipDragData.clip)
      }
    }
    
    setIsDraggingClip(false)
    setClipDragData(null)
  }

  // Context menu
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

  const handleContextMenuAction = (action) => {
    if (!contextMenu) return
    
    if (action === 'delete' && onTimelineClipDelete) {
      onTimelineClipDelete(contextMenu.trackId, contextMenu.clip)
    } else if (action === 'split-center' && onClipSplitAtCenter) {
      onClipSplitAtCenter(contextMenu.trackId, contextMenu.clip.clipId)
    } else if (action === 'split-playhead' && onClipSplitAtPlayhead) {
      onClipSplitAtPlayhead()
    }
    
    setContextMenu(null)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 's' || e.key === 'S') {
        if (onClipSplitAtPlayhead) {
          onClipSplitAtPlayhead()
        }
      }
    }
    
    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [onClipSplitAtPlayhead])

  useEffect(() => {
    if (isDraggingTrim) {
      document.addEventListener('mousemove', handleTrimDrag)
      document.addEventListener('mouseup', handleTrimMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleTrimDrag)
        document.removeEventListener('mouseup', handleTrimMouseUp)
      }
    }
  }, [isDraggingTrim, trimDragData])

  useEffect(() => {
    if (clipDragData) {
      document.addEventListener('mousemove', handleClipDrag)
      document.addEventListener('mouseup', handleClipMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleClipDrag)
        document.removeEventListener('mouseup', handleClipMouseUp)
      }
    }
  }, [clipDragData, isDraggingClip])

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null)
    }
    
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  // Check if playhead is over a clip's active region
  const isPlayheadOverClip = (clip) => {
    const activeStart = clip.startTime + clip.trimStart
    const activeEnd = clip.startTime + clip.trimEnd
    return timeline.playheadPosition > activeStart && timeline.playheadPosition < activeEnd
  }

  return (
    <div className="horizontal-timeline">
      <div className="timeline-header">
        <h3>Timeline</h3>
        <div className="timeline-controls">
          <div className="timeline-duration">
            {timeline.duration > 0 ? `Duration: ${formatTime(timeline.duration)}` : 'Drop clips to begin'}
          </div>
          {timeline.duration > 0 && (
            <div className="zoom-controls">
              <button className="btn-zoom" onClick={onZoomOut} title="Zoom Out">-</button>
              <span 
                className="zoom-level" 
                onClick={onZoomReset}
                title="Click to reset to 100%"
              >
                {Math.round((timeline.zoomLevel || 1.0) * 100)}%
              </span>
              <button className="btn-zoom" onClick={onZoomIn} title="Zoom In">+</button>
            </div>
          )}
        </div>
      </div>
      
      <div className="timeline-scroll-container">
        <div 
          className="timeline-container" 
          ref={timelineRef}
          style={{ 
            width: timeline.zoomLevel > 1.0 ? timelineWidthPx + 'px' : '100%',
            minWidth: '100%'
          }}
        >
          {/* Time Ruler - only show when there are clips */}
          {timeline.duration > 0 && (
            <div className="timeline-ruler" style={{ width: timelineWidthPx + 'px', marginLeft: '92px' }}>
              {(() => {
                const marks = []
                // Adjust interval based on zoom and duration
                let interval = 10
                if (timeline.duration > 120) interval = 30
                if (timeline.duration > 300) interval = 60
                if (timeline.zoomLevel > 2.0) interval = Math.max(5, interval / 2)
                
                for (let t = 0; t <= timeline.duration; t += interval) {
                  const leftPx = t * pixelsPerSecond
                  marks.push(
                    <div key={t} className="ruler-mark" style={{ left: leftPx + 'px' }}>
                      <div className="ruler-tick"></div>
                      <div className="ruler-label">{formatTime(t)}</div>
                    </div>
                  )
                }
                return marks
              })()}
            </div>
          )}
          {/* Snap Indicator */}
          {snapIndicator && (
            <div 
              className="timeline-snap-indicator" 
              style={{ left: (snapIndicator.time * pixelsPerSecond) + 'px' }}
            />
          )}
          
          {/* Tracks */}
          {timeline && timeline.tracks ? timeline.tracks.map(track => (
            <div key={track.id} className="timeline-track">
              <div className="track-label">
                {track.name}
              </div>
              <div 
                className={`track-content ${dragOverTrack === track.id ? 'drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'copy'
                  setDragOverTrack(track.id)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
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
                    // Safety check: ensure clip and clip.clip exist
                    if (!timelineClip || !timelineClip.clip) {
                      return null
                    }
                    
                    const fullDuration = timelineClip.clip.duration || 0
                    const trimmedDuration = Math.max(0, (timelineClip.trimEnd || 0) - (timelineClip.trimStart || 0))
                    // Use FULL duration for clip bar width to show trim overlays
                    const clipWidthPx = Math.max(0, fullDuration * pixelsPerSecond)
                    // Position clip bar at startTime
                    const clipLeftPx = Math.max(0, (timelineClip.startTime || 0) * pixelsPerSecond)
                    
                    // Calculate trim overlay positions (relative to full duration)
                    const trimStartPx = fullDuration > 0 ? ((timelineClip.trimStart || 0) / fullDuration) * clipWidthPx : 0
                    const trimEndPx = fullDuration > 0 ? ((timelineClip.trimEnd || 0) / fullDuration) * clipWidthPx : clipWidthPx
                    const activeWidthPx = trimEndPx - trimStartPx
                    
                    // Only check clipId for selection - split clips share the same original clip but have different clipIds
                    const isSelected = selectedClip && selectedClip.id === timelineClip.clipId
                    const isDragging = clipDragData && clipDragData.clip && clipDragData.clip.clipId === timelineClip.clipId
                    
                    return (
                      <div
                        key={`${timelineClip.clipId}-${index}`}
                        className={`timeline-clip-bar ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                        style={{
                          position: 'absolute',
                          left: clipLeftPx + 'px',
                          width: clipWidthPx + 'px'
                        }}
                        onMouseDown={(e) => handleClipMouseDown(e, timelineClip, track.id)}
                        onContextMenu={(e) => handleContextMenu(e, timelineClip, track.id)}
                      >
                        {/* Greyed-out start trim */}
                        {timelineClip.trimStart > 0 && (
                          <div 
                            className="trim-overlay trim-start" 
                            style={{ width: trimStartPx + 'px' }}
                          />
                        )}
                        
                        {/* Active region */}
                        <div 
                          className="clip-active-region" 
                          style={{ 
                            left: trimStartPx + 'px', 
                            width: activeWidthPx + 'px' 
                          }}
                        >
                          {/* Trim handles - only visible when selected */}
                          {isSelected && (
                            <>
                              <div
                                className="trim-handle trim-handle-left"
                                onMouseDown={(e) => handleTrimHandleMouseDown(e, timelineClip, track.id, 'left')}
                                title="Drag to trim start"
                              />
                              <div
                                className="trim-handle trim-handle-right"
                                onMouseDown={(e) => handleTrimHandleMouseDown(e, timelineClip, track.id, 'right')}
                                title="Drag to trim end"
                              />
                            </>
                          )}
                          
                          <div className="clip-content">
                            <div className="clip-name">
                              {timelineClip.clip.fileName.length > 15 
                                ? timelineClip.clip.fileName.substring(0, 15) + '...'
                                : timelineClip.clip.fileName
                              }
                            </div>
                            <div className="clip-duration">
                              {formatTime(timelineClip.trimEnd - timelineClip.trimStart)}
                            </div>
                          </div>
                        </div>
                        
                        {/* Greyed-out end trim */}
                        {timelineClip.trimEnd < fullDuration && (
                          <div 
                            className="trim-overlay trim-end" 
                            style={{ 
                              left: trimEndPx + 'px',
                              width: (clipWidthPx - trimEndPx) + 'px'
                            }}
                          />
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )) : null}
        </div>
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="timeline-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x + 'px',
            top: contextMenu.y + 'px'
          }}
        >
          <div
            className="context-menu-item"
            onClick={() => handleContextMenuAction('split-center')}
          >
            Split at center
          </div>
          {isPlayheadOverClip(contextMenu.clip) && (
            <div
              className="context-menu-item"
              onClick={() => handleContextMenuAction('split-playhead')}
            >
              Split at playhead
            </div>
          )}
          <div className="context-menu-divider"></div>
          <div
            className="context-menu-item danger"
            onClick={() => handleContextMenuAction('delete')}
          >
            Delete from timeline
          </div>
        </div>
      )}
    </div>
  )
}

export default HorizontalTimeline

