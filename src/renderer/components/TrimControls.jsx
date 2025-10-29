import React, { useState, useEffect, useRef } from 'react'

const TrimControls = ({ selectedClip, onTrimUpdate }) => {
  const [startTime, setStartTime] = useState('0')
  const [endTime, setEndTime] = useState('0')
  const [errors, setErrors] = useState({})
  const [isDragging, setIsDragging] = useState(null) // 'start', 'end', or null
  const sliderRef = useRef(null)

  useEffect(() => {
    if (selectedClip) {
      setStartTime(selectedClip.trimStart.toString())
      setEndTime(selectedClip.trimEnd.toString())
      setErrors({})
    }
  }, [selectedClip])

  const parseTimeInput = (input) => {
    // Handle MM:SS format or plain seconds
    if (input.includes(':')) {
      const parts = input.split(':')
      if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10)
        const seconds = parseInt(parts[1], 10)
        return minutes * 60 + seconds
      }
    }
    // Always round to whole seconds (1-second increments)
    return Math.round(parseFloat(input) || 0)
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const validateInputs = () => {
    const newErrors = {}
    const start = parseTimeInput(startTime)
    const end = parseTimeInput(endTime)

    if (start < 0) {
      newErrors.startTime = 'Start time cannot be negative'
    }

    if (end > selectedClip.duration) {
      newErrors.endTime = `End time cannot exceed video duration (${formatTime(selectedClip.duration)})`
    }

    if (end <= start) {
      newErrors.endTime = 'End time must be greater than start time'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleStartTimeChange = (e) => {
    const value = e.target.value
    setStartTime(value)
    
    if (errors.startTime) {
      setErrors(prev => ({ ...prev, startTime: null }))
    }
  }

  const handleEndTimeChange = (e) => {
    const value = e.target.value
    setEndTime(value)
    
    if (errors.endTime) {
      setErrors(prev => ({ ...prev, endTime: null }))
    }
  }

  const handleApplyTrim = () => {
    if (!selectedClip || !validateInputs()) return

    const start = parseTimeInput(startTime)
    const end = parseTimeInput(endTime)

    onTrimUpdate(selectedClip.id, {
      trimStart: start,
      trimEnd: end
    })
  }

  // Slider functionality
  const getSliderPosition = (time) => {
    if (!selectedClip || selectedClip.duration === 0) return 0
    return (time / selectedClip.duration) * 100
  }

  const getTimeFromPosition = (percentage) => {
    if (!selectedClip) return 0
    const time = (percentage / 100) * selectedClip.duration
    // Always snap to whole seconds (1-second increments)
    return Math.round(time)
  }

  const handleSliderMouseDown = (e, handleType) => {
    e.preventDefault()
    setIsDragging(handleType)
  }

  const handleSliderMouseMove = (e) => {
    if (!isDragging || !sliderRef.current || !selectedClip) return

    const rect = sliderRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    const newTime = getTimeFromPosition(percentage) // Already rounds to whole seconds

    if (isDragging === 'start') {
      const end = parseTimeInput(endTime)
      if (newTime < end) {
        setStartTime(newTime.toString())
      }
    } else if (isDragging === 'end') {
      const start = parseTimeInput(startTime)
      if (newTime > start) {
        setEndTime(newTime.toString())
      }
    }
  }

  const handleSliderMouseUp = () => {
    setIsDragging(null)
  }

  // Add event listeners for mouse move and up
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleSliderMouseMove)
      document.addEventListener('mouseup', handleSliderMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleSliderMouseMove)
        document.removeEventListener('mouseup', handleSliderMouseUp)
      }
    }
  }, [isDragging, startTime, endTime, selectedClip])

  if (!selectedClip) {
    return (
      <div className="trim-controls">
        <h3>Trim Controls</h3>
        <p className="text-muted">Select a clip to enable trim controls</p>
      </div>
    )
  }

  const startSeconds = parseTimeInput(startTime)
  const endSeconds = parseTimeInput(endTime)
  const trimDuration = Math.max(0, endSeconds - startSeconds)

  if (!selectedClip) {
    return (
      <div className="trim-controls">
        <h3>Trim Controls</h3>
        <div className="trim-controls-empty">
          <div className="empty-icon">✂️</div>
          <p>No editable clip selected</p>
          <p className="text-muted">Drag a clip to the timeline to enable editing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="trim-controls">
      <h3>Trim Controls</h3>
      <p className="text-muted">Clip: {selectedClip.fileName}</p>
      
      {/* Visual Trim Slider */}
      <div className="trim-slider-container">
        <div className="trim-slider-header">
          <span className="trim-slider-label">Start: {formatTime(startSeconds)}</span>
          <span className="trim-slider-label">End: {formatTime(endSeconds)}</span>
        </div>
        
        <div 
          className="trim-slider"
          ref={sliderRef}
          onMouseDown={(e) => {
            // Handle clicking on the slider track to move handles
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const percentage = (x / rect.width) * 100
            const clickTime = getTimeFromPosition(percentage) // Already rounds to whole seconds
            const start = parseTimeInput(startTime)
            const end = parseTimeInput(endTime)
            
            // Move the closest handle, ensuring we snap to whole seconds
            if (Math.abs(clickTime - start) < Math.abs(clickTime - end)) {
              if (clickTime < end) {
                setStartTime(clickTime.toString())
              }
            } else {
              if (clickTime > start) {
                setEndTime(clickTime.toString())
              }
            }
          }}
        >
          <div className="trim-slider-track">
            <div 
              className="trim-slider-range"
              style={{
                left: `${getSliderPosition(startSeconds)}%`,
                width: `${getSliderPosition(endSeconds) - getSliderPosition(startSeconds)}%`
              }}
            />
            <div 
              className="trim-slider-handle trim-slider-handle-start"
              style={{ left: `${getSliderPosition(startSeconds)}%` }}
              onMouseDown={(e) => handleSliderMouseDown(e, 'start')}
            />
            <div 
              className="trim-slider-handle trim-slider-handle-end"
              style={{ left: `${getSliderPosition(endSeconds)}%` }}
              onMouseDown={(e) => handleSliderMouseDown(e, 'end')}
            />
          </div>
        </div>
        
        <div className="trim-slider-time-labels">
          <span>0:00</span>
          <span>{formatTime(selectedClip.duration)}</span>
        </div>
      </div>

      <div className="trim-inputs">
        <div className="trim-input-group">
          <label htmlFor="start-time">Start Time</label>
          <input
            id="start-time"
            type="text"
            className={`input ${errors.startTime ? 'error' : ''}`}
            value={startTime}
            onChange={handleStartTimeChange}
            placeholder="0 or 0:00"
          />
          {errors.startTime && (
            <div className="text-error">{errors.startTime}</div>
          )}
          <div className="input-help">
            Enter seconds (e.g., 15) or MM:SS (e.g., 0:15)
          </div>
        </div>

        <div className="trim-input-group">
          <label htmlFor="end-time">End Time</label>
          <input
            id="end-time"
            type="text"
            className={`input ${errors.endTime ? 'error' : ''}`}
            value={endTime}
            onChange={handleEndTimeChange}
            placeholder="0 or 0:00"
          />
          {errors.endTime && (
            <div className="text-error">{errors.endTime}</div>
          )}
          <div className="input-help">
            Enter seconds (e.g., 90) or MM:SS (e.g., 1:30)
          </div>
        </div>
      </div>

      <div className="trim-info">
        <div className="trim-duration">
          <strong>Trim Duration: {formatTime(trimDuration)}</strong>
        </div>
        <div className="trim-range">
          Original: {formatTime(selectedClip.duration)} → Trimmed: {formatTime(trimDuration)}
        </div>
      </div>

      <button 
        className="btn btn-primary"
        onClick={handleApplyTrim}
        disabled={Object.keys(errors).length > 0}
      >
        Apply Trim
      </button>
    </div>
  )
}

export default TrimControls
