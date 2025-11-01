import React, { useState } from 'react'

const FileImport = ({ onVideoImported, onSubtitleImported }) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isImportingSubtitle, setIsImportingSubtitle] = useState(false)

  const handleSubtitleSelect = async () => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available')
      }
      
      setIsImportingSubtitle(true)
      
      const result = await window.electronAPI.importSubtitle()
      
      if (result && onSubtitleImported) {
        onSubtitleImported(result)
      }
    } catch (error) {
      console.error('Error importing subtitle:', error)
      alert(`Failed to import subtitle: ${error.message}`)
    } finally {
      setIsImportingSubtitle(false)
    }
  }

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
        console.log('Getting video metadata for:', filePath)
        
        // Get comprehensive metadata
        const metadata = await window.electronAPI.getVideoMetadata(filePath)
        console.log('Video metadata:', metadata)
        
        // Generate thumbnail
        const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg')
        console.log('Generating thumbnail at:', thumbnailPath)
        const generatedThumbnail = await window.electronAPI.generateThumbnail(filePath, thumbnailPath)
        console.log('Thumbnail generated:', generatedThumbnail)
        
        const videoData = {
          filePath,
          fileName,
          duration: Math.round(metadata.duration),
          width: metadata.width,
          height: metadata.height,
          fileSize: metadata.fileSize,
          codec: metadata.codec,
          bitrate: metadata.bitrate,
          thumbnailPath: generatedThumbnail
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
      (file.name.endsWith('.mp4') || file.name.endsWith('.mov') || file.name.endsWith('.webm'))
    )
    
    if (videoFile) {
      try {
        setIsImporting(true)
        const filePath = videoFile.path
        const fileName = videoFile.name
        
        // Get comprehensive metadata
        const metadata = await window.electronAPI.getVideoMetadata(filePath)
        
        // Generate thumbnail
        const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg')
        const generatedThumbnail = await window.electronAPI.generateThumbnail(filePath, thumbnailPath)
        
        onVideoImported({
          filePath,
          fileName,
          duration: Math.round(metadata.duration),
          width: metadata.width,
          height: metadata.height,
          fileSize: metadata.fileSize,
          codec: metadata.codec,
          bitrate: metadata.bitrate,
          thumbnailPath: generatedThumbnail
        })
      } catch (error) {
        console.error('Error importing video:', error)
        alert('Failed to import video. Please try again.')
      } finally {
        setIsImporting(false)
      }
    } else {
      alert('Please drop a valid video file (MP4, MOV, or WebM)')
    }
  }

  return (
    <div className="file-import-header">
      <button 
        className="btn btn-primary"
        onClick={handleFileSelect}
        disabled={isImporting}
        title="Import video file (MP4, MOV, or WebM)"
      >
        {isImporting ? 'Importing...' : 'Import Video'}
      </button>
      <button 
        className="btn btn-secondary"
        onClick={handleSubtitleSelect}
        disabled={isImportingSubtitle}
        title="Import subtitle file (.srt or .vtt)"
      >
        {isImportingSubtitle ? 'Importing...' : 'Import Subtitles'}
      </button>
    </div>
  )
}

export default FileImport
