import React, { useState } from 'react'
import MediaLibrary from './components/MediaLibrary'
import VideoPlayer from './components/VideoPlayer'
import TimelinePreview from './components/TimelinePreview'
import ExportButton from './components/ExportButton'
import HorizontalTimeline from './components/HorizontalTimeline'

function App() {
  const [clips, setClips] = useState([])
  const [subtitleFiles, setSubtitleFiles] = useState([])
  const [selectedClip, setSelectedClip] = useState(null)
  const [editableClip, setEditableClip] = useState(null) // Clip that can be edited
  const [lastDropTime, setLastDropTime] = useState(0) // Track last drop time to prevent duplicates
  const [showExportModal, setShowExportModal] = useState(false)
  
  // Timeline state
  const [timeline, setTimeline] = useState({
    tracks: [
      { id: 1, name: "Main", clips: [] },
      { id: 2, name: "Subtitles", clips: [] }
    ],
    duration: 0,
    playheadPosition: 0,
    zoomLevel: 1.0,
    subtitles: [] // Array of subtitle segments: { id, startTime, endTime, text, clipId }
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

  const handleSubtitleImported = (subtitleData) => {
    console.log('App: Subtitle imported:', subtitleData)
    
    // Try to match subtitle file with a video file by base name
    // Extract base name (without extension) from subtitle file
    const subtitleBaseName = subtitleData.fileName.replace(/\.[^/.]+$/, '')
    
    // Find matching video file by base name
    const matchingVideo = clips.find(clip => {
      const videoBaseName = clip.fileName.replace(/\.[^/.]+$/, '')
      return videoBaseName === subtitleBaseName || 
             videoBaseName === subtitleBaseName.replace(/_subtitles$/, '') ||
             subtitleBaseName === videoBaseName + '_subtitles'
    })
    
    // Determine the display name
    let displayName = subtitleData.fileName
    if (matchingVideo) {
      // Use video file base name + "_subtitles" + subtitle extension
      const videoBaseName = matchingVideo.fileName.replace(/\.[^/.]+$/, '')
      const subtitleExt = subtitleData.fileName.match(/\.[^/.]+$/)
      displayName = `${videoBaseName}_subtitles${subtitleExt ? subtitleExt[0] : '.srt'}`
    }
    
    const newSubtitleFile = {
      id: Date.now(),
      filePath: subtitleData.filePath,
      fileName: displayName, // Use renamed display name
      originalFileName: subtitleData.fileName, // Keep original for reference
      fileSize: subtitleData.fileSize,
      subtitles: subtitleData.subtitles || [],
      associatedVideoId: matchingVideo?.id || null
    }
    
    setSubtitleFiles(prev => [...prev, newSubtitleFile])
    
    // Don't automatically add to timeline - user must drag them manually
    if (subtitleData.subtitles && subtitleData.subtitles.length > 0) {
      const matchMsg = matchingVideo ? ` (matched with ${matchingVideo.fileName})` : ''
      alert(`Subtitle file imported: ${displayName} (${subtitleData.subtitles.length} segments)${matchMsg}. Drag to timeline to add.`)
    } else {
      alert(`Subtitle file imported but no valid segments found: ${displayName}`)
    }
  }

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
    // Store the clipId so we can distinguish between split clips
    const editableClipWithTimelineTrims = {
      ...timelineClip.clip,
      id: timelineClip.clipId, // Use clipId to distinguish split clips
      trimStart: timelineClip.trimStart,
      trimEnd: timelineClip.trimEnd
    }
    
    setSelectedClip(timelineClip.clip)
    setEditableClip(editableClipWithTimelineTrims)
  }

  const handleClipDelete = (clipId) => {
    console.log('App: Deleting clip from media library:', clipId)
    
    // Check if it's a subtitle file
    const subtitleFile = subtitleFiles.find(sf => sf.id === clipId)
    if (subtitleFile) {
      // Remove subtitle file
      setSubtitleFiles(prev => prev.filter(sf => sf.id !== clipId))
      
      // Remove associated subtitles from timeline
      setTimeline(prevTimeline => ({
        ...prevTimeline,
        subtitles: prevTimeline.subtitles.filter(subtitle => 
          !subtitleFile.subtitles.some(s => s.id === subtitle.id)
        )
      }))
      
      return
    }
    
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
        
        // Set playhead to beginning of first clip's active region when adding to empty timeline
        const wasEmpty = prevTimeline.duration === 0
        if (wasEmpty && track.clips.length > 0) {
          const firstClip = track.clips[0]
          // Position playhead at the start of the active region (not grey area)
          newTimeline.playheadPosition = firstClip.startTime + firstClip.trimStart
          console.log('App: Setting playhead to start of first clip active region:', newTimeline.playheadPosition)
        }
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
    // Check if it's a subtitle file
    if (clip.type === 'subtitle') {
      // Add subtitles to timeline
      if (clip.subtitles && clip.subtitles.length > 0) {
        // Find associated video to determine track name
        let trackName = 'Subtitles'
        if (clip.associatedVideoId) {
          const associatedVideo = clips.find(c => c.id === clip.associatedVideoId)
          if (associatedVideo) {
            const videoBaseName = associatedVideo.fileName.replace(/\.[^/.]+$/, '')
            trackName = `${videoBaseName}_subtitles`
          }
        } else {
          // Try to match by name or find first video in timeline
          const mainTrack = timeline.tracks.find(t => t.id === 1)
          if (mainTrack && mainTrack.clips.length > 0) {
            // Use first video clip's name
            const firstVideo = mainTrack.clips[0].clip
            const videoBaseName = firstVideo.fileName.replace(/\.[^/.]+$/, '')
            trackName = `${videoBaseName}_subtitles`
          }
        }
        
        setTimeline(prevTimeline => {
          const newTimeline = { ...prevTimeline }
          // Update subtitle track name
          const subtitleTrack = newTimeline.tracks.find(t => t.id === 2)
          if (subtitleTrack) {
            subtitleTrack.name = trackName
          }
          // Add subtitle segments (keep them separate)
          newTimeline.subtitles = [...prevTimeline.subtitles, ...clip.subtitles]
          return newTimeline
        })
        alert(`Subtitles added to timeline: ${clip.subtitles.length} segments`)
      }
      return
    }
    
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
    
    // Set as editable so trimming works
    const editableClipWithTrims = {
      ...clip,
      trimStart: clip.trimStart || 0,
      trimEnd: clip.trimEnd || clip.duration
    }
    setEditableClip(editableClipWithTrims)
    console.log('App: Set selected clip and editable clip for preview:', clip)
  }

  const handleTimelineClipDelete = (trackId, timelineClip) => {
    console.log('App: Deleting timeline clip:', timelineClip, 'from track:', trackId)
    
    // If the deleted clip was editable, clear the editable state
    if (editableClip && (editableClip.id === timelineClip.clipId || editableClip.id === timelineClip.clip.id)) {
      setEditableClip(null)
    }
    
    // If the deleted clip is currently being previewed, clear the preview
    if (selectedClip && (selectedClip.id === timelineClip.clipId || selectedClip.id === timelineClip.clip.id)) {
      setSelectedClip(null)
    }
    
    // Reset the trim values in the original clip to its original duration
    setClips(prevClips => 
      prevClips.map(clip => 
        (clip.id === timelineClip.clipId || clip.id === timelineClip.clip.id)
          ? { 
              ...clip, 
              trimStart: 0, 
              trimEnd: clip.duration // Reset to original duration
            }
          : clip
      )
    )
    
    setTimeline(prevTimeline => {
      const newTimeline = { ...prevTimeline, subtitles: [...prevTimeline.subtitles] }
      const track = newTimeline.tracks.find(t => t.id === trackId)
      
      if (track) {
        // Remove the clip from the track
        const beforeCount = track.clips.length
        track.clips = track.clips.filter(clip => clip.clipId !== timelineClip.clipId)
        const afterCount = track.clips.length
        
        console.log('App: Removed clip from timeline:', timelineClip.clipId, 'clips before:', beforeCount, 'clips after:', afterCount)
        
        // Remove associated subtitle segments
        newTimeline.subtitles = newTimeline.subtitles.filter(subtitle => subtitle.clipId !== timelineClip.clipId)
        
        // Reposition remaining clips in track
        track.clips = repositionClipsInTrack(track.clips)
        
        // Recalculate timeline duration
        newTimeline.duration = recalculateTimelineDuration(newTimeline.tracks)
        
        // Reset playhead to beginning of first clip's active region if timeline becomes empty
        const hasAnyClips = newTimeline.tracks.some(t => t.clips.length > 0)
        if (!hasAnyClips) {
          newTimeline.playheadPosition = 0
        }
        // If still has clips, clamp playhead to valid range
        else {
          // Find the first clip in the main track
          const mainTrack = newTimeline.tracks.find(t => t.id === 1)
          if (mainTrack && mainTrack.clips.length > 0) {
            const firstClip = mainTrack.clips[0]
            const firstActiveStart = firstClip.startTime + firstClip.trimStart
            
            // If playhead is before the first clip's active region, reset to active start
            if (newTimeline.playheadPosition < firstActiveStart) {
              newTimeline.playheadPosition = firstActiveStart
            }
            // If playhead is beyond timeline duration, clamp to duration
            else if (newTimeline.playheadPosition > newTimeline.duration) {
              newTimeline.playheadPosition = Math.max(firstActiveStart, newTimeline.duration)
            }
          }
        }
        
        console.log('App: Updated timeline after deletion:', newTimeline)
        console.log('App: Remaining clips in track:', track.clips.map(c => ({ clipId: c.clipId, fileName: c.clip.fileName })))
      }
      
      return newTimeline
    })
  }

  const handleTimelineClipTrim = (clipId, trimData) => {
    // Capture current playhead position before trimming
    const currentPlayheadPosition = timeline.playheadPosition
    
    // Update the timeline clip - ONLY update trim values, do NOT reposition
    setTimeline(prevTimeline => {
      const newTimeline = { ...prevTimeline, subtitles: [...prevTimeline.subtitles] }
      
      let affectedClip = null
      let oldTrimStart = 0
      let oldTrimEnd = 0
      
      // Update trim values and capture old values
      newTimeline.tracks.forEach((track) => {
        track.clips = track.clips.map((clip) => {
          if (clip.clipId === clipId) {
            affectedClip = { ...clip }
            oldTrimStart = clip.trimStart
            oldTrimEnd = clip.trimEnd
            
            // Apply new trim values
            if (trimData.trimStart !== undefined) {
              affectedClip.trimStart = trimData.trimStart
            }
            if (trimData.trimEnd !== undefined) {
              affectedClip.trimEnd = trimData.trimEnd
            }
            
            // DO NOT update duration or startTime - clip maintains full size
            return affectedClip
          }
          return clip
        })
      })
      
      // Adjust subtitle segments for the trimmed clip
      if (affectedClip) {
        const clipVisualStart = affectedClip.startTime
        const newActiveStart = affectedClip.startTime + affectedClip.trimStart
        const newActiveEnd = affectedClip.startTime + affectedClip.trimEnd
        
        // Filter out or adjust subtitle segments that fall outside the active region
        newTimeline.subtitles = newTimeline.subtitles.map(subtitle => {
          if (subtitle.clipId === clipId) {
            // Check if subtitle is within the new active region
            if (subtitle.endTime <= newActiveStart || subtitle.startTime >= newActiveEnd) {
              // Subtitle is completely outside the active region - mark for removal
              return null
            } else if (subtitle.startTime < newActiveStart && subtitle.endTime > newActiveStart) {
              // Subtitle starts before active region - trim the start
              return { ...subtitle, startTime: newActiveStart }
            } else if (subtitle.endTime > newActiveEnd && subtitle.startTime < newActiveEnd) {
              // Subtitle ends after active region - trim the end
              return { ...subtitle, endTime: newActiveEnd }
            }
          }
          return subtitle
        }).filter(Boolean) // Remove null entries
      }
      
      // Playhead adjustment logic: Move playhead if trim handle passes it
      if (affectedClip && currentPlayheadPosition !== undefined && currentPlayheadPosition !== null) {
        // Calculate active regions (where video is actually visible, not greyed out)
        const clipVisualStart = affectedClip.startTime
        const clipVisualEnd = affectedClip.startTime + affectedClip.clip.duration
        const newActiveStart = affectedClip.startTime + affectedClip.trimStart
        const newActiveEnd = affectedClip.startTime + affectedClip.trimEnd
        
        console.log('=== Playhead Trim Check ===')
        console.log('  Current playhead position:', currentPlayheadPosition)
        console.log('  Clip visual bounds:', clipVisualStart, 'to', clipVisualEnd)
        console.log('  New active region:', newActiveStart, 'to', newActiveEnd)
        
        // Check if playhead is anywhere within this clip's visual bounds (including grey areas)
        if (currentPlayheadPosition >= clipVisualStart && currentPlayheadPosition < clipVisualEnd) {
          console.log('  -> Playhead is within clip visual bounds')
          
          // Check if trimming from the FRONT passes the playhead
          // Playhead should follow the trim handle when it moves past the playhead
          if (newActiveStart > currentPlayheadPosition) {
            console.log('  -> Front trim passed playhead, moving to:', newActiveStart)
            newTimeline.playheadPosition = newActiveStart
          }
          // Check if trimming from the BACK passes the playhead
          // Playhead should follow the trim handle when it moves past the playhead
          else if (newActiveEnd < currentPlayheadPosition) {
            console.log('  -> Back trim passed playhead, moving to:', newActiveEnd)
            newTimeline.playheadPosition = newActiveEnd
          }
          else {
            console.log('  -> Playhead is within active region, no change')
            // Playhead is within the active region, don't move it
            newTimeline.playheadPosition = currentPlayheadPosition
          }
        } else {
          console.log('  -> Playhead is outside clip, no adjustment')
          // Playhead is not in this clip at all, so trimming doesn't affect it
          newTimeline.playheadPosition = currentPlayheadPosition
        }
      }
      
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
      let currentTime = 0
      track.clips.forEach(clip => {
        // Use FULL duration for spacing to prevent overlap
        const fullDuration = clip.clip.duration
        currentTime += fullDuration
        maxEndTime = Math.max(maxEndTime, currentTime)
      })
    })
    return maxEndTime
  }

  // Helper function to reposition clips in a track end-to-end using FULL durations
  const repositionClipsInTrack = (clips) => {
    let currentTime = 0
    return clips.map(clip => {
      const newClip = { ...clip, startTime: currentTime }
      // Use FULL duration for spacing to prevent overlap
      const fullDuration = clip.clip.duration
      currentTime += fullDuration
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

  // Zoom controls with playhead-centered zooming
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
        tracks: prevTimeline.tracks.map(t => ({ ...t, clips: [...t.clips] })),
        subtitles: [...prevTimeline.subtitles]
      }
      
      // Find clip under playhead in active region
      // Note: playheadTime is the visual position on timeline (based on full durations)
      // We need to find which clip contains this position and check if it's in the active region
      for (const track of newTimeline.tracks) {
        for (let i = 0; i < track.clips.length; i++) {
          const originalTimelineClip = track.clips[i]
          
          // Calculate visual bounds of this clip on the timeline
          const clipVisualStart = originalTimelineClip.startTime
          const clipVisualEnd = originalTimelineClip.startTime + originalTimelineClip.clip.duration
          
          // Check if playhead is within this clip's visual bounds
          if (playheadTime >= clipVisualStart && playheadTime < clipVisualEnd) {
            // Now check if playhead is in the ACTIVE region (not in greyed-out trim area)
            const activeStart = originalTimelineClip.startTime + originalTimelineClip.trimStart
            const activeEnd = originalTimelineClip.startTime + originalTimelineClip.trimEnd
            
            if (playheadTime <= activeStart || playheadTime >= activeEnd) {
              // Playhead is in trim region (greyed out area), can't split here
              console.log('Cannot split: playhead is in trimmed region')
              return prevTimeline
            }
            
            // Calculate split point in original video time
            // For split clips, we need to use their videoOffsetStart instead of trimStart
            const clipOffsetStart = originalTimelineClip.clip.videoOffsetStart !== undefined 
              ? originalTimelineClip.clip.videoOffsetStart 
              : originalTimelineClip.trimStart
            const clipOffsetEnd = originalTimelineClip.clip.videoOffsetEnd !== undefined 
              ? originalTimelineClip.clip.videoOffsetEnd 
              : originalTimelineClip.trimEnd
            
            // Calculate where the playhead is relative to the clip's start on timeline
            const playheadRelativeToClip = playheadTime - originalTimelineClip.startTime
            // Map to original video time
            const splitTimeInOriginal = clipOffsetStart + (playheadRelativeToClip - originalTimelineClip.trimStart)
            
            // Get original clip's trim values (relative to full original video)
            const originalTrimStart = originalTimelineClip.clip.videoOffsetStart !== undefined
              ? originalTimelineClip.clip.videoOffsetStart
              : originalTimelineClip.trimStart
            const originalTrimEnd = originalTimelineClip.clip.videoOffsetEnd !== undefined
              ? originalTimelineClip.clip.videoOffsetEnd
              : originalTimelineClip.trimEnd
            
            console.log('Splitting clip at playhead:')
            console.log('  Playhead time:', playheadTime)
            console.log('  Clip offsetStart:', clipOffsetStart, 'offsetEnd:', clipOffsetEnd)
            console.log('  Split time in original video:', splitTimeInOriginal)
            
            // Calculate durations for the two new clips
            const clip1Duration = splitTimeInOriginal - clipOffsetStart
            const clip2Duration = clipOffsetEnd - splitTimeInOriginal
            
            // Calculate visual duration for clip1
            const clip1VisualDuration = playheadRelativeToClip
            
            // Calculate trim values for clip1
            const clip1TrimStart = originalTimelineClip.trimStart
            const clip1TrimEnd = playheadRelativeToClip
            
            // Calculate visual duration for clip2
            const originalClipVisualEnd = originalTimelineClip.startTime + originalTimelineClip.clip.duration
            const clip2VisualDuration = originalClipVisualEnd - playheadTime
            
            // Calculate trim values for clip2
            const clip2TrimStart = 0
            const clip2TrimEndRelative = originalTimelineClip.trimEnd - playheadRelativeToClip
            const clip2TrimEnd = Math.max(0, clip2TrimEndRelative)
            
            // New clip 1: represents first half of the split
            const newClip1 = {
              ...originalTimelineClip.clip,
              id: Date.now(),
              duration: clip1VisualDuration,
              filePath: originalTimelineClip.clip.originalFilePath || originalTimelineClip.clip.filePath,
              originalFilePath: originalTimelineClip.clip.originalFilePath || originalTimelineClip.clip.filePath,
              originalDuration: originalTimelineClip.clip.originalDuration || originalTimelineClip.clip.duration,
              videoOffsetStart: clipOffsetStart,
              videoOffsetEnd: splitTimeInOriginal,
              isSplitClip: true,
              splitSource: originalTimelineClip.clip.splitSource || originalTimelineClip.clip.id,
              trimStart: 0,
              trimEnd: clip1Duration
            }
            
            // New clip 2: represents second half of the split
            const newClip2 = {
              ...originalTimelineClip.clip,
              id: Date.now() + 1,
              duration: clip2VisualDuration,
              filePath: originalTimelineClip.clip.originalFilePath || originalTimelineClip.clip.filePath,
              originalFilePath: originalTimelineClip.clip.originalFilePath || originalTimelineClip.clip.filePath,
              originalDuration: originalTimelineClip.clip.originalDuration || originalTimelineClip.clip.duration,
              videoOffsetStart: splitTimeInOriginal,
              videoOffsetEnd: clipOffsetEnd,
              isSplitClip: true,
              splitSource: originalTimelineClip.clip.splitSource || originalTimelineClip.clip.id,
              trimStart: 0,
              trimEnd: clip2Duration
            }
            
            // Clip 1: First half
            const timelineClip1 = {
              clipId: newClip1.id,
              startTime: 0,
              trimStart: clip1TrimStart,
              trimEnd: clip1TrimEnd,
              clip: newClip1
            }
            
            // Clip 2: Second half
            const timelineClip2 = {
              clipId: newClip2.id,
              startTime: 0,
              trimStart: clip2TrimStart,
              trimEnd: clip2TrimEnd,
              clip: newClip2
            }
            
            // Replace original clip with two split clips
            track.clips[i] = timelineClip1
            track.clips.splice(i + 1, 0, timelineClip2)
            
            // Reposition all clips in track end-to-end
            track.clips = repositionClipsInTrack(track.clips)
            
            // Recalculate timeline duration
            newTimeline.duration = recalculateTimelineDuration(newTimeline.tracks)
            
            // Split subtitle segments that overlap the split point
            newTimeline.subtitles = newTimeline.subtitles.flatMap(subtitle => {
              // Check if this subtitle belongs to the clip being split
              if (subtitle.clipId === originalTimelineClip.clipId) {
                // Subtitle belongs to the clip being split
                // Check if split point is within this subtitle segment
                if (subtitle.startTime < playheadTime && subtitle.endTime > playheadTime) {
                  // Split the subtitle into two segments
                  return [
                    { ...subtitle, id: `subtitle_${Date.now()}_split1`, endTime: playheadTime, clipId: newClip1.id },
                    { ...subtitle, id: `subtitle_${Date.now()}_split2`, startTime: playheadTime, clipId: newClip2.id }
                  ]
                } else if (subtitle.startTime < playheadTime) {
                  // Subtitle is before split point, assign to clip 1
                  return [{ ...subtitle, clipId: newClip1.id }]
                } else {
                  // Subtitle is after split point, assign to clip 2
                  return [{ ...subtitle, clipId: newClip2.id }]
                }
              }
              return [subtitle]
            })
            
            // Clear selection after split
            setSelectedClip(null)
            setEditableClip(null)
            
            return newTimeline
          }
        }
      }
      
      return prevTimeline
    })
  }

  // Handle transcription request
  const handleTranscribe = async () => {
    try {
      // Get main track clips
      const mainTrack = timeline.tracks.find(t => t.id === 1)
      if (!mainTrack || mainTrack.clips.length === 0) {
        alert('No clips in timeline to transcribe')
        return
      }
      
      // Check for API key - it should be loaded from .env automatically
      const apiKey = await window.electronAPI.getOpenAIApiKey()
      if (!apiKey) {
        alert('OpenAI API key not found. Please set OPENAI_API_KEY in your .env file.')
        return
      }
      
      // Prepare clips data
      const clipsData = mainTrack.clips.map(timelineClip => {
        const startTime = timelineClip.clip.videoOffsetStart !== undefined 
          ? timelineClip.clip.videoOffsetStart 
          : timelineClip.trimStart
        const endTime = timelineClip.clip.videoOffsetEnd !== undefined 
          ? timelineClip.clip.videoOffsetEnd 
          : timelineClip.trimEnd
        
        let filePath = timelineClip.clip.originalFilePath || timelineClip.clip.filePath
        
        // Normalize file path
        if (filePath.startsWith('local://')) {
          filePath = filePath.replace('local://', '')
        }
        if (filePath.startsWith('file://')) {
          filePath = filePath.replace('file://', '')
        }
        
        return {
          filePath: filePath,
          startTime: startTime,
          duration: endTime - startTime,
          clipId: timelineClip.clipId
        }
      })
      
      console.log('App: Starting transcription for clips:', clipsData)
      
      // Call transcription API
      const result = await window.electronAPI.transcribeAudio({ clips: clipsData })
      
      if (result.success) {
        console.log('App: Transcription complete, segments:', result.segments.length)
        
        // Map segments to timeline positions
        let currentTimelinePosition = 0
        const mappedSegments = result.segments.map((segment, index) => {
          // Find which clip this segment belongs to based on timing
          let clipId = null
          let segmentStartTime = segment.startTime
          let segmentEndTime = segment.endTime
          
          // Map segment times to timeline positions
          let accumulatedTime = 0
          for (const clip of clipsData) {
            if (segment.startTime >= accumulatedTime && segment.startTime < accumulatedTime + clip.duration) {
              clipId = clip.clipId
              segmentStartTime = segment.startTime - accumulatedTime + currentTimelinePosition
              segmentEndTime = segment.endTime - accumulatedTime + currentTimelinePosition
              break
            }
            accumulatedTime += clip.duration
            currentTimelinePosition += clip.duration
          }
          
          return {
            ...segment,
            startTime: segmentStartTime,
            endTime: segmentEndTime,
            clipId: clipId
          }
        })
        
        // Update timeline with subtitles
        setTimeline(prev => {
          // Determine track name from first video clip
          const mainTrack = prev.tracks.find(t => t.id === 1)
          let trackName = 'Subtitles'
          if (mainTrack && mainTrack.clips.length > 0) {
            const firstVideo = mainTrack.clips[0].clip
            const videoBaseName = firstVideo.fileName.replace(/\.[^/.]+$/, '')
            trackName = `${videoBaseName}_subtitles`
          }
          
          const newTimeline = { ...prev }
          // Update subtitle track name
          const subtitleTrack = newTimeline.tracks.find(t => t.id === 2)
          if (subtitleTrack) {
            subtitleTrack.name = trackName
          }
          
          return {
            ...newTimeline,
            subtitles: mappedSegments
          }
        })
        
        alert('Transcription complete! Subtitles added to timeline.')
      }
      
    } catch (error) {
      console.error('App: Transcription error:', error)
      alert(`Transcription failed: ${error.message}`)
    }
  }

  // Handle subtitle deletion
  const handleSubtitleDelete = (subtitle) => {
    console.log('App: Deleting subtitle:', subtitle)
    
    setTimeline(prevTimeline => ({
      ...prevTimeline,
      subtitles: prevTimeline.subtitles.filter(s => s.id !== subtitle.id)
    }))
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
      
      // Reposition clips in the affected track(s) AFTER both remove and insert are done
      if (sourceTrackId === targetTrackId) {
        // Same track - only reposition once
        targetTrack.clips = repositionClipsInTrack(targetTrack.clips)
      } else {
        // Different tracks - reposition both
        sourceTrack.clips = repositionClipsInTrack(sourceTrack.clips)
        targetTrack.clips = repositionClipsInTrack(targetTrack.clips)
      }
      
      // DO NOT recalculate timeline duration - just reorganizing clips shouldn't change total duration
      
      // Reset playhead to beginning of first clip's active region after repositioning
      const mainTrack = newTimeline.tracks.find(t => t.id === 1)
      if (mainTrack && mainTrack.clips.length > 0) {
        const firstClip = mainTrack.clips[0]
        newTimeline.playheadPosition = firstClip.startTime + firstClip.trimStart
        console.log('App: Resetting playhead after reposition to:', newTimeline.playheadPosition)
      }
      
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
        <h1>ClipEdit</h1>
      </header>
      
      <main className="app-main">
        <div className="app-layout">
          <div className="sidebar">
            <MediaLibrary 
              clips={clips}
              subtitleFiles={subtitleFiles}
              selectedClip={selectedClip}
              onClipSelect={handleClipSelect}
              onClipDelete={handleClipDelete}
              onVideoImported={handleVideoImported}
              onSubtitleImported={handleSubtitleImported}
              onClipDragStart={handleClipDragStart}
              onRecordingComplete={handleRecordingComplete}
            />
          </div>
          
          <div className="main-content">
            <div className="player-section">
              {(() => {
                const mainTrack = timeline?.tracks?.find(track => track.id === 1)
                const hasTimelineClips = mainTrack?.clips?.length > 0
                
                if (hasTimelineClips) {
                  return <TimelinePreview timeline={timeline} onPlayheadMove={handlePlayheadMove} />
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
                onClipSplitAtPlayhead={handleClipSplitAtPlayhead}
                onPlayheadMove={handlePlayheadMove}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomReset={handleZoomReset}
                selectedClip={editableClip}
                onExportClick={() => setShowExportModal(true)}
                onTranscribe={handleTranscribe}
                onSubtitleDelete={handleSubtitleDelete}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Export Video</h3>
              <button 
                className="modal-close"
                onClick={() => setShowExportModal(false)}
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <ExportButton selectedClip={editableClip} timeline={timeline} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
