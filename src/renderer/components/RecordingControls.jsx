import React, { useState, useRef, useEffect } from 'react'

const RecordingControls = ({ 
  selectedVideoSource, 
  selectedAudioSource, 
  onRecordingComplete,
  disabled = false
}) => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingType, setRecordingType] = useState(null) // 'screen', 'webcam', 'pip'
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState(null)
  
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingIntervalRef = useRef(null)
  const streamRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startRecording = async (type) => {
    try {
      setError(null)
      setRecordingType(type)
      
      let stream
      
      if (type === 'screen') {
        stream = await startScreenRecording()
      } else if (type === 'webcam') {
        stream = await startWebcamRecording()
      } else if (type === 'pip') {
        stream = await startPipRecording()
      }
      
      if (!stream) {
        throw new Error('Failed to get media stream')
      }
      
      streamRef.current = stream
      
      // Set up MediaRecorder
      const options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      }
      
      // Fallback to VP8 if VP9 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8'
      }
      
      // Fallback to basic webm if VP8 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm'
      }
      
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `recording_${type}_${timestamp}.webm`
        
        // Notify parent component with blob data
        if (onRecordingComplete) {
          onRecordingComplete({
            type,
            filename,
            blob,
            duration: recordingTime
          })
        }
      }
      
      // Start recording
      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      
      // Start timer
      setRecordingTime(0)
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      
    } catch (err) {
      console.error('Error starting recording:', err)
      
      // Provide specific error messages for common permission issues
      if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
        setError('Recording permission denied. Please check System Preferences > Security & Privacy and grant screen recording and microphone permissions.')
      } else if (err.name === 'NotFoundError') {
        setError('No recording device found. Please check your camera and microphone connections.')
      } else if (err.name === 'NotReadableError') {
        setError('Recording device is already in use by another application.')
      } else {
        setError(`Recording failed: ${err.message}`)
      }
    }
  }

  const startScreenRecording = async () => {
    if (!selectedVideoSource) {
      throw new Error('No video source selected')
    }
    
    // Request screen capture - try with system audio first, fallback to no audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedVideoSource.id
          }
        },
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedVideoSource.id
          }
        }
      })
      return stream
    } catch (audioError) {
      console.log('Screen recording with audio failed, trying without audio:', audioError)
      // Fallback to video-only screen recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedVideoSource.id
          }
        }
      })
      return stream
    }
  }

  const startWebcamRecording = async () => {
    if (!selectedAudioSource) {
      throw new Error('No audio source selected')
    }
    
    // Request webcam and microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: selectedAudioSource.id }
      },
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      }
    })
    
    return stream
  }

  const startPipRecording = async () => {
    if (!selectedVideoSource || !selectedAudioSource) {
      throw new Error('Both video and audio sources required for PiP recording')
    }
    
    // Get screen stream
    const screenStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: selectedVideoSource.id
        }
      }
    })
    
    // Get webcam stream
    const webcamStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: selectedAudioSource.id }
      },
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 30 }
      }
    })
    
    // Create canvas to composite the streams
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    // Set canvas size to match screen stream
    const screenVideo = document.createElement('video')
    screenVideo.srcObject = screenStream
    screenVideo.muted = true
    screenVideo.play()
    
    const webcamVideo = document.createElement('video')
    webcamVideo.srcObject = webcamStream
    webcamVideo.muted = true
    webcamVideo.play()
    
    // Wait for video metadata to load
    await new Promise((resolve) => {
      screenVideo.onloadedmetadata = () => {
        canvas.width = screenVideo.videoWidth
        canvas.height = screenVideo.videoHeight
        resolve()
      }
    })
    
    // Create composite stream from canvas
    const compositeStream = canvas.captureStream(30) // 30 FPS
    
    // Add audio from webcam stream
    const audioTracks = webcamStream.getAudioTracks()
    audioTracks.forEach(track => {
      compositeStream.addTrack(track)
    })
    
    // Start compositing loop
    const compositeFrame = () => {
      if (screenVideo.readyState >= 2 && webcamVideo.readyState >= 2) {
        // Draw screen as background
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)
        
        // Draw webcam as PiP overlay (bottom-right corner)
        const pipWidth = Math.min(320, canvas.width * 0.25)
        const pipHeight = Math.min(240, canvas.height * 0.25)
        const pipX = canvas.width - pipWidth - 20
        const pipY = canvas.height - pipHeight - 20
        
        // Add border around PiP
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3
        ctx.strokeRect(pipX - 2, pipY - 2, pipWidth + 4, pipHeight + 4)
        
        // Draw webcam video
        ctx.drawImage(webcamVideo, pipX, pipY, pipWidth, pipHeight)
      }
      
      requestAnimationFrame(compositeFrame)
    }
    
    // Start the compositing loop
    compositeFrame()
    
    // Store references for cleanup
    streamRef.current = {
      screenStream,
      webcamStream,
      compositeStream,
      canvas,
      screenVideo,
      webcamVideo
    }
    
    return compositeStream
  }

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      
      // Stop all tracks and clean up resources
      if (streamRef.current) {
        // Handle PiP recording cleanup
        if (streamRef.current.screenStream && streamRef.current.webcamStream) {
          // PiP recording - clean up both streams and canvas
          streamRef.current.screenStream.getTracks().forEach(track => track.stop())
          streamRef.current.webcamStream.getTracks().forEach(track => track.stop())
          
          // Clean up video elements
          if (streamRef.current.screenVideo) {
            streamRef.current.screenVideo.srcObject = null
          }
          if (streamRef.current.webcamVideo) {
            streamRef.current.webcamVideo.srcObject = null
          }
          
          // Remove canvas from DOM if it was added
          if (streamRef.current.canvas && streamRef.current.canvas.parentNode) {
            streamRef.current.canvas.parentNode.removeChild(streamRef.current.canvas)
          }
        } else {
          // Regular recording - clean up single stream
          streamRef.current.getTracks().forEach(track => track.stop())
        }
        
        streamRef.current = null
      }
      
      // Clear timer
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
      
      setIsRecording(false)
      setRecordingType(null)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const canRecordScreen = selectedVideoSource && !isRecording
  const canRecordWebcam = selectedAudioSource && !isRecording
  const canRecordPip = selectedVideoSource && selectedAudioSource && !isRecording

  return (
    <div className="recording-controls">
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="recording-buttons">
        <button
          className={`btn ${isRecording && recordingType === 'screen' ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => isRecording ? stopRecording() : startRecording('screen')}
          disabled={(!canRecordScreen && !isRecording) || disabled}
        >
          {isRecording && recordingType === 'screen' ? '⏹️ Stop Screen' : '🖥️ Record Screen'}
        </button>
        
        <button
          className={`btn ${isRecording && recordingType === 'webcam' ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => isRecording ? stopRecording() : startRecording('webcam')}
          disabled={(!canRecordWebcam && !isRecording) || disabled}
        >
          {isRecording && recordingType === 'webcam' ? '⏹️ Stop Webcam' : '📹 Record Webcam'}
        </button>
        
        <button
          className={`btn ${isRecording && recordingType === 'pip' ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => isRecording ? stopRecording() : startRecording('pip')}
          disabled={(!canRecordPip && !isRecording) || disabled}
        >
          {isRecording && recordingType === 'pip' ? '⏹️ Stop PiP' : '🎬 Record PiP'}
        </button>
      </div>
      
      {isRecording && (
        <div className="recording-status">
          <div className="recording-indicator">
            <div className="recording-dot"></div>
            <span>Recording {recordingType.toUpperCase()}</span>
            {recordingType === 'pip' && (
              <span className="pip-indicator">📹+🖥️</span>
            )}
          </div>
          <div className="recording-timer">
            {formatTime(recordingTime)}
          </div>
        </div>
      )}
    </div>
  )
}

export default RecordingControls

