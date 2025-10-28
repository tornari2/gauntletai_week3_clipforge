import React, { useState } from 'react'
import Timeline from './components/Timeline'
import VideoPlayer from './components/VideoPlayer'
import TrimControls from './components/TrimControls'
import ExportButton from './components/ExportButton'

function App() {
  const [clips, setClips] = useState([])
  const [selectedClip, setSelectedClip] = useState(null)

  // Debug: Check if electronAPI is available
  React.useEffect(() => {
    console.log('=== APP LOADING DEBUG ===')
    console.log('App: React app loaded successfully!')
    console.log('App: window object available?', !!window)
    console.log('App: electronAPI available?', !!window.electronAPI)
    console.log('App: electronAPI methods:', window.electronAPI ? Object.keys(window.electronAPI) : 'Not available')
    console.log('App: Current clips state:', clips)
    console.log('App: Current selectedClip state:', selectedClip)
    console.log('=== APP LOADING DEBUG END ===')
  }, [])

  const handleVideoImported = (videoData) => {
    console.log('=== APP COMPONENT DEBUG START ===')
    console.log('App: handleVideoImported called with:', videoData)
    console.log('App: Current clips before update:', clips)
    console.log('App: Current selectedClip before update:', selectedClip)
    
    const newClip = {
      id: Date.now(),
      filePath: videoData.filePath,
      fileName: videoData.fileName,
      duration: videoData.duration,
      width: videoData.width,
      height: videoData.height,
      fileSize: videoData.fileSize,
      codec: videoData.codec,
      bitrate: videoData.bitrate,
      thumbnailPath: videoData.thumbnailPath,
      trimStart: 0,
      trimEnd: videoData.duration
    }
    console.log('App: Creating new clip:', newClip)
    
    setClips(prevClips => {
      const updatedClips = [...prevClips, newClip]
      console.log('App: Updated clips:', updatedClips)
      return updatedClips
    })
    setSelectedClip(newClip)
    console.log('App: Set selected clip to:', newClip)
    console.log('=== APP COMPONENT DEBUG END ===')
  }

  const handleClipSelect = (clip) => {
    setSelectedClip(clip)
  }

  const handleClipDelete = (clipId) => {
    setClips(prevClips => prevClips.filter(clip => clip.id !== clipId))
    
    // If the deleted clip was selected, clear selection or select another clip
    if (selectedClip && selectedClip.id === clipId) {
      const remainingClips = clips.filter(clip => clip.id !== clipId)
      setSelectedClip(remainingClips.length > 0 ? remainingClips[0] : null)
    }
  }

  const handleTrimUpdate = (clipId, trimData) => {
    setClips(prevClips => 
      prevClips.map(clip => 
        clip.id === clipId 
          ? { ...clip, ...trimData }
          : clip
      )
    )
    
    // Update selected clip if it's the one being trimmed
    if (selectedClip && selectedClip.id === clipId) {
      setSelectedClip(prev => ({ ...prev, ...trimData }))
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>ClipForge MVP</h1>
      </header>
      
      <main className="app-main">
        <div className="app-layout">
          <div className="sidebar">
            <Timeline 
              clips={clips}
              selectedClip={selectedClip}
              onClipSelect={handleClipSelect}
              onClipDelete={handleClipDelete}
              onVideoImported={handleVideoImported}
            />
          </div>
          
          <div className="main-content">
            <div className="player-section">
              <VideoPlayer selectedClip={selectedClip} />
            </div>
            
            <div className="controls-section">
              <TrimControls 
                selectedClip={selectedClip} 
                onTrimUpdate={handleTrimUpdate}
              />
              <ExportButton selectedClip={selectedClip} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
