import React, { useState } from 'react'
import MediaLibrary from './components/MediaLibrary'
import VideoPlayer from './components/VideoPlayer'
import TimelinePreview from './components/TimelinePreview'
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
    playheadPosition: 0,
    zoomLevel: 1.0
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
    // Don't auto-select imported videos - they should only go to media library
    console.log('App: Video imported to media library, no preview selected')
    console.log('=== APP COMPONENT DEBUG END ===')
  }

  const handleClipSelect = (clip) => {
    // Don't preview clips from media library - only preview when dragged to timeline
    // This function is kept for potential future functionality but doesn't set selectedClip
    console.log('Media library clip clicked:', clip.fileName, '- no preview')
  }

  const handleTimelineClipSelect = (timelineClip) => {
    // Timeline clips can be both previewed and edited
    // Create a modified clip with the timeline's current trim values
    const editableClipWithTimelineTrims = {
      ...timelineClip.clip,
      trimStart: timelineClip.trimStart,
      trimEnd: timelineClip.trimEnd
    }
    
    setSelectedClip(timelineClip.clip)
    setEditableClip(editableClipWithTimelineTrims)
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
      
      // Only reset timeline duration to 0 if no clips remain
      // Don't recalculate timeline duration - keep it static
      const hasAnyClips = newTimeline.tracks.some(track => track.clips.length > 0)
      if (!hasAnyClips) {
        newTimeline.duration = 0
      }
      
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
    
    // Also update the timeline clip if this is a timeline clip
    handleTimelineClipTrim(clipId, trimData)
  }

  const addClipToTimeline = (clip, trackId = 1) => {
    setTimeline(prevTimeline => {
      // Deep copy the timeline to avoid mutation
      const newTimeline = {
        ...prevTimeline,
        tracks: prevTimeline.tracks.map(t => ({ ...t, clips: [...t.clips] }))
      }
      const track = newTimeline.tracks.find(t => t.id === trackId)
      
      if (track) {
        // Check if this clip is already in the timeline to prevent duplicates
        const existingClip = track.clips.find(timelineClip => timelineClip.clipId === clip.id)
        if (existingClip) {
          return prevTimeline // Return the ORIGINAL timeline unchanged
        }
        
        // Create timeline clip
        const timelineClip = {
          clipId: clip.id,
          startTime: 0, // Will be repositioned
          trimStart: clip.trimStart || 0,
          trimEnd: clip.trimEnd || clip.duration,
          clip: clip // Reference to original clip with FULL duration
        }
        
        // Add to track
        track.clips = [...track.clips, timelineClip]
        
        // Reposition all clips in track to be end-to-end using FULL durations
        track.clips = repositionClipsInTrack(track.clips)
        
        // Recalculate timeline duration based on all clips
        newTimeline.duration = recalculateTimelineDuration(newTimeline.tracks)
      }
      
      return newTimeline
    })
    
    // If this is a recording being auto-added, also set it as editable
    if (clip.isRecording) {
      const editableClipWithTimelineTrims = {
        ...clip,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd
      }
      setEditableClip(editableClipWithTimelineTrims)
    }
  }

  const handleClipDragStart = (clip) => {
    console.log('App: Clip drag started:', clip)
  }

  const handleClipDrop = (clip, trackId) => {
    const currentTime = Date.now()
    console.log('App: Clip dropped:', clip, 'on track:', trackId, 'at time:', currentTime)
    
    // Prevent duplicate drops within 200ms (reduced from 500ms)
    if (currentTime - lastDropTime < 200) {
      console.log('App: Ignoring duplicate drop - too soon after last drop')
      return
    }
    
    setLastDropTime(currentTime)
    
    // Add to timeline and set as selected for preview
    addClipToTimeline(clip, trackId)
    setSelectedClip(clip)
    console.log('App: Set selected clip for preview:', clip)
  }

  const handleTimelineClipDelete = (trackId, timelineClip) => {
    console.log('App: Deleting timeline clip:', timelineClip, 'from track:', trackId)
    
    // If the deleted clip was editable, clear the editable state
    if (editableClip && editableClip.id === timelineClip.clipId) {
      setEditableClip(null)
    }
    
    // If the deleted clip is currently being previewed, clear the preview
    if (selectedClip && selectedClip.id === timelineClip.clipId) {
      setSelectedClip(null)
    }
    
    // Reset the trim values in the original clip to its original duration
    setClips(prevClips => 
      prevClips.map(clip => 
        clip.id === timelineClip.clipId 
          ? { 
              ...clip, 
              trimStart: 0, 
              trimEnd: clip.duration // Reset to original duration
            }
          : clip
      )
    )
    
    setTimeline(prevTimeline => {
      const newTimeline = { ...prevTimeline }
      const track = newTimeline.tracks.find(t => t.id === trackId)
      
      if (track) {
        // Remove the clip from the track
        const beforeCount = track.clips.length
        track.clips = track.clips.filter(clip => clip.clipId !== timelineClip.clipId)
        const afterCount = track.clips.length
        
        console.log('App: Removed clip from timeline:', timelineClip.clipId, 'clips before:', beforeCount, 'clips after:', afterCount)
        
        // Reposition remaining clips in track
        track.clips = repositionClipsInTrack(track.clips)
        
        // Recalculate timeline duration
        newTimeline.duration = recalculateTimelineDuration(newTimeline.tracks)
        
        console.log('App: Updated timeline after deletion:', newTimeline)
        console.log('App: Remaining clips in track:', track.clips.map(c => ({ clipId: c.clipId, fileName: c.clip.fileName })))
      }
      
      return newTimeline
    })
  }

  const handleTimelineClipTrim = (clipId, trimData) => {
    console.log('App: Trimming timeline clip:', clipId, 'with data:', trimData)
    
    // Update the timeline clip - ONLY update trim values, do NOT reposition
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
            // DO NOT update duration or startTime - clip maintains full size
            return updatedClip
          }
          return clip
        })
      })
      
      // DO NOT recalculate timeline duration - trimming doesn't change clip positions
      
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

  // Helper function to recalculate timeline duration based on FULL clip durations
  const recalculateTimelineDuration = (tracks) => {
    let maxEndTime = 0
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        // Use FULL original duration, not trimmed
        const endTime = clip.startTime + clip.clip.duration
        maxEndTime = Math.max(maxEndTime, endTime)
      })
    })
    return maxEndTime
  }

  // Helper function to reposition clips in a track end-to-end using FULL durations
  const repositionClipsInTrack = (clips) => {
    let currentTime = 0
    return clips.map(clip => {
      const newClip = { ...clip, startTime: currentTime }
      // Use FULL original duration for spacing
      currentTime += clip.clip.duration
      return newClip
    })
  }

  // Playhead control
  const handlePlayheadMove = (newPosition) => {
    setTimeline(prev => ({
      ...prev,
      playheadPosition: Math.max(0, Math.min(newPosition, prev.duration))
    }))
  }

  // Zoom controls
  const handleZoomIn = () => {
    setTimeline(prev => ({
      ...prev,
      zoomLevel: Math.min(prev.zoomLevel * 1.2, 4.0)
    }))
  }

  const handleZoomOut = () => {
    setTimeline(prev => ({
      ...prev,
      zoomLevel: Math.max(prev.zoomLevel / 1.2, 0.5)
    }))
  }

  const handleZoomReset = () => {
    setTimeline(prev => ({
      ...prev,
      zoomLevel: 1.0
    }))
  }

  // Split clip at playhead position
  const handleClipSplitAtPlayhead = () => {
    const playheadTime = timeline.playheadPosition
    
    setTimeline(prevTimeline => {
      // Deep copy the timeline to avoid mutation
      const newTimeline = {
        ...prevTimeline,
        tracks: prevTimeline.tracks.map(t => ({ ...t, clips: [...t.clips] }))
      }
      
      // Find clip under playhead in active region
      for (const track of newTimeline.tracks) {
        for (let i = 0; i < track.clips.length; i++) {
          const clip = track.clips[i]
          const activeStart = clip.startTime + clip.trimStart
          const activeEnd = clip.startTime + clip.trimEnd
          
          // Only split if playhead is in ACTIVE region
          if (playheadTime > activeStart && playheadTime < activeEnd) {
            // Calculate split point in original video time
            const splitTimeInOriginal = clip.trimStart + (playheadTime - clip.startTime)
            
            // Calculate durations for each segment
            const segment1Duration = splitTimeInOriginal - clip.trimStart
            const segment2Duration = clip.trimEnd - splitTimeInOriginal
            
            // Clip 1: First segment (no dead space)
            const clip1 = {
              clipId: Date.now(),
              startTime: 0, // Will be repositioned
              trimStart: 0,
              trimEnd: segment1Duration,
              clip: {
                ...clip.clip,
                duration: segment1Duration,
                sourceOffset: clip.trimStart, // Where in original video this starts
                isSegment: true
              }
            }
            
            // Clip 2: Second segment (no dead space)
            const clip2 = {
              clipId: Date.now() + 1,
              startTime: 0, // Will be repositioned
              trimStart: 0,
              trimEnd: segment2Duration,
              clip: {
                ...clip.clip,
                duration: segment2Duration,
                sourceOffset: splitTimeInOriginal, // Where in original video this starts
                isSegment: true
              }
            }
            
            // Replace original clip with two split clips
            track.clips[i] = clip1
            track.clips.splice(i + 1, 0, clip2)
            
            // Reposition all clips in track end-to-end
            track.clips = repositionClipsInTrack(track.clips)
            
            // Recalculate timeline duration
            newTimeline.duration = recalculateTimelineDuration(newTimeline.tracks)
            
            return newTimeline
          }
        }
      }
      
      return prevTimeline
    })
  }

  // Split clip at center of active region
  const handleClipSplitAtCenter = (trackId, clipId) => {
    setTimeline(prevTimeline => {
      // Deep copy the timeline to avoid mutation
      const newTimeline = {
        ...prevTimeline,
        tracks: prevTimeline.tracks.map(t => ({ ...t, clips: [...t.clips] }))
      }
      const track = newTimeline.tracks.find(t => t.id === trackId)
      
      if (track) {
        const clipIndex = track.clips.findIndex(c => c.clipId === clipId)
        if (clipIndex >= 0) {
          const clip = track.clips[clipIndex]
          
          // Calculate center of active region
          const activeDuration = clip.trimEnd - clip.trimStart
          const splitTimeInOriginal = clip.trimStart + (activeDuration / 2)
          
          // Calculate durations for each segment
          const segment1Duration = splitTimeInOriginal - clip.trimStart
          const segment2Duration = clip.trimEnd - splitTimeInOriginal
          
          // Clip 1: First segment (no dead space)
          const clip1 = {
            clipId: Date.now(),
            startTime: 0, // Will be repositioned
            trimStart: 0,
            trimEnd: segment1Duration,
            clip: {
              ...clip.clip,
              duration: segment1Duration,
              sourceOffset: clip.trimStart, // Where in original video this starts
              isSegment: true
            }
          }
          
          // Clip 2: Second segment (no dead space)
          const clip2 = {
            clipId: Date.now() + 1,
            startTime: 0, // Will be repositioned
            trimStart: 0,
            trimEnd: segment2Duration,
            clip: {
              ...clip.clip,
              duration: segment2Duration,
              sourceOffset: splitTimeInOriginal, // Where in original video this starts
              isSegment: true
            }
          }
          
          // Replace original clip with two split clips
          track.clips[clipIndex] = clip1
          track.clips.splice(clipIndex + 1, 0, clip2)
          
          // Reposition all clips in track end-to-end
          track.clips = repositionClipsInTrack(track.clips)
          
          // Recalculate timeline duration
          newTimeline.duration = recalculateTimelineDuration(newTimeline.tracks)
        }
      }
      
      return newTimeline
    })
  }

  // Reposition clip to new track/index
  const handleClipReposition = (clipId, sourceTrackId, targetTrackId, targetIndex) => {
    setTimeline(prevTimeline => {
      // Deep copy the timeline to avoid mutation
      const newTimeline = {
        ...prevTimeline,
        tracks: prevTimeline.tracks.map(t => ({ ...t, clips: [...t.clips] }))
      }
      
      const sourceTrack = newTimeline.tracks.find(t => t.id === sourceTrackId)
      const targetTrack = newTimeline.tracks.find(t => t.id === targetTrackId)
      
      if (!sourceTrack || !targetTrack) return prevTimeline
      
      // Find and remove clip from source track
      const clipIndex = sourceTrack.clips.findIndex(c => c.clipId === clipId)
      if (clipIndex < 0) return prevTimeline
      
      const clip = sourceTrack.clips[clipIndex]
      sourceTrack.clips = sourceTrack.clips.filter((_, i) => i !== clipIndex)
      
      // Insert into target track at specified index
      targetTrack.clips.splice(targetIndex, 0, clip)
      
      // Reposition clips in both tracks
      sourceTrack.clips = repositionClipsInTrack(sourceTrack.clips)
      
      if (sourceTrackId !== targetTrackId) {
        targetTrack.clips = repositionClipsInTrack(targetTrack.clips)
      }
      
      // Recalculate timeline duration
      newTimeline.duration = recalculateTimelineDuration(newTimeline.tracks)
      
      return newTimeline
    })
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
        
        // Get video metadata with fallback duration
        const metadata = await window.electronAPI.getVideoMetadata(result.filePath, recordingData.duration)
        console.log('App: Recording metadata:', metadata)
        
        // Generate thumbnail with error handling
        const thumbnailPath = result.filePath.replace(/\.[^/.]+$/, '_thumb.jpg')
        let generatedThumbnail = null
        try {
          generatedThumbnail = await window.electronAPI.generateThumbnail(result.filePath, thumbnailPath)
          console.log('App: Thumbnail generated:', generatedThumbnail)
        } catch (thumbnailError) {
          console.error('App: Thumbnail generation failed:', thumbnailError)
          // Continue without thumbnail - the app will handle missing thumbnails gracefully
          generatedThumbnail = null
        }
        
        // Create clip object (same structure as imported videos)
        // Handle WebM files that might have duration issues
        // Use the actual recording time as the primary duration source
        let duration = recordingData.duration || 0
        
        // Try to get duration from metadata as fallback, but prefer recording time
        if (metadata.duration && metadata.duration !== 'N/A' && !isNaN(metadata.duration)) {
          const metadataDuration = Math.round(metadata.duration)
          // Only use metadata duration if it's reasonable (within 10% of recording time)
          if (Math.abs(metadataDuration - duration) <= Math.max(duration * 0.1, 1)) {
            duration = metadataDuration
          }
        }
        
        console.log('App: Duration calculation - Recording time:', recordingData.duration, 'Metadata duration:', metadata.duration, 'Final duration:', duration)
        
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
        
        // Automatically add recording to timeline (Main track)
        addClipToTimeline(newClip, 1)
        console.log('App: Recording automatically added to timeline')
        
        // Select the new recording for preview
        setSelectedClip(newClip)
        
        // Show success message
        alert(`Recording saved and added to timeline: ${fileName}`)
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
              {(() => {
                const mainTrack = timeline?.tracks?.find(track => track.id === 1)
                const hasTimelineClips = mainTrack?.clips?.length > 0
                
                if (hasTimelineClips) {
                  return <TimelinePreview timeline={timeline} />
                } else {
                  return <VideoPlayer selectedClip={editableClip || selectedClip} />
                }
              })()}
            </div>
            
            <div className="timeline-section">
              <HorizontalTimeline
                timeline={timeline}
                onClipSelect={handleTimelineClipSelect}
                onClipDelete={handleClipDelete}
                onClipDrop={handleClipDrop}
                onTimelineClipDelete={handleTimelineClipDelete}
                onClipTrim={handleTimelineClipTrim}
                onClipReposition={handleClipReposition}
                onClipSplitAtCenter={handleClipSplitAtCenter}
                onClipSplitAtPlayhead={handleClipSplitAtPlayhead}
                onPlayheadMove={handlePlayheadMove}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomReset={handleZoomReset}
                selectedClip={editableClip}
              />
            </div>
            
            <div className="controls-section">
              <RecordingPanel onRecordingComplete={handleRecordingComplete} />
              <TrimControls 
                selectedClip={editableClip} 
                onTrimUpdate={handleTrimUpdate}
              />
              <ExportButton selectedClip={editableClip} timeline={timeline} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
