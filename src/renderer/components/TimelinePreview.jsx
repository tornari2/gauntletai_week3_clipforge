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
      
      // Set initial playhead position to first clip's startTime (usually 0)
      // This sets the visual position on the timeline
      if (onPlayheadMove && timelineClips[0]) {
        const initialPosition = timelineClips[0].startTime
        // Use setTimeout to avoid triggering during render
        setTimeout(() => {
          onPlayheadMove(initialPosition)
          lastPlayheadPositionRef.current = initialPosition
        }, 0)
      }
    }
  }, [timeline])

  // Get current clip info with bounds checking
  const safeClipIndex = Math.min(Math.max(0, currentClipIndex), clips.length - 1)
  const currentClip = clips[safeClipIndex]

  // Load current clip
  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentClip || safeClipIndex >= clips.length) return

    console.log('TimelinePreview: Loading clip', currentClipIndex, ':', currentClip.clip.fileName)
    console.log('TimelinePreview: Trim range:', currentClip.trimStart, 'to', currentClip.trimEnd)
    console.log('TimelinePreview: Should play:', shouldPlayRef.current)
    
    // Use custom local:// protocol
    const localSrc = `local://${currentClip.clip.filePath.startsWith('/') ? currentClip.clip.filePath : '/' + currentClip.clip.filePath}`
    
    video.src = localSrc
    video.load()
    
    // Set initial position to trim start (always start at the beginning of the trimmed portion)
    video.currentTime = currentClip.trimStart
    
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
    if (!currentClip) return
    
    const videoTime = video.currentTime
    const timeInClip = videoTime - currentClip.trimStart
      
      // Check if we've exceeded the trim end point
      if (videoTime >= currentClip.trimEnd) {
        // Move to next clip
        if (currentClipIndex < clips.length - 1) {
          shouldPlayRef.current = isPlaying
          setCurrentClipIndex(prev => prev + 1)
          
          // Calculate the timeline time for the start of the next clip's trimmed portion
          const nextClipIndex = currentClipIndex + 1
          const nextClipTimelineTime = clips.slice(0, nextClipIndex).reduce((total, clip) => total + (clip.trimEnd - clip.trimStart), 0)
          setCurrentTime(nextClipTimelineTime)
          currentTimeRef.current = nextClipTimelineTime
          
          // Update playhead position (continues from current position, doesn't jump)
          const firstClipStartTime = clips[0]?.startTime || 0
          const nextPlayheadPosition = firstClipStartTime + nextClipTimelineTime
          if (onPlayheadMove) {
            onPlayheadMove(nextPlayheadPosition)
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
        const accumulatedTime = clips.slice(0, currentClipIndex).reduce((total, clip) => total + (clip.trimEnd - clip.trimStart), 0)
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
          // Only update if position changed by at least 0.05 seconds (~50ms) for smooth but efficient updates
          if (lastPosition === null || Math.abs(playheadPosition - lastPosition) > 0.05) {
            onPlayheadMove(playheadPosition)
            lastPlayheadPositionRef.current = playheadPosition
          }
        }
      }
    }

    const handleLoadedMetadata = () => {
      if (currentClip) {
        // Always start at the beginning of the trimmed portion
        video.currentTime = currentClip.trimStart
        
        // Update timeline time correctly - start at the beginning of this clip's trimmed portion
        const accumulatedTime = clips.slice(0, currentClipIndex).reduce((total, clip) => total + (clip.trimEnd - clip.trimStart), 0)
        setCurrentTime(accumulatedTime)
        
        // Update timeline playhead position
        if (onPlayheadMove) {
          onPlayheadMove(accumulatedTime)
        }
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
          
          // Update playhead to the start of the next clip's trimmed portion
          if (onPlayheadMove) {
            onPlayheadMove(nextClipTimelineTime)
          }
          
          return nextIndex
        })
      } else {
        console.log('TimelinePreview: End of timeline reached')
        setIsPlaying(false)
        shouldPlayRef.current = false
        setCurrentTime(totalDuration)
        if (onPlayheadMove) {
          onPlayheadMove(totalDuration)
        }
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
    const video = videoRef.current
    if (!video || clips.length === 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newTimelineTime = (clickX / rect.width) * totalDuration
    
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
    
    // Switch to target clip if needed
    if (targetClipIndex !== currentClipIndex) {
      setCurrentClipIndex(targetClipIndex)
    }
    
    // Set video position
    const targetClip = clips[targetClipIndex]
    video.currentTime = targetClip.trimStart + timeInTargetClip
    setCurrentTime(newTimelineTime)
    
    // Update timeline playhead position
    if (onPlayheadMove) {
      onPlayheadMove(newTimelineTime)
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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TimelinePreview
