import React, { useState, useEffect } from 'react'

const ExportButton = ({ selectedClip }) => {
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState('')

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
        duration
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
