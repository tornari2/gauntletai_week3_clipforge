import React, { useState } from 'react'

const FileImport = ({ onVideoImported }) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleFileSelect = async () => {
    try {
      console.log('=== FILE IMPORT DEBUG START ===')
      console.log('Starting video import...')
      console.log('window.electronAPI available?', !!window.electronAPI)
      console.log('onVideoImported function available?', typeof onVideoImported)
      
      if (!window.electronAPI) {
        throw new Error('Electron API not available')
      }
      
      setIsImporting(true)
      
      console.log('Calling window.electronAPI.importVideo()...')
      const filePath = await window.electronAPI.importVideo()
      console.log('File path received:', filePath)
      
      if (filePath) {
        const fileName = filePath.split('/').pop()
        console.log('Getting video duration for:', filePath)
        const duration = await window.electronAPI.getVideoDuration(filePath)
        console.log('Video duration:', duration)
        
        const videoData = {
          filePath,
          fileName,
          duration: Math.round(duration)
        }
        console.log('Calling onVideoImported with:', videoData)
        console.log('onVideoImported function:', onVideoImported)
        
        if (typeof onVideoImported === 'function') {
          onVideoImported(videoData)
          console.log('onVideoImported called successfully')
        } else {
          console.error('onVideoImported is not a function!', typeof onVideoImported)
        }
      } else {
        console.log('No file selected - user canceled or no file chosen')
      }
      console.log('=== FILE IMPORT DEBUG END ===')
    } catch (error) {
      console.error('Error importing video:', error)
      console.error('Error stack:', error.stack)
      console.error('Error message:', error.message)
      
      // More specific error messages
      if (error.message.includes('No window available')) {
        alert('Window error: Please try restarting the app.')
      } else if (error.message.includes('Electron API not available')) {
        alert('App error: Please restart the application.')
      } else {
        alert(`Failed to import video: ${error.message}`)
      }
    } finally {
      setIsImporting(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const videoFile = files.find(file => 
      file.type.startsWith('video/') && 
      (file.name.endsWith('.mp4') || file.name.endsWith('.mov'))
    )
    
    if (videoFile) {
      try {
        setIsImporting(true)
        const filePath = videoFile.path
        const fileName = videoFile.name
        const duration = await window.electronAPI.getVideoDuration(filePath)
        
        onVideoImported({
          filePath,
          fileName,
          duration: Math.round(duration)
        })
      } catch (error) {
        console.error('Error importing video:', error)
        alert('Failed to import video. Please try again.')
      } finally {
        setIsImporting(false)
      }
    } else {
      alert('Please drop a valid video file (MP4 or MOV)')
    }
  }

  return (
    <div className="file-import-header">
      <button 
        className="btn btn-primary"
        onClick={handleFileSelect}
        disabled={isImporting}
        title="Import video file (MP4 or MOV)"
      >
        {isImporting ? 'Importing...' : '📹 Import Video'}
      </button>
    </div>
  )
}

export default FileImport
