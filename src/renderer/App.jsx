import React, { useState } from 'react'
import MediaLibrary from './components/MediaLibrary'
import VideoPlayer from './components/VideoPlayer'
import TrimControls from './components/TrimControls'
import ExportButton from './components/ExportButton'
import RecordingPanel from './components/RecordingPanel'
import HorizontalTimeline from './components/HorizontalTimeline'

function App() {
  const [clips, setClips] = useState([])
  const [selectedClip, setSelectedClip] = useState(null)
  const [editableClip, setEditableClip] = useState(null) // Clip that can be edited
  const [lastDropTime, setLastDropTime] = useState(0) // Track last drop time to prevent duplicates
  
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
    // Only preview the clip, don't make it editable
    setSelectedClip(clip)
  }

  const handleTimelineClipSelect = (clip) => {
    // Timeline clips can be both previewed and edited
    setSelectedClip(clip)
    setEditableClip(clip)
  }

  const handleClipDelete = (clipId) => {
    console.log('App: Deleting clip from media library:', clipId)
    
    // Remove from clips array
    setClips(prevClips => prevClips.filter(clip => clip.id !== clipId))
    
    // Remove from timeline as well
    setTimeline(prevTimeline => {
      const newTimeline = { ...prevTimeline }
      
      // Remove the clip from all tracks
      newTimeline.tracks.forEach(track => {
        track.clips = track.clips.filter(timelineClip => timelineClip.clipId !== clipId)
      })
      
      // Recalculate timeline duration
      let maxDuration = 0
      newTimeline.tracks.forEach(track => {
        if (track.clips.length > 0) {
          const lastClip = track.clips[track.clips.length - 1]
          const trackEndTime = lastClip.startTime + lastClip.duration
          maxDuration = Math.max(maxDuration, trackEndTime)
        }
      })
      newTimeline.duration = maxDuration
      
      console.log('App: Updated timeline after media library deletion:', newTimeline)
      return newTimeline
    })
    
    // If the deleted clip was selected or editable, clear selection
    if (selectedClip && selectedClip.id === clipId) {
      const remainingClips = clips.filter(clip => clip.id !== clipId)
      setSelectedClip(remainingClips.length > 0 ? remainingClips[0] : null)
    }
    
    if (editableClip && editableClip.id === clipId) {
      setEditableClip(null)
    }
  }

  const handleTrimUpdate = (clipId, trimData) => {
    // Only allow trimming if the clip is editable
    if (!editableClip || editableClip.id !== clipId) {
      console.log('App: Cannot trim clip - not editable:', clipId)
      return
    }

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

    // Update editable clip if it's the one being trimmed
    if (editableClip && editableClip.id === clipId) {
      setEditableClip(prev => ({ ...prev, ...trimData }))
    }
  }

  const addClipToTimeline = (clip, trackId = 1) => {
    console.log('App: Adding clip to timeline:', clip, 'track:', trackId)
    
    setTimeline(prevTimeline => {
      const newTimeline = { ...prevTimeline }
      const track = newTimeline.tracks.find(t => t.id === trackId)
      
      if (track) {
        console.log('App: Current track clips before adding:', track.clips.map(c => ({ clipId: c.clipId, fileName: c.clip.fileName })))
        
        // Check if this clip is already in the timeline to prevent duplicates
        const existingClip = track.clips.find(timelineClip => timelineClip.clipId === clip.id)
        if (existingClip) {
          console.log('App: Clip already exists in timeline, skipping duplicate:', clip.id, 'existing:', existingClip)
          console.log('App: All current clips in track:', track.clips.map(c => ({ clipId: c.clipId, fileName: c.clip.fileName })))
          return prevTimeline
        }
        
        console.log('App: No existing clip found, proceeding to add:', clip.id)
        
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
    const currentTime = Date.now()
    console.log('App: Clip dropped:', clip, 'on track:', trackId, 'at time:', currentTime)
    
    // Prevent duplicate drops within 500ms
    if (currentTime - lastDropTime < 500) {
      console.log('App: Ignoring duplicate drop - too soon after last drop')
      return
    }
    
    setLastDropTime(currentTime)
    
    // Add a small delay to prevent rapid successive drops
    setTimeout(() => {
      addClipToTimeline(clip, trackId)
    }, 100)
  }

  const handleTimelineClipDelete = (trackId, timelineClip) => {
    console.log('App: Deleting timeline clip:', timelineClip, 'from track:', trackId)
    
    // If the deleted clip was editable, clear the editable state
    if (editableClip && editableClip.id === timelineClip.clipId) {
      setEditableClip(null)
    }
    
    setTimeline(prevTimeline => {
      const newTimeline = { ...prevTimeline }
      const track = newTimeline.tracks.find(t => t.id === trackId)
      
      if (track) {
        // Remove the clip from the track (by clipId only to ensure complete removal)
        const beforeCount = track.clips.length
        track.clips = track.clips.filter(clip => clip.clipId !== timelineClip.clipId)
        const afterCount = track.clips.length
        
        console.log('App: Removed clip from timeline:', timelineClip.clipId, 'clips before:', beforeCount, 'clips after:', afterCount)
        
        // Recalculate timeline duration
        const maxEndTime = Math.max(...track.clips.map(clip => clip.startTime + clip.duration), 0)
        newTimeline.duration = Math.max(...newTimeline.tracks.map(t => 
          Math.max(...t.clips.map(clip => clip.startTime + clip.duration), 0)
        ))
        
        console.log('App: Updated timeline after deletion:', newTimeline)
        console.log('App: Remaining clips in track:', track.clips.map(c => ({ clipId: c.clipId, fileName: c.clip.fileName })))
      }
      
      return newTimeline
    })
  }

  const handleTimelineClipTrim = (clipId, trimData) => {
    console.log('App: Trimming timeline clip:', clipId, 'with data:', trimData)
    
    // Update the timeline clip
    setTimeline(prevTimeline => {
      const newTimeline = { ...prevTimeline }
      
      newTimeline.tracks.forEach(track => {
        track.clips = track.clips.map(clip => {
          if (clip.clipId === clipId) {
            const updatedClip = { ...clip }
            if (trimData.trimStart !== undefined) {
              updatedClip.trimStart = trimData.trimStart
            }
            if (trimData.trimEnd !== undefined) {
              updatedClip.trimEnd = trimData.trimEnd
            }
            // Update duration based on trim
            updatedClip.duration = updatedClip.trimEnd - updatedClip.trimStart
            return updatedClip
          }
          return clip
        })
      })
      
      return newTimeline
    })
    
    // Also update the original clip in the clips array
    setClips(prevClips => 
      prevClips.map(clip => 
        clip.id === clipId 
          ? { ...clip, ...trimData }
          : clip
      )
    )
    
    // Update editable clip if it's the one being trimmed
    if (editableClip && editableClip.id === clipId) {
      setEditableClip(prev => ({ ...prev, ...trimData }))
    }
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
        
        // Select the new recording for preview
        setSelectedClip(newClip)
        
        // Show success message
        alert(`Recording saved to media library: ${fileName}`)
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
            <MediaLibrary 
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
                onClipSelect={handleTimelineClipSelect}
                onClipDelete={handleClipDelete}
                onClipDrop={handleClipDrop}
                onTimelineClipDelete={handleTimelineClipDelete}
                onClipTrim={handleTimelineClipTrim}
                selectedClip={editableClip}
              />
            </div>
            
            <div className="controls-section">
              <RecordingPanel onRecordingComplete={handleRecordingComplete} />
              <TrimControls 
                selectedClip={editableClip} 
                onTrimUpdate={handleTrimUpdate}
              />
              <ExportButton selectedClip={editableClip} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
