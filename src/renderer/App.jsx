import React, { useState } from 'react'
import Timeline from './components/Timeline'
import VideoPlayer from './components/VideoPlayer'
import TrimControls from './components/TrimControls'
import ExportButton from './components/ExportButton'
import RecordingPanel from './components/RecordingPanel'
import HorizontalTimeline from './components/HorizontalTimeline'

function App() {
  const [clips, setClips] = useState([])
  const [selectedClip, setSelectedClip] = useState(null)
  
  // Timeline state
  const [timeline, setTimeline] = useState({
    tracks: [
      { id: 1, name: "Main", clips: [] },
      { id: 2, name: "Overlay", clips: [] }
    ],
    duration: 0,
    playheadPosition: 0
  })

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

  const addClipToTimeline = (clip, trackId = 1) => {
    console.log('App: Adding clip to timeline:', clip, 'track:', trackId)
    
    setTimeline(prevTimeline => {
      const newTimeline = { ...prevTimeline }
      const track = newTimeline.tracks.find(t => t.id === trackId)
      
      if (track) {
        // Calculate start time (end of last clip in track)
        const lastClip = track.clips[track.clips.length - 1]
        const startTime = lastClip ? lastClip.startTime + lastClip.duration : 0
        
        // Create timeline clip
        const timelineClip = {
          clipId: clip.id,
          startTime: startTime,
          duration: clip.trimEnd - clip.trimStart,
          trimStart: clip.trimStart,
          trimEnd: clip.trimEnd,
          clip: clip // Reference to original clip
        }
        
        // Add to track
        track.clips = [...track.clips, timelineClip]
        
        // Update timeline duration
        const trackEndTime = startTime + timelineClip.duration
        newTimeline.duration = Math.max(newTimeline.duration, trackEndTime)
        
        console.log('App: Updated timeline:', newTimeline)
      }
      
      return newTimeline
    })
  }

  const handleClipDragStart = (clip) => {
    console.log('App: Clip drag started:', clip)
  }

  const handleClipDrop = (clip, trackId) => {
    console.log('App: Clip dropped:', clip, 'on track:', trackId)
    addClipToTimeline(clip, trackId)
  }

  const handleRecordingComplete = async (recordingData) => {
    console.log('App: Recording completed:', recordingData)
    
    try {
      // Convert blob to ArrayBuffer
      const arrayBuffer = await recordingData.blob.arrayBuffer()
      
      // Send the recording data to main process to save
      const fileName = recordingData.filename || `recording_${Date.now()}.webm`
      const result = await window.electronAPI.saveRecordingFile(arrayBuffer, fileName)
      
      if (result.success) {
        console.log('App: Recording saved to:', result.filePath)
        
        // Get video metadata
        const metadata = await window.electronAPI.getVideoMetadata(result.filePath)
        console.log('App: Recording metadata:', metadata)
        
        // Generate thumbnail
        const thumbnailPath = result.filePath.replace(/\.[^/.]+$/, '_thumb.jpg')
        const generatedThumbnail = await window.electronAPI.generateThumbnail(result.filePath, thumbnailPath)
        console.log('App: Thumbnail generated:', generatedThumbnail)
        
        // Create clip object (same structure as imported videos)
        // Handle WebM files that might have duration issues
        const duration = metadata.duration && metadata.duration !== 'N/A' ? Math.round(metadata.duration) : 0
        
        const newClip = {
          id: Date.now(),
          filePath: result.filePath,
          fileName: fileName,
          duration: duration,
          width: metadata.width,
          height: metadata.height,
          fileSize: metadata.fileSize,
          codec: metadata.codec,
          bitrate: metadata.bitrate,
          thumbnailPath: generatedThumbnail,
          trimStart: 0,
          trimEnd: duration || 0,
          isRecording: true // Flag to identify recordings
        }
        
        console.log('App: Creating recording clip:', newClip)
        
        // Add to clips array
        setClips(prevClips => {
          const updatedClips = [...prevClips, newClip]
          console.log('App: Updated clips with recording:', updatedClips)
          return updatedClips
        })
        
        // Select the new recording
        setSelectedClip(newClip)
        
        // Auto-add to timeline based on recording type
        let trackId = 1 // Default to main track
        if (recordingData.type === 'pip') {
          trackId = 2 // PiP recordings go to overlay track
        } else if (recordingData.type === 'webcam') {
          trackId = 2 // Webcam recordings go to overlay track
        }
        // Screen recordings go to main track (trackId = 1)
        
        addClipToTimeline(newClip, trackId)
        
        // Show success message
        alert(`Recording saved and added to media library and timeline: ${fileName}`)
      } else {
        throw new Error(result.error || 'Failed to save recording')
      }
      
    } catch (error) {
      console.error('App: Error processing recording:', error)
      alert(`Error processing recording: ${error.message}`)
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
              onClipDragStart={handleClipDragStart}
            />
          </div>
          
          <div className="main-content">
            <div className="player-section">
              <VideoPlayer selectedClip={selectedClip} />
            </div>
            
            <div className="timeline-section">
              <HorizontalTimeline 
                timeline={timeline}
                onClipSelect={handleClipSelect}
                onClipDelete={handleClipDelete}
                onClipDrop={handleClipDrop}
              />
            </div>
            
            <div className="controls-section">
              <RecordingPanel onRecordingComplete={handleRecordingComplete} />
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
