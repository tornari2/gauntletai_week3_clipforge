import React, { useRef, useState, useEffect } from 'react'

const TimelinePreview = ({ timeline, onPlayheadMove }) => {
  const videoRef = useRef(null)
  const progressBarRef = useRef(null)
  const seekHandleRef = useRef(null)
  const timeDisplayRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [clips, setClips] = useState([])
  const shouldPlayRef = useRef(false) // Track if we should be playing during transitions
  const animationFrameRef = useRef(null) // For throttling playhead updates
  const currentTimeRef = useRef(0) // Track current time without causing re-renders
  const lastPlayheadPositionRef = useRef(null) // Track last playhead position to avoid unnecessary updates
  const isDraggingSeekRef = useRef(false) // Track if user is dragging the seek bar
  const currentVideoSrcRef = useRef(null) // Track current video source to avoid unnecessary reloads
  const actualClipIndexRef = useRef(0) // Track actual clip we're in without causing re-renders during scrubbing

  // Get clips from main track and calculate timeline info
  useEffect(() => {
    const mainTrack = timeline?.tracks?.find(track => track.id === 1)
    const timelineClips = mainTrack?.clips || []
    
    // Calculate total duration as sum of trimmed durations
    const totalDur = timelineClips.reduce((total, clip) => {
      return total + (clip.trimEnd - clip.trimStart)
    }, 0)
    
    setTotalDuration(totalDur)
    setClips(timelineClips)
    
    // Reset to first clip when timeline changes
    if (timelineClips.length > 0) {
      setCurrentClipIndex(0)
      // Start at the beginning (relative to timeline)
      setCurrentTime(0)
      currentTimeRef.current = 0
      lastPlayheadPositionRef.current = null // Reset last position
      
      // DON'T call onPlayheadMove here - it causes infinite loop
      // The playhead will be updated when video starts playing via handleTimeUpdate
    }
  }, [timeline])

  // Get current clip info with bounds checking
  const safeClipIndex = Math.min(Math.max(0, currentClipIndex), clips.length - 1)
  const currentClip = clips[safeClipIndex] || null

  // Load current clip - only when source changes or timeline changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentClip || safeClipIndex >= clips.length || !currentClip.clip) return

    // Use custom local:// protocol
    // For split clips, always use the originalFilePath to ensure they share the same video source
    const sourceFilePath = currentClip.clip.originalFilePath || currentClip.clip.filePath
    const localSrc = `local://${sourceFilePath.startsWith('/') ? sourceFilePath : '/' + sourceFilePath}`
    
    // Only reload if source actually changed
    const needsReload = currentVideoSrcRef.current !== localSrc
    
    // Skip if same source and we're just changing clip index (for split clips from same source)
    if (!needsReload) {
      // console.log('Skipping reload - same source, clip index changed for split clips')
      return
    }
    
    console.log('=== TimelinePreview: Loading NEW Video Source ===')
    console.log('  Clip index:', currentClipIndex, '/', clips.length)
    console.log('  Clip fileName:', currentClip.clip.fileName)
    console.log('  Loading source:', localSrc)
    console.log('==================================')
    
    video.src = localSrc
    video.load()
    currentVideoSrcRef.current = localSrc
    
    // Set initial position after load
    if (typeof currentClip.trimStart === 'number') {
      // For split clips, use videoOffsetStart if available (offset into original video)
      const seekPosition = currentClip.clip.videoOffsetStart !== undefined 
        ? currentClip.clip.videoOffsetStart 
        : currentClip.trimStart
      console.log('  Will seek to:', seekPosition, 'after load')
      video.currentTime = seekPosition
    }
    
    // If we should be playing, start playing after the video is ready
    if (shouldPlayRef.current) {
      console.log('TimelinePreview: Setting up auto-play for next clip')
      const handleCanPlay = () => {
        console.log('TimelinePreview: Video can play, starting playback')
        video.play()
        setIsPlaying(true)
        shouldPlayRef.current = false
        video.removeEventListener('canplay', handleCanPlay)
      }
      video.addEventListener('canplay', handleCanPlay)
    }
  }, [currentClip, currentClipIndex])

  // Handle video events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

  const handleTimeUpdate = () => {
    if (!currentClip || !currentClip.clip) return
    
    // Skip ALL processing during scrubbing - the seekToTime function handles everything
    if (isDraggingSeekRef.current) return
    
    const videoTime = video.currentTime
    
    // Find which clip we're actually in based on video time
    // This is important for split clips where we might scrub between them
    let actualClipIndex = actualClipIndexRef.current
    let actualClip = clips[actualClipIndex] || currentClip
    
    // Check all clips to find the right one
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      const clipStart = clip.clip.videoOffsetStart !== undefined ? clip.clip.videoOffsetStart : clip.trimStart
      const clipEnd = clip.clip.videoOffsetEnd !== undefined ? clip.clip.videoOffsetEnd : clip.trimEnd
      
      // Check if current video time is within this clip's range
      if (videoTime >= clipStart && videoTime < clipEnd) {
        actualClipIndex = i
        actualClip = clip
        actualClipIndexRef.current = i
        
        // Update state if different (only during playback, not scrubbing)
        if (actualClipIndex !== currentClipIndex) {
          console.log('Time update detected clip boundary crossing to clip', actualClipIndex)
          setCurrentClipIndex(actualClipIndex)
        }
        break
      }
    }
    
    // For split clips, check against videoOffsetEnd instead of trimEnd
    const clipEndTime = actualClip.clip.videoOffsetEnd !== undefined 
      ? actualClip.clip.videoOffsetEnd 
      : actualClip.trimEnd
    
    const clipStartTime = actualClip.clip.videoOffsetStart !== undefined
      ? actualClip.clip.videoOffsetStart
      : actualClip.trimStart
    
    const timeInClip = videoTime - clipStartTime
      
      // Check if we've exceeded the trim end point
      if (typeof clipEndTime === 'number' && videoTime >= clipEndTime) {
        console.log('=== Transitioning to Next Clip ===')
        console.log('  Current clip ended at:', videoTime)
        console.log('  Current clip trimEnd/offsetEnd:', clipEndTime)
        
        // Move to next clip
        if (currentClipIndex < clips.length - 1) {
          const nextClipIndex = currentClipIndex + 1
          const nextClip = clips[nextClipIndex]
          
          if (nextClip && nextClip.clip) {
            console.log('  Next clip:', nextClip.clip.fileName)
            console.log('  Next clip ID:', nextClip.clipId)
            console.log('  Next clip trimStart:', nextClip.trimStart, 'trimEnd:', nextClip.trimEnd)
            console.log('  Next clip isSplitClip:', nextClip.clip.isSplitClip)
            console.log('  Next clip videoOffsetStart:', nextClip.clip.videoOffsetStart, 'videoOffsetEnd:', nextClip.clip.videoOffsetEnd)
            console.log('  Same source file?', nextClip.clip.originalFilePath === currentClip.clip.originalFilePath || nextClip.clip.filePath === currentClip.clip.filePath)
            
            // For split clips (same source file), seamlessly transition by seeking
            const isSameSource = nextClip.clip.originalFilePath === currentClip.clip.originalFilePath || 
                                 nextClip.clip.filePath === currentClip.clip.filePath
            if (isSameSource && currentVideoSrcRef.current) {
              console.log('  Using seamless transition (seeking)')
              // Seek to next clip's start position immediately
              // For split clips, use videoOffsetStart
              const nextSeekPosition = nextClip.clip.videoOffsetStart !== undefined
                ? nextClip.clip.videoOffsetStart
                : nextClip.trimStart
              console.log('  Seeking video to:', nextSeekPosition)
              video.currentTime = nextSeekPosition
              
              // Update clip index and state immediately
              setCurrentClipIndex(nextClipIndex)
              
              // Calculate the timeline time for the start of the next clip's trimmed portion
              const nextClipTimelineTime = clips.slice(0, nextClipIndex).reduce((total, clip) => {
                const clipDuration = (clip.trimEnd || 0) - (clip.trimStart || 0)
                return total + Math.max(0, clipDuration)
              }, 0)
              setCurrentTime(nextClipTimelineTime)
              currentTimeRef.current = nextClipTimelineTime
              
              // Update playhead position
              const firstClipStartTime = clips[0]?.startTime || 0
              const nextPlayheadPosition = firstClipStartTime + nextClipTimelineTime
              if (onPlayheadMove) {
                onPlayheadMove(nextPlayheadPosition)
              }
              
              // Update UI immediately for smooth transition
              if (progressBarRef.current && seekHandleRef.current && totalDuration > 0) {
                const progress = (nextClipTimelineTime / totalDuration) * 100
                progressBarRef.current.style.width = `${progress}%`
                seekHandleRef.current.style.left = `${progress}%`
              }
              
              // Update time display
              if (timeDisplayRef.current) {
                timeDisplayRef.current.textContent = `${formatTime(nextClipTimelineTime)} / ${formatTime(totalDuration)}`
              }
              
              // Ensure video continues playing if it was playing (seeking might pause it)
              // Use a small timeout to ensure the seek completes first
              if (isPlaying) {
                setTimeout(() => {
                  if (video.paused && isPlaying) {
                    video.play().catch(err => console.warn('Play failed after transition:', err))
                  }
                }, 10)
              }
            } else {
              // Different source file - use existing transition logic
              shouldPlayRef.current = isPlaying
              setCurrentClipIndex(nextClipIndex)
              
              // Calculate the timeline time for the start of the next clip's trimmed portion
              const nextClipTimelineTime = clips.slice(0, nextClipIndex).reduce((total, clip) => {
                const clipDuration = (clip.trimEnd || 0) - (clip.trimStart || 0)
                return total + Math.max(0, clipDuration)
              }, 0)
              setCurrentTime(nextClipTimelineTime)
              currentTimeRef.current = nextClipTimelineTime
              
              // Update playhead position
              const firstClipStartTime = clips[0]?.startTime || 0
              const nextPlayheadPosition = firstClipStartTime + nextClipTimelineTime
              if (onPlayheadMove) {
                onPlayheadMove(nextPlayheadPosition)
              }
            }
          }
        } else {
          // End of timeline
          video.pause()
          setIsPlaying(false)
          shouldPlayRef.current = false
          setCurrentTime(totalDuration)
          currentTimeRef.current = totalDuration
          if (onPlayheadMove) {
            onPlayheadMove(totalDuration)
          }
        }
      } else {
        // Update current time within the timeline
        const accumulatedTime = clips.slice(0, actualClipIndex).reduce((total, clip) => {
          const clipDuration = (clip.trimEnd || 0) - (clip.trimStart || 0)
          return total + Math.max(0, clipDuration)
        }, 0)
        const timelineTime = accumulatedTime + timeInClip
        currentTimeRef.current = timelineTime
        
        // Calculate playhead position on the timeline
        // Start from the first clip's startTime and add the elapsed timeline time
        const firstClipStartTime = clips[0]?.startTime || 0
        const playheadPosition = firstClipStartTime + timelineTime
        
        // Update progress bar DOM directly (no re-render)
        if (progressBarRef.current && seekHandleRef.current && totalDuration > 0) {
          const progress = (timelineTime / totalDuration) * 100
          progressBarRef.current.style.width = `${progress}%`
          seekHandleRef.current.style.left = `${progress}%`
        }
        
        // Update time display
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = `${formatTime(timelineTime)} / ${formatTime(totalDuration)}`
        }
        
        // Update playhead position directly (only if changed significantly to avoid excessive updates)
        if (onPlayheadMove) {
          const lastPosition = lastPlayheadPositionRef.current
          // Only update if position changed by at least 0.02 seconds (~20ms) for smooth updates
          // This matches roughly 50fps which is smooth enough for UI
          if (lastPosition === null || Math.abs(playheadPosition - lastPosition) > 0.02) {
            onPlayheadMove(playheadPosition)
            lastPlayheadPositionRef.current = playheadPosition
          }
        }
      }
    }

    const handleLoadedMetadata = () => {
      if (currentClip && currentClip.clip && typeof currentClip.trimStart === 'number') {
        // Always start at the beginning of the trimmed portion
        // For split clips, use videoOffsetStart
        const seekPosition = currentClip.clip.videoOffsetStart !== undefined 
          ? currentClip.clip.videoOffsetStart 
          : currentClip.trimStart
        video.currentTime = seekPosition
        
        // Update timeline time correctly - start at the beginning of this clip's trimmed portion
        const accumulatedTime = clips.slice(0, currentClipIndex).reduce((total, clip) => {
          const clipDuration = (clip.trimEnd || 0) - (clip.trimStart || 0)
          return total + Math.max(0, clipDuration)
        }, 0)
        setCurrentTime(accumulatedTime)
        
        // DON'T call onPlayheadMove here - causes infinite loop
      }
    }

    const handleEnded = () => {
      // Move to next clip or end
      if (currentClipIndex < clips.length - 1) {
        console.log('TimelinePreview: Clip ended, moving to next clip')
        shouldPlayRef.current = isPlaying
        setCurrentClipIndex(prev => {
          const nextIndex = prev + 1
          // Calculate the timeline time for the start of the next clip's trimmed portion
          const nextClipTimelineTime = clips.slice(0, nextIndex).reduce((total, clip) => total + (clip.trimEnd - clip.trimStart), 0)
          setCurrentTime(nextClipTimelineTime)
          
          // DON'T call onPlayheadMove here - causes infinite loop
          
          return nextIndex
        })
      } else {
        console.log('TimelinePreview: End of timeline reached')
        setIsPlaying(false)
        shouldPlayRef.current = false
        setCurrentTime(totalDuration)
        // DON'T call onPlayheadMove here - causes infinite loop
      }
    }

    const handleError = (e) => {
      console.warn('TimelinePreview: Video error:', e)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
    }
  }, [currentClip, currentClipIndex, clips, totalDuration])

  // Keyboard shortcut for spacebar play/pause
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only trigger if not typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }
      
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault() // Prevent page scroll
        togglePlayPause()
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying, currentTime, totalDuration, currentClip])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video || !currentClip) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      shouldPlayRef.current = false
    } else {
      // If at the end, restart from beginning
      if (currentTime >= totalDuration) {
        setCurrentClipIndex(0)
        setCurrentTime(0)
      }
      video.play()
      setIsPlaying(true)
      shouldPlayRef.current = false
    }
  }

  const handleSeek = (e) => {
    // Don't seek on click if we were dragging
    if (isDraggingSeekRef.current) return
    
    const video = videoRef.current
    if (!video || clips.length === 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newTimelineTime = (clickX / rect.width) * totalDuration
    seekToTime(newTimelineTime)
  }

  const handleSeekMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingSeekRef.current = true
    
    // Find the seek bar element (might be currentTarget or parent)
    const seekBar = e.currentTarget.classList.contains('video-seek-bar') 
      ? e.currentTarget 
      : (e.currentTarget.closest('.video-seek-bar') || e.currentTarget.parentElement)
    if (!seekBar) return
    
    const rect = seekBar.getBoundingClientRect()
    let rafId = null
    let lastSeekTime = 0
    const SEEK_THROTTLE_MS = 50 // Only actually seek video every 50ms
    
    const handleMouseMove = (moveEvent) => {
      if (!isDraggingSeekRef.current) return
      
      const video = videoRef.current
      if (!video || clips.length === 0) return
      
      const clickX = moveEvent.clientX - rect.left
      const newTimelineTime = Math.max(0, Math.min((clickX / rect.width) * totalDuration, totalDuration))
      
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      
      // Use requestAnimationFrame for smooth UI updates
      rafId = requestAnimationFrame(() => {
        // ALWAYS update UI immediately for smooth visual feedback
        if (progressBarRef.current && seekHandleRef.current && totalDuration > 0) {
          const progress = (newTimelineTime / totalDuration) * 100
          progressBarRef.current.style.width = `${progress}%`
          seekHandleRef.current.style.left = `${progress}%`
        }
        
        // Update time display
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = `${formatTime(newTimelineTime)} / ${formatTime(totalDuration)}`
        }
        
        // Only actually seek video at throttled rate to prevent flicker
        const now = Date.now()
        if (now - lastSeekTime > SEEK_THROTTLE_MS) {
          lastSeekTime = now
          seekToTime(newTimelineTime)
        }
      })
    }
    
    const handleMouseUp = () => {
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      
      // Clear scrubbing flag first
      isDraggingSeekRef.current = false
      
      // Sync state to match refs after scrubbing completes (single update)
      const finalTime = currentTimeRef.current
      const finalClipIndex = actualClipIndexRef.current
      
      console.log('Scrub ended - syncing state:', { time: finalTime, clipIndex: finalClipIndex })
      
      setCurrentTime(finalTime)
      if (finalClipIndex !== currentClipIndex) {
        setCurrentClipIndex(finalClipIndex)
      }
      
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    // Also seek immediately on mousedown
    const clickX = e.clientX - rect.left
    const newTimelineTime = Math.max(0, Math.min((clickX / rect.width) * totalDuration, totalDuration))
    seekToTime(newTimelineTime)
  }

  const seekToTime = (newTimelineTime) => {
    const video = videoRef.current
    if (!video || clips.length === 0) return
    
    // Find which clip this time corresponds to
    let accumulatedTime = 0
    let targetClipIndex = 0
    let timeInTargetClip = 0
    
    for (let i = 0; i < clips.length; i++) {
      const clipDuration = clips[i].trimEnd - clips[i].trimStart
      if (newTimelineTime <= accumulatedTime + clipDuration) {
        targetClipIndex = i
        timeInTargetClip = newTimelineTime - accumulatedTime
        break
      }
      accumulatedTime += clipDuration
    }
    
    const targetClip = clips[targetClipIndex]
    if (!targetClip) return
    
    // Check if we're switching clips
    const isSwitchingClips = targetClipIndex !== currentClipIndex
    
    // Set video position immediately
    const baseOffset = targetClip.clip.videoOffsetStart !== undefined 
      ? targetClip.clip.videoOffsetStart 
      : targetClip.trimStart
    const targetVideoTime = baseOffset + timeInTargetClip
    
    // Only log when not scrubbing to avoid spam
    if (!isDraggingSeekRef.current) {
      console.log('=== SeekToTime ===')
      console.log('  Target timeline time:', newTimelineTime)
      console.log('  Target clip index:', targetClipIndex)
      console.log('  Seeking to video time:', targetVideoTime)
    }
    
    video.currentTime = targetVideoTime
    
    // Update ref (no re-render)
    currentTimeRef.current = newTimelineTime
    actualClipIndexRef.current = targetClipIndex
    
    // ONLY update state if NOT scrubbing (to prevent flicker)
    if (!isDraggingSeekRef.current) {
      setCurrentTime(newTimelineTime)
      
      if (isSwitchingClips) {
        setCurrentClipIndex(targetClipIndex)
      }
    }
    
    // Update progress bar and handle directly via DOM (no React re-render)
    if (progressBarRef.current && seekHandleRef.current && totalDuration > 0) {
      const progress = (newTimelineTime / totalDuration) * 100
      progressBarRef.current.style.width = `${progress}%`
      seekHandleRef.current.style.left = `${progress}%`
    }
    
    // Update time display directly via DOM (no React re-render)
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${formatTime(newTimelineTime)} / ${formatTime(totalDuration)}`
    }
    
    // Update playhead position (this might cause parent re-render, but necessary for timeline sync)
    const firstClipStartTime = clips[0]?.startTime || 0
    const playheadPosition = firstClipStartTime + newTimelineTime
    if (onPlayheadMove) {
      onPlayheadMove(playheadPosition)
    }
  }

  const formatTime = (time) => {
    // Handle negative values and ensure we don't show invalid times
    const safeTime = Math.max(0, time || 0)
    const mins = Math.floor(safeTime / 60)
    const secs = Math.floor(safeTime % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'none'
  }

  const handleDrop = (e) => {
    e.preventDefault()
    console.log('TimelinePreview: Direct drop to player prevented - use timeline instead')
  }

  if (clips.length === 0) {
    return (
      <div 
        className="video-player"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="video-player-empty">
          <div className="empty-icon">📺</div>
          <h3>No Timeline Content</h3>
          <p className="text-muted">Add clips to the timeline to preview</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="video-player"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="video-container">
        <video
          ref={videoRef}
          className="video-element"
          preload="metadata"
          crossOrigin="anonymous"
          playsInline
        />
        
        {/* Timeline Info Badge */}
        <div className="video-trim-info">
          <div className="trim-badge">
            🎬 Timeline: {formatTime(totalDuration)} 
            <span className="trim-range-detail"> ({clips.length} clip{clips.length !== 1 ? 's' : ''})</span>
          </div>
        </div>
        
        {/* Custom Video Controls */}
        <div className="custom-video-controls">
          <div className="video-controls-row">
            <button 
              className="video-control-btn"
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            
            <div className="video-time-display" ref={timeDisplayRef}>
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </div>
            
            <div className="video-clip-info">
              Clip {safeClipIndex + 1}/{clips.length}: {currentClip?.clip.fileName || ''}
            </div>
          </div>
          
          <div className="video-seek-container">
            <div 
              className="video-seek-bar"
              onClick={handleSeek}
              onMouseDown={handleSeekMouseDown}
            >
              <div 
                className="video-seek-progress"
                ref={progressBarRef}
                style={{
                  width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%`
                }}
              />
              <div 
                className="video-seek-handle"
                ref={seekHandleRef}
                style={{
                  left: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%`
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  handleSeekMouseDown(e)
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TimelinePreview
