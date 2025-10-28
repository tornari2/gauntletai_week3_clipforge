import React, { useState, useEffect } from 'react'

const TrimControls = ({ selectedClip, onTrimUpdate }) => {
  const [startTime, setStartTime] = useState('0')
  const [endTime, setEndTime] = useState('0')
  const [errors, setErrors] = useState({})

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
    return parseFloat(input) || 0
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

  return (
    <div className="trim-controls">
      <h3>Trim Controls</h3>
      <p className="text-muted">Clip: {selectedClip.fileName}</p>
      
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
