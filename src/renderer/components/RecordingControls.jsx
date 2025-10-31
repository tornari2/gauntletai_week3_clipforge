import React, { useState, useRef, useEffect } from 'react'

const RecordingControls = ({ 
  selectedVideoSource, 
  selectedAudioSource, 
  onRecordingComplete,
  onRecordingStarted,
  onRecordingTimeUpdate,
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
  const recordingStartTimeRef = useRef(null)
  const pipAnimationFrameRef = useRef(null)
  const pipVideoElementsRef = useRef(null)
  const pipCanvasRef = useRef(null)
  const stopRecordingCallbackRef = useRef(null)

  // Define stopRecording at the top level so it can be referenced
  const stopRecording = async () => {
    console.log('RecordingControls: stopRecording called, mediaRecorder exists:', !!mediaRecorderRef.current)
    if (mediaRecorderRef.current) {
      console.log('RecordingControls: MediaRecorder state:', mediaRecorderRef.current.state)
      
      // Always try to stop, regardless of state (in case state is inconsistent)
      console.log('RecordingControls: Stopping mediaRecorder...')
      try {
        // Stop the MediaRecorder
        if (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused') {
          mediaRecorderRef.current.stop()
          console.log('RecordingControls: stop() called successfully')
        } else {
          console.log('RecordingControls: MediaRecorder already stopped, state:', mediaRecorderRef.current.state)
          // Even if already stopped, trigger cleanup
          if (mediaRecorderRef.current.onstop) {
            mediaRecorderRef.current.onstop()
          }
        }
      } catch (err) {
        console.error('RecordingControls: Error calling stop():', err)
        // Force cleanup even if stop() fails
        setIsRecording(false)
        setRecordingType(null)
      }
      
      // Stop stream tracks immediately (don't wait for onstop)
      if (streamRef.current) {
        console.log('RecordingControls: Stopping stream tracks immediately...')
        if (streamRef.current._cleanup) {
          streamRef.current._cleanup()
        } else if (streamRef.current.getTracks) {
          streamRef.current.getTracks().forEach(track => {
            if (track.readyState !== 'ended') {
              track.stop()
              console.log('RecordingControls: Stopped track:', track.kind)
            }
          })
        }
      }
      
    } else {
      console.log('RecordingControls: No mediaRecorder to stop')
      setIsRecording(false)
      setRecordingType(null)
      setRecordingTime(0)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
      if (streamRef.current) {
        // Handle PiP cleanup
        if (streamRef.current._cleanup) {
          streamRef.current._cleanup()
        } else if (streamRef.current.getTracks) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
      }
      // Clean up PiP animation frame
      if (pipAnimationFrameRef.current) {
        cancelAnimationFrame(pipAnimationFrameRef.current)
      }
    }
  }, [])

  // Notify parent of recording time updates
  useEffect(() => {
    if (isRecording && onRecordingTimeUpdate) {
      onRecordingTimeUpdate(recordingTime)
    }
  }, [recordingTime, isRecording])

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
      
      // Set up MediaRecorder with better options for duration metadata
      const options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000, // 2.5 Mbps
        audioBitsPerSecond: 128000   // 128 kbps for audio
      }
      
      // Fallback to VP8 if VP9 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8'
      }
      
      // Fallback to basic webm if VP8 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm'
        // Remove codec-specific options for basic webm
        delete options.videoBitsPerSecond
        delete options.audioBitsPerSecond
      }
      
      console.log('RecordingControls: Using MediaRecorder options:', options)
      
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('RecordingControls: Data available, size:', event.data.size)
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        console.log('RecordingControls: Recording stopped, chunks:', recordedChunksRef.current.length)
        
        // Stop all tracks and clean up resources
        if (streamRef.current) {
          console.log('RecordingControls: Cleaning up stream...')
          // Handle PiP recording cleanup (has custom cleanup function)
          if (streamRef.current._cleanup) {
            streamRef.current._cleanup()
          } else if (streamRef.current && streamRef.current.getTracks) {
            // Standard cleanup for other recording types
            streamRef.current.getTracks().forEach(track => {
              track.stop()
              console.log('RecordingControls: Stopped track:', track.kind, track.label)
            })
          }
          
          streamRef.current = null
        }
        
        // Clear timer
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current)
          recordingIntervalRef.current = null
        }
        
        // Clean up PiP animation frame
        if (pipAnimationFrameRef.current) {
          cancelAnimationFrame(pipAnimationFrameRef.current)
          pipAnimationFrameRef.current = null
        }
        
        // Set state to not recording BEFORE processing
        setIsRecording(false)
        setRecordingType(null)
        
        // Validate we have recorded data
        if (recordedChunksRef.current.length === 0) {
          console.error('RecordingControls: No data recorded!')
          setError('Recording failed: No data was recorded')
          setRecordingTime(0)
          return
        }
        
        // Calculate final duration using precise timing
        const finalDuration = recordingStartTimeRef.current ? 
          Math.floor((Date.now() - recordingStartTimeRef.current) / 1000) : 
          recordingTime
          
        console.log('RecordingControls: Total recording time:', finalDuration, 'seconds')
        
        // Ensure we have at least 1 second of recording
        if (finalDuration < 1) {
          console.error('RecordingControls: Recording too short:', finalDuration)
          setError('Recording too short (minimum 1 second)')
          setIsRecording(false)
          setRecordingType(null)
          return
        }
        
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        console.log('RecordingControls: Blob created, size:', blob.size, 'bytes')
        
        // Validate blob size
        if (blob.size === 0) {
          console.error('RecordingControls: Blob is empty!')
          setError('Recording failed: File is empty')
          setIsRecording(false)
          setRecordingType(null)
          return
        }
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `recording_${type}_${timestamp}.webm`
        
        // Notify parent component with blob data
        if (onRecordingComplete) {
          onRecordingComplete({
            type,
            filename,
            blob,
            duration: finalDuration
          })
        }
      }
      
      // Start recording with more frequent data collection for better metadata
      mediaRecorder.start(500) // Collect data every 500ms for better duration accuracy
      setIsRecording(true)
      
      // Notify parent that recording has started (to close modal)
      if (onRecordingStarted) {
        console.log('RecordingControls: Calling onRecordingStarted with type:', type)
        onRecordingStarted(type, stopRecording)
      }
      
      // Start timer with more precise timing
      recordingStartTimeRef.current = Date.now()
      setRecordingTime(0)
      recordingIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
        setRecordingTime(elapsed)
      }, 100) // Update every 100ms for smoother display
      
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
    
    // Request screen capture - always get video-only to avoid conflicts
    // We'll add microphone audio separately
    const screenStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: selectedVideoSource.id
        }
      }
    })
    console.log('Screen recording: Got screen video stream')
    
    // If microphone is selected, add it to the stream
    if (selectedAudioSource) {
      try {
        console.log('Screen recording: Adding microphone audio:', selectedAudioSource.name)
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: selectedAudioSource.id }
          },
          video: false
        })
        
        // Remove any existing audio tracks first (shouldn't be any, but just in case)
        screenStream.getAudioTracks().forEach(track => {
          console.log('Screen recording: Removing existing audio track:', track.label)
          track.stop()
          screenStream.removeTrack(track)
        })
        
        // Add microphone audio tracks to the screen stream
        micStream.getAudioTracks().forEach(track => {
          screenStream.addTrack(track)
          console.log('Screen recording: Added microphone track:', track.label)
        })
        
        console.log('Screen recording: Final stream has', screenStream.getAudioTracks().length, 'audio track(s)')
      } catch (micError) {
        console.warn('Screen recording: Failed to add microphone audio:', micError)
        // Continue with screen recording even if microphone fails
      }
    }
    
    return screenStream
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
    
    console.log('RecordingControls: Starting PiP recording...')
    
    // Get screen stream (video only)
    const screenStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: selectedVideoSource.id
        }
      }
    })
    console.log('RecordingControls: Screen stream obtained for PiP')
    
    // Get webcam stream (video + audio)
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
    console.log('RecordingControls: Webcam stream obtained for PiP')
    
    // Create canvas to composite screen + webcam (PiP)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    // Get video elements for both streams
    const screenVideo = document.createElement('video')
    screenVideo.srcObject = screenStream
    screenVideo.autoplay = true
    screenVideo.playsInline = true
    
    const webcamVideo = document.createElement('video')
    webcamVideo.srcObject = webcamStream
    webcamVideo.autoplay = true
    webcamVideo.playsInline = true
    
    // Wait for both videos to be ready
    await Promise.all([
      new Promise(resolve => {
        screenVideo.onloadedmetadata = () => {
          canvas.width = screenVideo.videoWidth
          canvas.height = screenVideo.videoHeight
          resolve()
        }
      }),
      new Promise(resolve => {
        webcamVideo.onloadedmetadata = resolve
      })
    ])
    
    // Calculate PiP size and position (bottom right corner, 20% of screen size)
    const pipWidth = Math.floor(canvas.width * 0.2)
    const pipHeight = Math.floor(canvas.height * 0.2)
    const pipX = canvas.width - pipWidth - 20 // 20px margin from right
    const pipY = canvas.height - pipHeight - 20 // 20px margin from bottom
    
    console.log('RecordingControls: PiP overlay at', pipX, pipY, 'size:', pipWidth, 'x', pipHeight)
    
    // Store references to prevent garbage collection
    pipCanvasRef.current = canvas
    pipVideoElementsRef.current = { screenVideo, webcamVideo }
    
    // Draw composite frame
    const drawFrame = () => {
      if (!pipCanvasRef.current || !pipVideoElementsRef.current) return
      
      const currentCanvas = pipCanvasRef.current
      const currentCtx = currentCanvas.getContext('2d')
      const { screenVideo: sv, webcamVideo: wv } = pipVideoElementsRef.current
      
      // Only draw if videos are ready
      if (sv.readyState >= 2 && wv.readyState >= 2) {
        // Draw screen (full size)
        currentCtx.drawImage(sv, 0, 0, currentCanvas.width, currentCanvas.height)
        
        // Draw webcam PiP (bottom right corner)
        currentCtx.drawImage(wv, pipX, pipY, pipWidth, pipHeight)
        
        // Draw border around PiP
        currentCtx.strokeStyle = '#000'
        currentCtx.lineWidth = 3
        currentCtx.strokeRect(pipX, pipY, pipWidth, pipHeight)
      }
      
      pipAnimationFrameRef.current = requestAnimationFrame(drawFrame)
    }
    
    // Start drawing
    pipAnimationFrameRef.current = requestAnimationFrame(drawFrame)
    
    // Get canvas stream
    const compositeStream = canvas.captureStream(30) // 30 fps
    
    // Add webcam audio to the composite stream
    webcamStream.getAudioTracks().forEach(track => {
      compositeStream.addTrack(track)
      console.log('RecordingControls: Added webcam audio track to PiP:', track.label)
    })
    
    // Store references for cleanup
    streamRef.current = compositeStream
    // Store cleanup function
    streamRef.current._cleanup = () => {
      // Cancel animation frame
      if (pipAnimationFrameRef.current) {
        cancelAnimationFrame(pipAnimationFrameRef.current)
        pipAnimationFrameRef.current = null
      }
      
      // Stop video elements
      if (pipVideoElementsRef.current) {
        pipVideoElementsRef.current.screenVideo.srcObject?.getTracks().forEach(track => track.stop())
        pipVideoElementsRef.current.webcamVideo.srcObject?.getTracks().forEach(track => track.stop())
        pipVideoElementsRef.current = null
      }
      
      // Stop streams
      screenStream.getTracks().forEach(track => track.stop())
      webcamStream.getTracks().forEach(track => track.stop())
      
      // Clean up canvas
      pipCanvasRef.current = null
    }
    
    console.log('RecordingControls: PiP recording setup complete')
    return compositeStream
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
          disabled={(isRecording && recordingType !== 'screen') || (!canRecordScreen && !isRecording) || (disabled && !isRecording)}
        >
          {isRecording && recordingType === 'screen' ? 'Stop Screen' : 'Record Screen'}
        </button>
        
        <button
          className={`btn ${isRecording && recordingType === 'webcam' ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => isRecording ? stopRecording() : startRecording('webcam')}
          disabled={(isRecording && recordingType !== 'webcam') || (!canRecordWebcam && !isRecording) || (disabled && !isRecording)}
        >
          {isRecording && recordingType === 'webcam' ? 'Stop Webcam' : 'Record Webcam'}
        </button>
        
        <button
          className={`btn ${isRecording && recordingType === 'pip' ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => isRecording ? stopRecording() : startRecording('pip')}
          disabled={(isRecording && recordingType !== 'pip') || (!canRecordPip && !isRecording) || (disabled && !isRecording)}
        >
          {isRecording && recordingType === 'pip' ? 'Stop PiP' : 'Record PiP'}
        </button>
      </div>
      
      {isRecording && (
        <div className="recording-status">
          <div className="recording-indicator">
            <div className="recording-dot"></div>
            <span>Recording {recordingType.toUpperCase()}</span>
            {recordingType === 'pip' && (
              <span className="pip-indicator">Webcam + Screen</span>
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

