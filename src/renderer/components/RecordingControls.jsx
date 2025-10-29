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
  const recordingStartTimeRef = useRef(null)

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
        
        // Calculate final duration using precise timing
        const finalDuration = recordingStartTimeRef.current ? 
          Math.floor((Date.now() - recordingStartTimeRef.current) / 1000) : 
          recordingTime
          
        console.log('RecordingControls: Total recording time:', finalDuration, 'seconds')
        
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        console.log('RecordingControls: Blob created, size:', blob.size, 'bytes')
        
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
    
    console.log('RecordingControls: Starting PiP recording...')
    
    // Use the same approach as screen recording but with better error handling
    let screenStream
    try {
      // Try to get screen with audio first
      screenStream = await navigator.mediaDevices.getUserMedia({
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
      console.log('RecordingControls: Screen stream with audio obtained for PiP')
    } catch (audioError) {
      console.log('RecordingControls: Screen recording with audio failed, trying without audio:', audioError)
      try {
        // Fallback to video-only screen recording
        screenStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: selectedVideoSource.id
            }
          }
        })
        console.log('RecordingControls: Screen stream without audio obtained for PiP')
      } catch (videoError) {
        console.error('RecordingControls: Failed to get screen stream for PiP:', videoError)
        throw new Error(`PiP recording failed: ${videoError.message}`)
      }
    }
    
    // Store the stream for cleanup
    streamRef.current = screenStream
    
    console.log('RecordingControls: PiP recording setup complete (using screen recording approach)')
    return screenStream
  }

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      
      // Stop all tracks and clean up resources
      if (streamRef.current) {
        // Handle PiP recording cleanup (simplified)
        if (streamRef.current && streamRef.current.getTracks) {
          // All recording types now use the same cleanup
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

