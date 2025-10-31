import React, { useState } from 'react'
import MediaLibrary from './components/MediaLibrary'
import VideoPlayer from './components/VideoPlayer'
import TimelinePreview from './components/TimelinePreview'
import ExportButton from './components/ExportButton'
import HorizontalTimeline from './components/HorizontalTimeline'

function App() {
  const [clips, setClips] = useState([])
  const [selectedClip, setSelectedClip] = useState(null)
  const [editableClip, setEditableClip] = useState(null) // Clip that can be edited
  const [lastDropTime, setLastDropTime] = useState(0) // Track last drop time to prevent duplicates
  const [showExportModal, setShowExportModal] = useState(false)
  
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
      const newTimeline = { ...prevTimeline }
      
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
        tracks: prevTimeline.tracks.map(t => ({ ...t, clips: [...t.clips] }))
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
            // The timeline shows the full clip duration visually, so we need to map correctly:
            // - For regular clips: playheadRelativeToClip maps directly to original video time
            // - For split clips: playheadRelativeToClip is relative to videoOffsetStart
            // - For trimmed clips: we need to account for trimStart
            // The playhead is in the active region, so: splitTimeInOriginal = clipOffsetStart + (playheadRelativeToClip - trimStart)
            const splitTimeInOriginal = clipOffsetStart + (playheadRelativeToClip - originalTimelineClip.trimStart)
            
            // Get original clip's trim values (relative to full original video)
            // If this is already a split clip, we need to preserve the original trim
            const originalTrimStart = originalTimelineClip.clip.videoOffsetStart !== undefined
              ? originalTimelineClip.clip.videoOffsetStart  // Already accounts for original trim
              : originalTimelineClip.trimStart
            const originalTrimEnd = originalTimelineClip.clip.videoOffsetEnd !== undefined
              ? originalTimelineClip.clip.videoOffsetEnd
              : originalTimelineClip.trimEnd
            
            console.log('Splitting clip at playhead:')
            console.log('  Playhead time:', playheadTime)
            console.log('  Clip offsetStart:', clipOffsetStart, 'offsetEnd:', clipOffsetEnd)
            console.log('  Split time in original video:', splitTimeInOriginal)
            console.log('  Original trimStart:', originalTrimStart, 'trimEnd:', originalTrimEnd)
            
            // Calculate durations for the two new clips
            // Clip 1: from clipOffsetStart to splitTimeInOriginal
            const clip1Duration = splitTimeInOriginal - clipOffsetStart
            // Clip 2: from splitTimeInOriginal to clipOffsetEnd
            const clip2Duration = clipOffsetEnd - splitTimeInOriginal
            
            // For clip 1: Preserve trim from the beginning
            // If original clip had trimStart > 0, clip1 should show that trim
            // clip1's trimStart relative to its own range (clipOffsetStart to splitTimeInOriginal)
            // should be 0, but we need to preserve the visual representation
            // Actually, since clip1 represents clipOffsetStart to splitTimeInOriginal,
            // and clipOffsetStart already accounts for the original trim, clip1 should have trimStart = 0
            // But wait - we need to check if the original clip had trimStart relative to the full video
            
            // Get the original full video duration to calculate trim properly
            const originalFullDuration = originalTimelineClip.clip.originalDuration || originalTimelineClip.clip.duration
            
            // Clip 1: starts at clipOffsetStart, ends at splitTimeInOriginal
            // If originalTrimStart < clipOffsetStart, we need to preserve that visual trim
            // Actually, clipOffsetStart IS the originalTrimStart (active region start)
            // So clip1 should have trimStart = 0 (no trim at start of its range)
            // But we need to preserve the visual representation...
            
            // I think the issue is: clip1 should show the same visual trim as the original clip had
            // But clip1 only represents a portion of the original clip
            // Let me think differently: clip1's trimStart should be relative to clipOffsetStart
            
            // Actually, I think the user wants:
            // - Clip 1: videoOffsetStart = clipOffsetStart, videoOffsetEnd = splitTimeInOriginal
            //   - trimStart = 0 (relative to clipOffsetStart)
            //   - trimEnd = clip1Duration (relative to clipOffsetStart)
            //   - But visually, it should show grey area if originalTrimStart > 0
            
            // Wait, I think I need to reconsider. The visual representation on timeline depends on:
            // - startTime (where clip is positioned)
            // - clip.duration (full visual width)
            // - trimStart/trimEnd (active region within that width)
            
            // So if clip1 has duration = clip1Duration and trimStart = 0, trimEnd = clip1Duration,
            // it will show no grey area. But the user wants to preserve the grey area.
            
            // I think the solution is: clip1 should have a duration that includes the trim area,
            // and trimStart/trimEnd that preserve the trim within that duration.
            
            // If original clip had trimStart relative to full video, and we're splitting,
            // clip1 should preserve that trim relative to its portion.
            // But clip1's videoOffsetStart = clipOffsetStart (which is the active start),
            // so there's no trim to preserve within clip1's range.
            
            // UNLESS... the user wants clip1 to represent the full visual span from the original clip's start
            // Let me check: originalTimelineClip.startTime is where the clip starts visually
            // originalTimelineClip.trimStart is trim relative to that visual start
            // So if originalTimelineClip.trimStart > 0, the clip shows grey area at the start
            
            // When we split, clip1 should start at originalTimelineClip.startTime
            // and clip1 should preserve originalTimelineClip.trimStart as its trimStart
            // But clip1's duration is clip1Duration, not the full original duration
            
            // I think the correct approach is:
            // - Clip1's visual start = originalTimelineClip.startTime
            // - Clip1's duration = clip1Duration (from clipOffsetStart to splitTimeInOriginal)
            // - Clip1's trimStart = originalTimelineClip.trimStart (preserve the trim)
            // - Clip1's trimEnd = originalTimelineClip.trimStart + clip1Duration
            
            // Actually wait, that doesn't work either because trimStart/trimEnd are relative to the clip's duration
            
            // Let me think more carefully. The original timeline clip has:
            // - startTime: where it's positioned on timeline
            // - trimStart: trim relative to startTime (grey area before active region)
            // - trimEnd: end of active region relative to startTime
            // - clip.duration: full video duration
            
            // When splitting at playhead:
            // - playheadTime is absolute timeline position
            // - playheadRelativeToClip = playheadTime - startTime
            // - splitTimeInOriginal = clipOffsetStart + playheadRelativeToClip
            
            // For clip1:
            // - Should start at originalTimelineClip.startTime
            // - Should end at playheadTime (visually)
            // - Should preserve originalTimelineClip.trimStart as its trimStart
            // - Should have trimEnd = playheadRelativeToClip (relative to clip1's start)
            
            // So clip1's trimStart = originalTimelineClip.trimStart (preserved)
            // clip1's trimEnd = playheadRelativeToClip
            
            // For clip2:
            // - Should start at playheadTime
            // - Should end at originalTimelineClip.startTime + originalTimelineClip.clip.duration
            // - Should have trimStart = 0 (no trim at start of clip2)
            // - Should preserve originalTimelineClip.trimEnd as its trimEnd (relative to clip2's start)
            
            // Actually, trimEnd is relative to the clip's duration, not absolute
            
            // Let me reconsider: trimStart and trimEnd on timeline clips are relative to startTime
            // So clip1.trimStart = originalTimelineClip.trimStart (same relative position)
            // clip1.trimEnd = playheadTime - originalTimelineClip.startTime (relative to clip1's startTime)
            
            // clip2.trimStart = 0 (no trim at start, since we're splitting at active region)
            // clip2.trimEnd = originalTimelineClip.trimEnd - (playheadTime - originalTimelineClip.startTime)
            
            // Calculate visual duration for clip1 (from original clip's start to split point)
            // This needs to include the trim area to preserve visual representation
            const clip1VisualDuration = playheadRelativeToClip // From startTime to playheadTime
            
            // Calculate trim values for clip1 (preserve original trim at start)
            const clip1TrimStart = originalTimelineClip.trimStart // Preserve original trim
            const clip1TrimEnd = playheadRelativeToClip // End at split point (relative to clip1's startTime)
            
            // Calculate visual duration for clip2 (from split point to original clip's end)
            const originalClipVisualEnd = originalTimelineClip.startTime + originalTimelineClip.clip.duration
            const clip2VisualDuration = originalClipVisualEnd - playheadTime
            
            // Calculate trim values for clip2 (no trim at start, preserve end trim if any)
            const clip2TrimStart = 0 // No trim at start of clip2
            const clip2TrimEndRelative = originalTimelineClip.trimEnd - playheadRelativeToClip
            const clip2TrimEnd = Math.max(0, clip2TrimEndRelative) // Ensure non-negative
            
            // New clip 1: represents first half of the split
            // Visual duration includes trim area, video offsets represent actual video content
            const newClip1 = {
              ...originalTimelineClip.clip,
              id: Date.now(),
              duration: clip1VisualDuration, // Visual duration (includes trim area)
              filePath: originalTimelineClip.clip.originalFilePath || originalTimelineClip.clip.filePath,
              originalFilePath: originalTimelineClip.clip.originalFilePath || originalTimelineClip.clip.filePath,
              originalDuration: originalTimelineClip.clip.originalDuration || originalTimelineClip.clip.duration,
              videoOffsetStart: clipOffsetStart, // Where in original video this clip starts
              videoOffsetEnd: splitTimeInOriginal, // Where in original video this clip ends
              isSplitClip: true,
              splitSource: originalTimelineClip.clip.splitSource || originalTimelineClip.clip.id,
              trimStart: 0, // Relative to clip1's videoOffsetStart (no trim at start of this portion)
              trimEnd: clip1Duration // Active duration (from clipOffsetStart to splitTimeInOriginal)
            }
            
            // New clip 2: represents second half of the split
            const newClip2 = {
              ...originalTimelineClip.clip,
              id: Date.now() + 1,
              duration: clip2VisualDuration, // Visual duration (from split to original clip end)
              filePath: originalTimelineClip.clip.originalFilePath || originalTimelineClip.clip.filePath,
              originalFilePath: originalTimelineClip.clip.originalFilePath || originalTimelineClip.clip.filePath,
              originalDuration: originalTimelineClip.clip.originalDuration || originalTimelineClip.clip.duration,
              videoOffsetStart: splitTimeInOriginal, // Where in original video this clip starts
              videoOffsetEnd: clipOffsetEnd, // Where in original video this clip ends
              isSplitClip: true,
              splitSource: originalTimelineClip.clip.splitSource || originalTimelineClip.clip.id,
              trimStart: 0, // Relative to clip2's videoOffsetStart (no trim at start of this portion)
              trimEnd: clip2Duration // Active duration (from splitTimeInOriginal to clipOffsetEnd)
            }
            
            // Clip 1: First half - preserve original trim at start
            const timelineClip1 = {
              clipId: newClip1.id,
              startTime: 0, // Will be repositioned
              trimStart: clip1TrimStart, // Preserve original trim at start
              trimEnd: clip1TrimEnd, // End at split point
              clip: newClip1 // Reference to new clip object
            }
            
            // Clip 2: Second half - no trim at start, preserve end trim if any
            const timelineClip2 = {
              clipId: newClip2.id,
              startTime: 0, // Will be repositioned
              trimStart: clip2TrimStart, // No trim at start
              trimEnd: clip2TrimEnd, // Preserve end trim if any
              clip: newClip2 // Reference to new clip object
            }
            
            console.log('  Clip 1 visual duration:', clip1VisualDuration, 'active duration:', clip1Duration, 'trim:', timelineClip1.trimStart, 'to', timelineClip1.trimEnd)
            console.log('  Clip 2 visual duration:', clip2VisualDuration, 'active duration:', clip2Duration, 'trim:', timelineClip2.trimStart, 'to', timelineClip2.trimEnd)
            
            // Replace original clip with two split clips
            track.clips[i] = timelineClip1
            track.clips.splice(i + 1, 0, timelineClip2)
            
            // Reposition all clips in track end-to-end
            track.clips = repositionClipsInTrack(track.clips)
            
            // Recalculate timeline duration
            newTimeline.duration = recalculateTimelineDuration(newTimeline.tracks)
            
            // DO NOT reset playhead after split - keep it at current position
            // Playhead should remain where it was when splitting
            
            // Clear selection after split - clips should go back to blue
            setSelectedClip(null)
            setEditableClip(null)
            
            return newTimeline
          }
        }
      }
      
      return prevTimeline
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
              selectedClip={selectedClip}
              onClipSelect={handleClipSelect}
              onClipDelete={handleClipDelete}
              onVideoImported={handleVideoImported}
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
