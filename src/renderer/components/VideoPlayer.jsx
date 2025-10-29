import React, { useRef, useState, useEffect } from 'react'

const VideoPlayer = ({ selectedClip }) => {
  const videoRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      // Check if we've exceeded the trim end point
      if (selectedClip && video.currentTime >= selectedClip.trimEnd) {
        // Loop back to trim start
        video.currentTime = selectedClip.trimStart
        if (!isPlaying) {
          video.pause()
          setIsPlaying(false)
        }
      }
      // Also check if we're before the trim start (shouldn't happen, but just in case)
      else if (selectedClip && video.currentTime < selectedClip.trimStart) {
        video.currentTime = selectedClip.trimStart
      }
      setCurrentTime(video.currentTime)
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      // Set initial playback position to trim start
      if (selectedClip && selectedClip.trimStart > 0) {
        video.currentTime = selectedClip.trimStart
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
      // Loop back to trim start
      if (selectedClip) {
        video.currentTime = selectedClip.trimStart
      }
    }

    const handleError = (e) => {
      console.warn('VideoPlayer: Video error:', e)
      console.warn('VideoPlayer: Error details:', e.target.error)
      console.warn('VideoPlayer: Video src:', e.target.src)
      console.warn('VideoPlayer: Video networkState:', e.target.networkState)
      console.warn('VideoPlayer: Video readyState:', e.target.readyState)
      
      // Check if video can still play despite the error
      if (e.target.readyState >= 2) {
        console.log('VideoPlayer: Video appears to be playable despite error')
      }
    }

    const handleLoadStart = () => {
      console.log('VideoPlayer: Video load started')
    }

    const handleCanPlay = () => {
      console.log('VideoPlayer: Video can play')
      // Set initial playback position to trim start when video is ready
      if (selectedClip && selectedClip.trimStart > 0) {
        video.currentTime = selectedClip.trimStart
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('canplay', handleCanPlay)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.removeEventListener('loadstart', handleLoadStart)
      video.removeEventListener('canplay', handleCanPlay)
    }
  }, [selectedClip, isPlaying])

  // Load video when clip changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !selectedClip) return

    console.log('VideoPlayer: Loading video with filePath:', selectedClip.filePath)
    console.log('VideoPlayer: Trim range:', selectedClip.trimStart, 'to', selectedClip.trimEnd)
    
    // Use custom local:// protocol
    const localSrc = `local://${selectedClip.filePath.startsWith('/') ? selectedClip.filePath : '/' + selectedClip.filePath}`
    
    console.log('VideoPlayer: Using local:// protocol:', localSrc)
    
    // Set the src and then load the video
    video.src = localSrc
    video.load()
    setCurrentTime(selectedClip.trimStart || 0)
    setIsPlaying(false)
  }, [selectedClip?.filePath, selectedClip?.id])

  // Update video position when trim values change (with debounce)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !selectedClip) return

    console.log('VideoPlayer: Trim values updated:', selectedClip.trimStart, 'to', selectedClip.trimEnd)
    
    // Debounce the trim update to prevent flashing during drag
    const timeoutId = setTimeout(() => {
      // If current time is outside the new trim range, move to trim start
      if (video.currentTime < selectedClip.trimStart || video.currentTime > selectedClip.trimEnd) {
        console.log('VideoPlayer: Current position outside trim range, moving to trim start')
        video.currentTime = selectedClip.trimStart
        setCurrentTime(selectedClip.trimStart)
      }
      
      // If video is currently playing and we've trimmed the end, check if we need to stop/loop
      if (isPlaying && video.currentTime >= selectedClip.trimEnd) {
        console.log('VideoPlayer: Video is playing beyond new trim end, looping to trim start')
        video.currentTime = selectedClip.trimStart
        setCurrentTime(selectedClip.trimStart)
      }
    }, 50) // 50ms debounce

    return () => clearTimeout(timeoutId)
  }, [selectedClip?.trimStart, selectedClip?.trimEnd, isPlaying])

  // Additional effect to handle trim changes during playback
  useEffect(() => {
    const video = videoRef.current
    if (!video || !selectedClip) return

    const checkTrimBounds = () => {
      if (video.currentTime < selectedClip.trimStart) {
        video.currentTime = selectedClip.trimStart
        setCurrentTime(selectedClip.trimStart)
      } else if (video.currentTime > selectedClip.trimEnd) {
        video.currentTime = selectedClip.trimStart
        setCurrentTime(selectedClip.trimStart)
        if (isPlaying) {
          // Continue playing from the new trim start
          video.play()
        }
      }
    }

    // Check bounds immediately
    checkTrimBounds()

    // Only set up interval if video is playing to avoid unnecessary checks
    let interval = null
    if (isPlaying) {
      interval = setInterval(checkTrimBounds, 200) // Reduced frequency to 200ms
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [selectedClip?.trimStart, selectedClip?.trimEnd, isPlaying])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video || !selectedClip) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
    } else {
      // If at the end of trim, restart from beginning
      if (video.currentTime >= selectedClip.trimEnd) {
        video.currentTime = selectedClip.trimStart
      }
      video.play()
      setIsPlaying(true)
    }
  }

  const handleSeek = (e) => {
    const video = videoRef.current
    if (!video || !selectedClip) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    // Map click position to trimmed range
    const trimDuration = selectedClip.trimEnd - selectedClip.trimStart
    const newTime = selectedClip.trimStart + (clickX / rect.width) * trimDuration
    // Clamp to trim range
    const clampedTime = Math.max(selectedClip.trimStart, Math.min(newTime, selectedClip.trimEnd))
    video.currentTime = clampedTime
    setCurrentTime(clampedTime)
  }

  const formatTime = (time) => {
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'none'
  }

  const handleDrop = (e) => {
    e.preventDefault()
    // Prevent dropping videos directly into the player
    console.log('VideoPlayer: Direct drop to player prevented - use timeline instead')
  }

  if (!selectedClip) {
    return (
      <div 
        className="video-player"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="video-player-empty">
          <div className="empty-icon">📺</div>
          <h3>No Video Selected</h3>
          <p className="text-muted">Drag a clip from the media library to the timeline to preview</p>
        </div>
      </div>
    )
  }

  // Calculate trimmed duration for display (memoized to prevent unnecessary re-renders)
  const trimmedDuration = selectedClip ? selectedClip.trimEnd - selectedClip.trimStart : 0
  const isTrimmed = selectedClip ? (selectedClip.trimStart > 0 || selectedClip.trimEnd < selectedClip.duration) : false
  const displayCurrentTime = selectedClip ? Math.max(0, currentTime - selectedClip.trimStart) : 0

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
        {isTrimmed && (
          <div className="video-trim-info">
            <div className="trim-badge">
              ✂️ Trimmed: {formatTime(trimmedDuration)} 
              <span className="trim-range-detail"> ({formatTime(selectedClip.trimStart)} - {formatTime(selectedClip.trimEnd)})</span>
            </div>
          </div>
        )}
        
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
              {formatTime(displayCurrentTime)} / {formatTime(trimmedDuration)}
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
                  width: `${trimmedDuration > 0 ? (displayCurrentTime / trimmedDuration) * 100 : 0}%`
                }}
              />
              <div 
                className="video-seek-handle"
                style={{
                  left: `${trimmedDuration > 0 ? (displayCurrentTime / trimmedDuration) * 100 : 0}%`
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPlayer
