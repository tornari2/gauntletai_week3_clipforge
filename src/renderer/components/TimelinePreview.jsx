import React, { useRef, useState, useEffect } from 'react'

const TimelinePreview = ({ timeline, onPlayheadMove }) => {
  const videoRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [clips, setClips] = useState([])
  const shouldPlayRef = useRef(false) // Track if we should be playing during transitions

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
      // Start at the beginning of the first clip's trimmed portion
      setCurrentTime(0)
      // Update playhead to start of first clip's trimmed portion
      if (onPlayheadMove) {
        onPlayheadMove(0)
      }
    }
  }, [timeline])

  // Get current clip info with bounds checking
  const safeClipIndex = Math.min(Math.max(0, currentClipIndex), clips.length - 1)
  const currentClip = clips[safeClipIndex]
  const currentClipTrimDuration = currentClip ? currentClip.trimEnd - currentClip.trimStart : 0
  
  // Calculate time in current clip more safely
  const timeInCurrentClip = (() => {
    if (!currentClip) return 0
    const accumulatedTime = clips.slice(0, currentClipIndex).reduce((total, clip) => total + (clip.trimEnd - clip.trimStart), 0)
    const timeInClip = Math.max(0, currentTime - accumulatedTime)
    
    // Debug logging
    console.log('TimelinePreview: Time calculation debug:', {
      currentTime,
      currentClipIndex,
      accumulatedTime,
      timeInClip,
      currentClipTrimStart: currentClip.trimStart,
      currentClipTrimEnd: currentClip.trimEnd
    })
    
    return timeInClip
  })()

  // Load current clip
  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentClip || safeClipIndex >= clips.length) return

    console.log('TimelinePreview: Loading clip', currentClipIndex, ':', currentClip.clip.fileName)
    console.log('TimelinePreview: Trim range:', currentClip.trimStart, 'to', currentClip.trimEnd)
    console.log('TimelinePreview: Should play:', isPlaying || shouldPlayRef.current)
    
    // Use custom local:// protocol
    const localSrc = `local://${currentClip.clip.filePath.startsWith('/') ? currentClip.clip.filePath : '/' + currentClip.clip.filePath}`
    
    video.src = localSrc
    video.load()
    
    // Set initial position to trim start (always start at the beginning of the trimmed portion)
    video.currentTime = currentClip.trimStart
    
    // Update timeline time correctly - start at the beginning of this clip's trimmed portion
    const accumulatedTime = clips.slice(0, currentClipIndex).reduce((total, clip) => total + (clip.trimEnd - clip.trimStart), 0)
    setCurrentTime(accumulatedTime)
    
    // Update timeline playhead position
    if (onPlayheadMove) {
      onPlayheadMove(accumulatedTime)
    }
    
    // If we should be playing, start playing after the video is ready
    if (isPlaying || shouldPlayRef.current) {
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
  }, [currentClip, currentClipIndex, isPlaying])

  // Handle video events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

  const handleTimeUpdate = () => {
    if (!currentClip) return
    
    const videoTime = video.currentTime
    const timeInClip = videoTime - currentClip.trimStart
    
    console.log('TimelinePreview: timeupdate event fired!', {
      videoTime,
      videoPaused: video.paused,
      videoReadyState: video.readyState
    })
      
      console.log('TimelinePreview: Time update:', {
        videoTime,
        trimStart: currentClip.trimStart,
        trimEnd: currentClip.trimEnd,
        timeInClip,
        currentClipIndex,
        totalClips: clips.length,
        isPlaying,
        accumulatedTime: clips.slice(0, currentClipIndex).reduce((total, clip) => total + (clip.trimEnd - clip.trimStart), 0)
      })
      
      // Check if we've exceeded the trim end point
      if (videoTime >= currentClip.trimEnd) {
        console.log('TimelinePreview: Reached trim end, checking for next clip')
        // Move to next clip
        if (currentClipIndex < clips.length - 1) {
          console.log('TimelinePreview: Moving to next clip', currentClipIndex + 1, 'of', clips.length)
          shouldPlayRef.current = isPlaying
          setCurrentClipIndex(prev => {
            console.log('TimelinePreview: Setting clip index to:', prev + 1)
            return prev + 1
          })
          
          // Calculate the timeline time for the start of the next clip's trimmed portion
          const nextClipIndex = currentClipIndex + 1
          const nextClipTimelineTime = clips.slice(0, nextClipIndex).reduce((total, clip) => total + (clip.trimEnd - clip.trimStart), 0)
          setCurrentTime(nextClipTimelineTime)
          
          // Update playhead to the start of the next clip's trimmed portion
          if (onPlayheadMove) {
            onPlayheadMove(nextClipTimelineTime)
          }
        } else {
          console.log('TimelinePreview: End of timeline reached')
          // End of timeline
          video.pause()
          setIsPlaying(false)
          shouldPlayRef.current = false
          setCurrentTime(totalDuration)
        }
      } else {
        // Update current time within the timeline
        const accumulatedTime = clips.slice(0, currentClipIndex).reduce((total, clip) => total + (clip.trimEnd - clip.trimStart), 0)
        const timelineTime = accumulatedTime + timeInClip
        setCurrentTime(timelineTime)
        
        // Update timeline playhead position
        if (onPlayheadMove) {
          console.log('TimelinePreview: Updating playhead to:', timelineTime)
          onPlayheadMove(timelineTime)
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
    
    console.log('TimelinePreview: Added event listeners to video')

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      console.log('TimelinePreview: Removed event listeners from video')
    }
  }, [currentClip, currentClipIndex, clips, totalDuration, timeInCurrentClip])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video || !currentClip) return

    console.log('TimelinePreview: Toggle play/pause, current state:', isPlaying)

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      shouldPlayRef.current = false
      console.log('TimelinePreview: Paused video')
    } else {
      // If at the end, restart from beginning
      if (currentTime >= totalDuration) {
        setCurrentClipIndex(0)
        setCurrentTime(0)
      }
      video.play()
      setIsPlaying(true)
      shouldPlayRef.current = false
      console.log('TimelinePreview: Started playing video')
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
            
            <div className="video-time-display">
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
                style={{
                  width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%`
                }}
              />
              <div 
                className="video-seek-handle"
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
