import React, { useState, useEffect } from 'react'

const ExportButton = ({ selectedClip }) => {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState('')
  const [selectedResolution, setSelectedResolution] = useState('original')

  // Resolution options with file size estimates
  const resolutionOptions = [
    { 
      value: 'original', 
      label: 'Original Resolution', 
      bitrate: null // Will use original bitrate
    },
    { 
      value: '4K', 
      label: '4K (3840×2160)', 
      bitrate: 15000 // 15 Mbps
    },
    { 
      value: '1080p', 
      label: '1080p (1920×1080)', 
      bitrate: 5000 // 5 Mbps
    },
    { 
      value: '720p', 
      label: '720p (1280×720)', 
      bitrate: 2500 // 2.5 Mbps
    },
    { 
      value: '480p', 
      label: '480p (854×480)', 
      bitrate: 1000 // 1 Mbps
    },
    { 
      value: '360p', 
      label: '360p (640×360)', 
      bitrate: 500 // 0.5 Mbps
    }
  ]

  useEffect(() => {
    // Set up event listeners for export progress
    const handleProgress = (data) => {
      setExportProgress(data.percent)
    }

    const handleComplete = () => {
      setIsExporting(false)
      setExportProgress(0)
      setExportStatus('Export completed successfully!')
      setTimeout(() => setExportStatus(''), 3000)
    }

    const handleError = (error) => {
      setIsExporting(false)
      setExportProgress(0)
      setExportStatus(`Export failed: ${error}`)
      setTimeout(() => setExportStatus(''), 5000)
    }

    window.electronAPI.onExportProgress(handleProgress)
    window.electronAPI.onExportComplete(handleComplete)
    window.electronAPI.onExportError(handleError)

    return () => {
      window.electronAPI.removeAllListeners('export-progress')
      window.electronAPI.removeAllListeners('export-complete')
      window.electronAPI.removeAllListeners('export-error')
    }
  }, [])

  const handleExport = async () => {
    if (!selectedClip) return

    try {
      setIsExporting(true)
      setExportStatus('Preparing export...')
      setExportProgress(0)

      // Open save dialog
      const outputPath = await window.electronAPI.saveDialog()
      if (!outputPath) {
        setIsExporting(false)
        setExportStatus('')
        return
      }

      setExportStatus('Exporting video...')

      // Calculate trim parameters
      const startTime = selectedClip.trimStart
      const duration = selectedClip.trimEnd - selectedClip.trimStart

      // Call export function
      await window.electronAPI.exportVideo({
        inputPath: selectedClip.filePath,
        outputPath,
        startTime,
        duration,
        resolution: selectedResolution
      })

    } catch (error) {
      console.error('Export error:', error)
      setIsExporting(false)
      setExportProgress(0)
      setExportStatus(`Export failed: ${error.message}`)
      setTimeout(() => setExportStatus(''), 5000)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const calculateExpectedFileSize = (duration, resolution) => {
    if (!selectedClip || resolution === 'original') {
      return 'Original size'
    }
    
    const selectedOption = resolutionOptions.find(opt => opt.value === resolution)
    if (!selectedOption || !selectedOption.bitrate) {
      return 'Unknown'
    }
    
    // Calculate file size: (bitrate in bps * duration in seconds) / 8 bits per byte
    const bitrateBps = selectedOption.bitrate * 1000 // Convert kbps to bps
    const fileSizeBytes = (bitrateBps * duration) / 8
    
    return `~${formatFileSize(fileSizeBytes)}`
  }

  if (!selectedClip) {
    return (
      <div className="export-button">
        <h3>Export Video</h3>
        <p className="text-muted">Select a clip to enable export</p>
      </div>
    )
  }

  const trimDuration = selectedClip.trimEnd - selectedClip.trimStart

  return (
    <div className="export-button">
      <h3>Export Video</h3>
      <p className="text-muted">
        Exporting: {selectedClip.fileName}
      </p>
      <p className="text-muted">
        Duration: {formatTime(trimDuration)} (from {formatTime(selectedClip.trimStart)} to {formatTime(selectedClip.trimEnd)})
      </p>

      <div className="export-options">
        <label htmlFor="resolution-select" className="export-label">
          Export Resolution:
        </label>
        <select
          id="resolution-select"
          value={selectedResolution}
          onChange={(e) => setSelectedResolution(e.target.value)}
          className="export-select"
          disabled={isExporting}
        >
          {resolutionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <div className="file-size-estimate">
          <span className="file-size-label">Expected file size:</span>
          <span className="file-size-value">
            {calculateExpectedFileSize(trimDuration, selectedResolution)}
          </span>
        </div>
      </div>

      <button 
        className="btn btn-success"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export Video'}
      </button>

      {isExporting && (
        <div className="export-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${exportProgress}%` }}
            />
          </div>
          <div className="progress-text">
            {exportProgress}% complete
          </div>
        </div>
      )}

      {exportStatus && (
        <div className={`export-status ${exportStatus.includes('failed') ? 'error' : 'success'}`}>
          {exportStatus}
        </div>
      )}
    </div>
  )
}

export default ExportButton
