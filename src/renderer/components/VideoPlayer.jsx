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
      setCurrentTime(video.currentTime)
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
    }

    const handleEnded = () => {
      setIsPlaying(false)
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
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !selectedClip) return

    console.log('VideoPlayer: Loading video with filePath:', selectedClip.filePath)
    
    // Use custom local:// protocol
    const localSrc = `local://${selectedClip.filePath.startsWith('/') ? selectedClip.filePath : '/' + selectedClip.filePath}`
    
    console.log('VideoPlayer: Using local:// protocol:', localSrc)
    
    // Set the src and then load the video
    video.src = localSrc
    video.load()
    setCurrentTime(0)
    setIsPlaying(false)
  }, [selectedClip])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
    } else {
      video.play()
      setIsPlaying(true)
    }
  }

  const handleSeek = (e) => {
    const video = videoRef.current
    if (!video) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newTime = (clickX / rect.width) * duration
    video.currentTime = newTime
    setCurrentTime(newTime)
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
          controls
          crossOrigin="anonymous"
          playsInline
        />
      </div>
    </div>
  )
}

export default VideoPlayer
