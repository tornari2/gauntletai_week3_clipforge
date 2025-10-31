import React, { useRef, useState, useEffect } from 'react'

const TimelinePreview = ({ timeline, onPlayheadMove }) => {
  const videoRef = useRef(null)
  const progressBarRef = useRef(null)
  const seekHandleRef = useRef(null)
  const timeDisplayRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentClipIndex, setCurrentClipIndex] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [clips, setClips] = useState([])
  const shouldPlayRef = useRef(false) // Track if we should be playing during transitions
  const animationFrameRef = useRef(null) // For throttling playhead updates
  const currentTimeRef = useRef(0) // Track current time without causing re-renders
  const lastPlayheadPositionRef = useRef(null) // Track last playhead position to avoid unnecessary updates
  const isDraggingSeekRef = useRef(false) // Track if user is dragging the seek bar
  const currentVideoSrcRef = useRef(null) // Track current video source to avoid unnecessary reloads
  const actualClipIndexRef = useRef(0) // Track actual clip we're in without causing re-renders during scrubbing
  const isTransitioningRef = useRef(false) // Prevent multiple simultaneous transitions
  const previousClipsRef = useRef([]) // Track previous clips to detect actual changes

  // Get clips from main track and calculate timeline info
  useEffect(() => {
    const mainTrack = timeline?.tracks?.find(track => track.id === 1)
    const timelineClips = mainTrack?.clips || []
    
    console.log('TimelinePreview: Timeline effect triggered, clips:', timelineClips.length)
    
    // Calculate total duration as sum of trimmed durations
    const totalDur = timelineClips.reduce((total, clip) => {
      return total + (clip.trimEnd - clip.trimStart)
    }, 0)
    
    setTotalDuration(totalDur)
    
    // Check if clips actually changed (not just timeline reference)
    // Compare against ref, not state, to avoid circular dependency
    // NOTE: We ignore trim changes - those should not reset playback
    const prevClips = previousClipsRef.current
    const clipsChanged = prevClips.length !== timelineClips.length || 
      prevClips.some((clip, i) => {
        const newClip = timelineClips[i]
        // Only compare clip IDs - trim changes should not reset playback
        return !newClip || clip.clipId !== newClip.clipId
      })
    
    console.log('TimelinePreview: Clips changed?', clipsChanged, '(prev:', prevClips.length, 'new:', timelineClips.length, ')')
    
    // Update ref to current clips
    previousClipsRef.current = timelineClips
    setClips(timelineClips)
    
    // ONLY reset to first clip when clips actually changed (not just timeline object reference)
    if (clipsChanged && timelineClips.length > 0) {
      // Check if timeline has a valid playhead position set (e.g., after split, we want to preserve it)
      const hasValidPlayhead = timeline?.playheadPosition !== undefined && 
                                timeline?.playheadPosition !== null &&
                                timeline.playheadPosition >= 0
      
      // Only reset to beginning if:
      // 1. Timeline was empty before (first clip being added)
      // 2. No valid playhead position is set
      const wasEmpty = prevClips.length === 0
      const shouldResetToBeginning = wasEmpty || !hasValidPlayhead
      
      if (shouldResetToBeginning) {
        console.log('TimelinePreview: Clips changed, resetting to clip 0 (first clip or no playhead)')
        setCurrentClipIndex(0)
        actualClipIndexRef.current = 0
        // Start at the beginning (relative to timeline)
        setCurrentTime(0)
        currentTimeRef.current = 0
        lastPlayheadPositionRef.current = null // Reset last position
        
        // Update playhead to match (timeline starts at first clip's startTime + trimStart)
        const firstClip = timelineClips[0]
        const firstClipStartTime = firstClip?.startTime || 0
        const firstClipTrimStart = firstClip?.trimStart || 0
        if (onPlayheadMove) {
          onPlayheadMove(firstClipStartTime + firstClipTrimStart)
        }
      } else {
        // Preserve existing playhead position (e.g., after split)
        console.log('TimelinePreview: Clips changed, preserving playhead position:', timeline.playheadPosition)
        // Don't reset clip index or time - let the playhead sync effect handle positioning
        // Just clear the last position ref so the sync effect can work properly
        lastPlayheadPositionRef.current = null
      }
    } else {
      console.log('TimelinePreview: Timeline updated but clips unchanged - not resetting')
    }
  }, [timeline])

  // Sync with external playhead position changes (e.g., when reset to 0 or after trimming)
  useEffect(() => {
    if (!timeline || timeline.playheadPosition === undefined || timeline.playheadPosition === null) {
      return
    }
    
    const video = videoRef.current
    if (!video || clips.length === 0) return
    
    // Calculate timeline position relative to first clip's active region
    // timeline.playheadPosition is absolute, so subtract startTime + trimStart to get relative timeline time
    const firstClip = clips[0]
    const firstClipStartTime = firstClip?.startTime || 0
    const firstClipTrimStart = firstClip?.trimStart || 0
    const timelineTime = Math.max(0, timeline.playheadPosition - firstClipStartTime - firstClipTrimStart)
    
    // Check if external playhead was changed (e.g., reset after trim, split, or reposition)
    // Only sync if there's a significant difference (> 0.1s) to avoid fighting with playback updates
    const currentDiff = Math.abs(timelineTime - currentTimeRef.current)
    if (currentDiff > 0.1 && !isDraggingSeekRef.current && video.paused) {
      console.log('TimelinePreview: External playhead change detected:', timeline.playheadPosition, '-> timeline time:', timelineTime)
      
      // Find which clip contains this playhead position
      // Check absolute timeline position (timeline.playheadPosition) against clip bounds
      let targetClipIndex = -1
      let timeInTargetClip = 0
      
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        const clipActiveStart = clip.startTime + clip.trimStart
        const clipActiveEnd = clip.startTime + clip.trimEnd
        
        // Check if playhead is within this clip's active region
        if (timeline.playheadPosition >= clipActiveStart && timeline.playheadPosition < clipActiveEnd) {
          targetClipIndex = i
          timeInTargetClip = timeline.playheadPosition - clipActiveStart
          break
        }
      }
      
      // If playhead is not in any active region, find the next active region
      if (targetClipIndex === -1) {
        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i]
          const clipActiveStart = clip.startTime + clip.trimStart
          if (timeline.playheadPosition < clipActiveStart) {
            // Jump to this clip's active start
            targetClipIndex = i
            timeInTargetClip = 0
            break
          }
        }
        // If playhead is beyond all clips, use the last clip
        if (targetClipIndex === -1 && clips.length > 0) {
          targetClipIndex = clips.length - 1
          const lastClip = clips[targetClipIndex]
          timeInTargetClip = lastClip.trimEnd - lastClip.trimStart
        }
      }
      
      if (targetClipIndex === -1 || !clips[targetClipIndex]) return
      
      const targetClip = clips[targetClipIndex]
      console.log('  -> Syncing to clip', targetClipIndex, 'at playhead position', timeline.playheadPosition, 'time in clip:', timeInTargetClip)
      
      // Calculate timeline time (accumulated active durations up to this clip)
      const calculatedTimelineTime = clips.slice(0, targetClipIndex).reduce((total, clip) => {
        const clipDuration = (clip.trimEnd || 0) - (clip.trimStart || 0)
        return total + Math.max(0, clipDuration)
      }, 0) + timeInTargetClip
      
      // Update state
      if (targetClipIndex !== currentClipIndex) {
        setCurrentClipIndex(targetClipIndex)
        actualClipIndexRef.current = targetClipIndex
      }
      setCurrentTime(calculatedTimelineTime)
      currentTimeRef.current = calculatedTimelineTime
      
      // Seek video to correct position
      const baseOffset = targetClip.clip.videoOffsetStart !== undefined 
        ? targetClip.clip.videoOffsetStart 
        : targetClip.trimStart
      const targetVideoTime = baseOffset + timeInTargetClip
      video.currentTime = targetVideoTime
      
      // Update progress bar
      if (progressBarRef.current && seekHandleRef.current && totalDuration > 0) {
        const progress = (calculatedTimelineTime / totalDuration) * 100
        progressBarRef.current.style.width = `${progress}%`
        seekHandleRef.current.style.left = `${progress}%`
      }
      
      // Update time display
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = `${formatTime(calculatedTimelineTime)} / ${formatTime(totalDuration)}`
      }
    }
  }, [timeline?.playheadPosition, clips, totalDuration])

  // Get current clip info with bounds checking
  const safeClipIndex = Math.min(Math.max(0, currentClipIndex), clips.length - 1)
  const currentClip = clips[safeClipIndex] || null

  // Load current clip - only when source changes or timeline changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentClip || safeClipIndex >= clips.length || !currentClip.clip) return

    // Use custom local:// protocol
    // For split clips, always use the originalFilePath to ensure they share the same video source
    const sourceFilePath = currentClip.clip.originalFilePath || currentClip.clip.filePath
    const localSrc = `local://${sourceFilePath.startsWith('/') ? sourceFilePath : '/' + sourceFilePath}`
    
    // Only reload if source actually changed
    const needsReload = currentVideoSrcRef.current !== localSrc
    
    // Skip if same source and we're just changing clip index (for split clips from same source)
    if (!needsReload) {
      // console.log('Skipping reload - same source, clip index changed for split clips')
      return
    }
    
    console.log('=== TimelinePreview: Loading NEW Video Source ===')
    console.log('  Clip index:', currentClipIndex, '/', clips.length)
    console.log('  Clip fileName:', currentClip.clip.fileName)
    console.log('  Loading source:', localSrc)
    console.log('  Should play:', shouldPlayRef.current)
    console.log('==================================')
    
    // Set up event handlers BEFORE loading the video
    let canPlayHandled = false
    
    const handleCanPlay = () => {
      // Prevent duplicate calls
      if (canPlayHandled) {
        console.log('TimelinePreview: canplay already handled, skipping')
        return
      }
      canPlayHandled = true
      
      console.log('TimelinePreview: Video can play event fired')
      
      // Set initial position after load
      if (typeof currentClip.trimStart === 'number') {
        // For split clips, use videoOffsetStart if available (offset into original video)
        const seekPosition = currentClip.clip.videoOffsetStart !== undefined 
          ? currentClip.clip.videoOffsetStart 
          : currentClip.trimStart
        console.log('  Seeking to:', seekPosition)
        video.currentTime = seekPosition
      }
      
      // If we should be playing, start playing after the video is ready
      if (shouldPlayRef.current) {
        console.log('TimelinePreview: Starting auto-play for next clip')
        video.play().then(() => {
          console.log('TimelinePreview: Video playback started successfully')
          setIsPlaying(true)
          shouldPlayRef.current = false
          // Reset transition flag now that playback has started
          isTransitioningRef.current = false
        }).catch(err => {
          console.warn('TimelinePreview: Failed to start playback:', err)
          shouldPlayRef.current = false
          // Reset transition flag even if playback failed
          isTransitioningRef.current = false
        })
      } else {
        // Reset transition flag if not auto-playing
        setTimeout(() => {
          isTransitioningRef.current = false
        }, 100)
      }
      
      // Clean up event listeners
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
    
    const handleLoadedMetadata = () => {
      console.log('TimelinePreview: Video metadata loaded, readyState:', video.readyState)
      // If video is already ready, trigger canplay logic
      if (video.readyState >= 3 && !canPlayHandled) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
        console.log('TimelinePreview: Video ready, triggering canplay handler')
        handleCanPlay()
      }
    }
    
    // Add event listeners BEFORE setting src
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    
    // Now load the video
    video.src = localSrc
    video.load()
    currentVideoSrcRef.current = localSrc
    
    // Check if video is already ready (might load very quickly)
    // Use setTimeout to ensure the src has been set
    setTimeout(() => {
      if (video.readyState >= 3 && !canPlayHandled) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
        console.log('TimelinePreview: Video already ready, triggering canplay handler')
        handleCanPlay()
      }
    }, 50)
    
    // Cleanup function
    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [currentClip])

  // Handle video events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

  const handleTimeUpdate = () => {
    if (!currentClip || !currentClip.clip) {
      return
    }
    
    // Skip ALL processing during scrubbing - the seekToTime function handles everything
    if (isDraggingSeekRef.current) {
      return
    }
    
    // Only process time updates when video is actually playing
    // Check the actual video state, not the React state which might be out of sync
    if (video.paused) {
      return
    }
    
    const videoTime = video.currentTime
    
    // Find which clip we're actually in based on video time
    // This is important for split clips where we might scrub between them
    let actualClipIndex = actualClipIndexRef.current
    let actualClip = clips[actualClipIndex] || currentClip
    
    // Check all clips to find the right one
    // Only check for split clips (same source file) - different files use 'ended' event
    const isSplitClip = actualClip.clip.isSplitClip
    const currentFilePath = actualClip.clip.originalFilePath || actualClip.clip.filePath
    const isSameSource = clips.some(clip => {
      if (clip === actualClip || !clip.clip) return false
      const clipFilePath = clip.clip.originalFilePath || clip.clip.filePath
      // Both paths must exist and match exactly
      return currentFilePath && clipFilePath && currentFilePath === clipFilePath
    })
    
    if (isSplitClip || isSameSource) {
      // For split clips, check boundaries
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        // Only check clips from the same source
        const clipIsSameSource = clip.clip && 
          (clip.clip.originalFilePath === actualClip.clip.originalFilePath || 
           clip.clip.filePath === actualClip.clip.filePath)
        
        if (!clipIsSameSource) continue
        
        const clipStart = clip.clip.videoOffsetStart !== undefined ? clip.clip.videoOffsetStart : clip.trimStart
        const clipEnd = clip.clip.videoOffsetEnd !== undefined ? clip.clip.videoOffsetEnd : clip.trimEnd
        
        // Check if current video time is within this clip's range
        if (videoTime >= clipStart && videoTime < clipEnd) {
          actualClipIndex = i
          actualClip = clip
          actualClipIndexRef.current = i
          
          // Update state if different (only during playback, not scrubbing)
          if (actualClipIndex !== currentClipIndex) {
            console.log('Time update detected clip boundary crossing to clip', actualClipIndex)
            setCurrentClipIndex(actualClipIndex)
          }
          break
        }
      }
    }
    
    // For split clips, check against videoOffsetEnd instead of trimEnd
    const clipEndTime = actualClip.clip.videoOffsetEnd !== undefined 
      ? actualClip.clip.videoOffsetEnd 
      : actualClip.trimEnd
    
    const clipStartTime = actualClip.clip.videoOffsetStart !== undefined
      ? actualClip.clip.videoOffsetStart
      : actualClip.trimStart
    
    const timeInClip = videoTime - clipStartTime
    
    // Check if we've reached the trim end point
    // For different video files, transition when reaching trimEnd (not natural video end)
    if (typeof clipEndTime === 'number' && videoTime >= clipEndTime && !isTransitioningRef.current) {
        // Prevent multiple simultaneous transitions
        isTransitioningRef.current = true
        
        console.log('=== Transitioning to Next Clip ===')
        console.log('  Current clip ended at:', videoTime)
        console.log('  Current clip trimEnd/offsetEnd:', clipEndTime)
        
        // Move to next clip
        if (currentClipIndex < clips.length - 1) {
          const nextClipIndex = currentClipIndex + 1
          const nextClip = clips[nextClipIndex]
          
          if (nextClip && nextClip.clip) {
            console.log('  Next clip:', nextClip.clip.fileName)
            console.log('  Next clip ID:', nextClip.clipId)
            console.log('  Next clip trimStart:', nextClip.trimStart, 'trimEnd:', nextClip.trimEnd)
            console.log('  Next clip isSplitClip:', nextClip.clip.isSplitClip)
            console.log('  Next clip videoOffsetStart:', nextClip.clip.videoOffsetStart, 'videoOffsetEnd:', nextClip.clip.videoOffsetEnd)
            // Check if clips are from the same source file (for split clips)
            // Compare file paths strictly - both must exist and match exactly
            const currentFilePath = currentClip.clip.originalFilePath || currentClip.clip.filePath
            const nextFilePath = nextClip.clip.originalFilePath || nextClip.clip.filePath
            const isSameSource = currentFilePath && nextFilePath && currentFilePath === nextFilePath
            
            console.log('  Same source file?', isSameSource)
            console.log('  Current file:', currentFilePath)
            console.log('  Next file:', nextFilePath)
            
            if (isSameSource && currentVideoSrcRef.current) {
              console.log('  Using seamless transition (seeking)')
              console.log('  Video is currently playing?', isPlaying, 'Video paused?', video.paused)
              
              // Capture playback state before seeking
              const wasPlaying = isPlaying || !video.paused
              
              // Seek to next clip's start position immediately
              // For split clips, use videoOffsetStart
              const nextSeekPosition = nextClip.clip.videoOffsetStart !== undefined
                ? nextClip.clip.videoOffsetStart
                : nextClip.trimStart
              console.log('  Seeking video to:', nextSeekPosition)
              video.currentTime = nextSeekPosition
              
              // Update clip index and state immediately
              setCurrentClipIndex(nextClipIndex)
              
              // Calculate the timeline time for the start of the next clip's trimmed portion
              // This accumulates active durations of all previous clips
              const nextClipTimelineTime = clips.slice(0, nextClipIndex).reduce((total, clip) => {
                const clipDuration = (clip.trimEnd || 0) - (clip.trimStart || 0)
                return total + Math.max(0, clipDuration)
              }, 0)
              setCurrentTime(nextClipTimelineTime)
              currentTimeRef.current = nextClipTimelineTime
              
              // Update playhead position - jump directly to next clip's active start
              // This skips any gaps (trimmed sections) between clips
              const nextClipActiveStart = nextClip.startTime + nextClip.trimStart
              if (onPlayheadMove) {
                onPlayheadMove(nextClipActiveStart)
              }
              
              // Update UI immediately for smooth transition
              if (progressBarRef.current && seekHandleRef.current && totalDuration > 0) {
                const progress = (nextClipTimelineTime / totalDuration) * 100
                progressBarRef.current.style.width = `${progress}%`
                seekHandleRef.current.style.left = `${progress}%`
              }
              
              // Update time display
              if (timeDisplayRef.current) {
                timeDisplayRef.current.textContent = `${formatTime(nextClipTimelineTime)} / ${formatTime(totalDuration)}`
              }
              
              // Ensure video continues playing if it was playing (seeking might pause it)
              // Use a small timeout to ensure the seek completes first
              if (wasPlaying) {
                console.log('  Video was playing, ensuring playback continues after seek')
                setTimeout(() => {
                  if (video.paused) {
                    console.log('  Video paused after seek, resuming playback')
                    video.play().catch(err => console.warn('Play failed after transition:', err))
                  }
                  // Reset transition flag after seek completes
                  setTimeout(() => {
                    isTransitioningRef.current = false
                  }, 50)
                }, 10)
              } else {
                console.log('  Video was not playing, staying paused')
                // Reset transition flag if not playing
                setTimeout(() => {
                  isTransitioningRef.current = false
                }, 50)
              }
            } else {
              // Different source file - need to load new video
              console.log('  Using file transition (different source)')
              // Preserve playback state
              const wasPlaying = isPlaying || !video.paused
              shouldPlayRef.current = wasPlaying
              console.log('  Setting shouldPlayRef to:', wasPlaying)
              
              // Reset video source to force reload
              currentVideoSrcRef.current = null
              
              // Update clip index - this will trigger the useEffect to load the new video
              setCurrentClipIndex(nextClipIndex)
              
              // Calculate the timeline time for the start of the next clip's trimmed portion
              // This accumulates active durations of all previous clips
              const nextClipTimelineTime = clips.slice(0, nextClipIndex).reduce((total, clip) => {
                const clipDuration = (clip.trimEnd || 0) - (clip.trimStart || 0)
                return total + Math.max(0, clipDuration)
              }, 0)
              setCurrentTime(nextClipTimelineTime)
              currentTimeRef.current = nextClipTimelineTime
              
              // Update playhead position - jump directly to next clip's active start
              // This skips any gaps (trimmed sections) between clips
              const nextClipActiveStart = nextClip.startTime + nextClip.trimStart
              if (onPlayheadMove) {
                onPlayheadMove(nextClipActiveStart)
              }
              
              // Reset transition flag after video loads (handled in video loading effect)
              // The flag will be reset when the new video starts playing
            }
          }
        } else {
          // End of timeline - stop at the end
          console.log('TimelinePreview: End of timeline reached in timeupdate - stopping at end')
          isTransitioningRef.current = false
          video.pause()
          setIsPlaying(false)
          shouldPlayRef.current = false
          
          // Position playhead at the end of the last clip's active region
          if (clips.length > 0) {
            const lastClip = clips[clips.length - 1]
            const lastClipActiveEnd = lastClip.startTime + lastClip.trimEnd
            
            // Set timeline time to total duration (end of playback)
            setCurrentTime(totalDuration)
            currentTimeRef.current = totalDuration
            
            // Position playhead at end of last clip's active region
            if (onPlayheadMove) {
              onPlayheadMove(lastClipActiveEnd)
            }
            
            // Update progress bar to show 100%
            if (progressBarRef.current && seekHandleRef.current) {
              progressBarRef.current.style.width = '100%'
              seekHandleRef.current.style.left = '100%'
            }
            
            // Update time display
            if (timeDisplayRef.current) {
              timeDisplayRef.current.textContent = `${formatTime(totalDuration)} / ${formatTime(totalDuration)}`
            }
            
            console.log('  -> Playhead at end of timeline:', lastClipActiveEnd)
          } else {
            // No clips - reset to 0
            setCurrentTime(0)
            currentTimeRef.current = 0
            if (onPlayheadMove) {
              onPlayheadMove(0)
            }
          }
        }
      } else {
        // Update current time within the timeline
        const accumulatedTime = clips.slice(0, actualClipIndex).reduce((total, clip) => {
          const clipDuration = (clip.trimEnd || 0) - (clip.trimStart || 0)
          return total + Math.max(0, clipDuration)
        }, 0)
        const timelineTime = accumulatedTime + timeInClip
        currentTimeRef.current = timelineTime
        
        // Calculate playhead position on the timeline
        // Use the current clip's actual position and add time within the active region
        const currentClipObj = clips[actualClipIndex]
        const currentClipActiveStart = currentClipObj.startTime + currentClipObj.trimStart
        const playheadPosition = currentClipActiveStart + timeInClip
        
        // Debug logging
        if (Math.random() < 0.01) { // Log occasionally to avoid flooding console
          console.log('Playhead update:')
          console.log('  actualClipIndex:', actualClipIndex)
          console.log('  currentClipObj.startTime:', currentClipObj.startTime)
          console.log('  currentClipObj.trimStart:', currentClipObj.trimStart)
          console.log('  timeInClip:', timeInClip)
          console.log('  currentClipActiveStart:', currentClipActiveStart)
          console.log('  playheadPosition:', playheadPosition)
        }
        
        // Update progress bar DOM directly (no re-render)
        if (progressBarRef.current && seekHandleRef.current && totalDuration > 0) {
          const progress = (timelineTime / totalDuration) * 100
          progressBarRef.current.style.width = `${progress}%`
          seekHandleRef.current.style.left = `${progress}%`
        }
        
        // Update time display
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = `${formatTime(timelineTime)} / ${formatTime(totalDuration)}`
        }
        
        // Update playhead position directly (only if changed significantly to avoid excessive updates)
        if (onPlayheadMove) {
          const lastPosition = lastPlayheadPositionRef.current
          // Only update if position changed by at least 0.02 seconds (~20ms) for smooth updates
          // This matches roughly 50fps which is smooth enough for UI
          if (lastPosition === null || Math.abs(playheadPosition - lastPosition) > 0.02) {
            onPlayheadMove(playheadPosition)
            lastPlayheadPositionRef.current = playheadPosition
          }
        }
      }
    }

    const handleLoadedMetadata = () => {
      if (currentClip && currentClip.clip && typeof currentClip.trimStart === 'number') {
        // Always start at the beginning of the trimmed portion
        // For split clips, use videoOffsetStart
        const seekPosition = currentClip.clip.videoOffsetStart !== undefined 
          ? currentClip.clip.videoOffsetStart 
          : currentClip.trimStart
        video.currentTime = seekPosition
        
        // Update timeline time correctly - start at the beginning of this clip's trimmed portion
        const accumulatedTime = clips.slice(0, currentClipIndex).reduce((total, clip) => {
          const clipDuration = (clip.trimEnd || 0) - (clip.trimStart || 0)
          return total + Math.max(0, clipDuration)
        }, 0)
        setCurrentTime(accumulatedTime)
        
        // DON'T call onPlayheadMove here - causes infinite loop
      }
    }

    const handleEnded = () => {
      console.log('TimelinePreview: Video ended event fired')
      console.log('  Current clip index:', currentClipIndex)
      console.log('  Total clips:', clips.length)
      console.log('  Is playing:', isPlaying)
      
      // Move to next clip or end
      if (currentClipIndex < clips.length - 1) {
        const nextIndex = currentClipIndex + 1
        const nextClip = clips[nextIndex]
        const currentClip = clips[currentClipIndex]
        
        console.log('TimelinePreview: Clip ended, moving to next clip')
        console.log('  Current clip:', currentClip?.clip?.fileName)
        console.log('  Next clip:', nextClip?.clip?.fileName)
        
        // Check if next clip is from a different source file
        const isSameSource = nextClip?.clip && currentClip?.clip &&
          (nextClip.clip.originalFilePath === currentClip.clip.originalFilePath || 
           nextClip.clip.filePath === currentClip.clip.filePath)
        
        if (!isSameSource) {
          // Different source file - need to reload video
          console.log('  Different source file - resetting video source')
          currentVideoSrcRef.current = null
        }
        
        // Set flag to continue playing after transition
        // Use isPlaying state OR check if video was playing (video might have paused)
        const wasPlaying = isPlaying || !video.paused
        shouldPlayRef.current = wasPlaying
        console.log('  Setting shouldPlayRef to:', wasPlaying)
        
        // Calculate the timeline time for the start of the next clip's trimmed portion
        // This accumulates active durations of all previous clips
        const nextClipTimelineTime = clips.slice(0, nextIndex).reduce((total, clip) => {
          const clipDuration = (clip.trimEnd || 0) - (clip.trimStart || 0)
          return total + Math.max(0, clipDuration)
        }, 0)
        
        // Update clip index - this will trigger the useEffect to load the new video
        console.log('  Updating clip index to:', nextIndex)
        setCurrentClipIndex(nextIndex)
        setCurrentTime(nextClipTimelineTime)
        currentTimeRef.current = nextClipTimelineTime
        
        // Update playhead position - jump directly to next clip's active start
        // This skips any gaps (trimmed sections) between clips
        const nextClipActiveStart = nextClip.startTime + nextClip.trimStart
        if (onPlayheadMove) {
          onPlayheadMove(nextClipActiveStart)
        }
      } else {
        console.log('TimelinePreview: End of timeline reached - stopping at end')
        setIsPlaying(false)
        shouldPlayRef.current = false
        
        // Position playhead at the end of the last clip's active region
        if (clips.length > 0) {
          const lastClip = clips[clips.length - 1]
          const lastClipActiveEnd = lastClip.startTime + lastClip.trimEnd
          
          // Set timeline time to total duration (end of playback)
          setCurrentTime(totalDuration)
          currentTimeRef.current = totalDuration
          
          // Position playhead at end of last clip's active region
          if (onPlayheadMove) {
            onPlayheadMove(lastClipActiveEnd)
          }
          
          // Update progress bar to show 100%
          if (progressBarRef.current && seekHandleRef.current) {
            progressBarRef.current.style.width = '100%'
            seekHandleRef.current.style.left = '100%'
          }
          
          // Update time display
          if (timeDisplayRef.current) {
            timeDisplayRef.current.textContent = `${formatTime(totalDuration)} / ${formatTime(totalDuration)}`
          }
          
          console.log('  -> Playhead at end of timeline:', lastClipActiveEnd)
        } else {
          // No clips - reset to 0
          setCurrentTime(0)
          currentTimeRef.current = 0
          if (onPlayheadMove) {
            onPlayheadMove(0)
          }
        }
      }
    }

    const handleError = (e) => {
      console.warn('TimelinePreview: Video error:', e)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
    }
  }, [currentClip, currentClipIndex, clips, totalDuration])

  // Keyboard shortcut for spacebar play/pause
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only trigger if not typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }
      
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault() // Prevent page scroll
        togglePlayPause()
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying, currentTime, totalDuration, currentClip, clips, onPlayheadMove])

  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video || !currentClip || clips.length === 0) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      shouldPlayRef.current = false
    } else {
      // If at the end, restart from beginning of first clip's active region
      if (currentTime >= totalDuration) {
        const firstClip = clips[0]
        const firstClipStartTime = firstClip.startTime || 0
        const firstActiveStart = firstClipStartTime + firstClip.trimStart
        
        // Reset to beginning of first clip's active region
        if (currentClipIndex !== 0) {
          setCurrentClipIndex(0)
          actualClipIndexRef.current = 0
        }
        setCurrentTime(0)
        currentTimeRef.current = 0
        
        // Reset playhead to beginning of active region
        if (onPlayheadMove) {
          onPlayheadMove(firstActiveStart)
        }
        
        // Seek video to beginning of first clip's active region
        // Wait for video to be ready before seeking
        const seekPosition = firstClip.clip.videoOffsetStart !== undefined 
          ? firstClip.clip.videoOffsetStart 
          : firstClip.trimStart
        
        const seekVideo = () => {
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            video.currentTime = seekPosition
            console.log('  -> Video seeked to:', seekPosition)
          } else {
            // Wait for video to be ready
            const onLoadedData = () => {
              video.currentTime = seekPosition
              console.log('  -> Video seeked to (after load):', seekPosition)
              video.removeEventListener('loadeddata', onLoadedData)
            }
            video.addEventListener('loadeddata', onLoadedData)
          }
        }
        seekVideo()
        
        // Update progress bar
        if (progressBarRef.current && seekHandleRef.current) {
          progressBarRef.current.style.width = '0%'
          seekHandleRef.current.style.left = '0%'
        }
        
        // Update time display
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = `${formatTime(0)} / ${formatTime(totalDuration)}`
        }
        
        console.log('TogglePlayPause: Reset to beginning of active region at:', firstActiveStart)
      }
      video.play()
      setIsPlaying(true)
      shouldPlayRef.current = false
    }
  }

  const handleSeek = (e) => {
    // Don't seek on click if we were dragging
    if (isDraggingSeekRef.current) return
    
    const video = videoRef.current
    if (!video || clips.length === 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const newTimelineTime = (clickX / rect.width) * totalDuration
    seekToTime(newTimelineTime)
  }

  const handleSeekMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingSeekRef.current = true
    
    // Find the seek bar element (might be currentTarget or parent)
    const seekBar = e.currentTarget.classList.contains('video-seek-bar') 
      ? e.currentTarget 
      : (e.currentTarget.closest('.video-seek-bar') || e.currentTarget.parentElement)
    if (!seekBar) return
    
    const rect = seekBar.getBoundingClientRect()
    let rafId = null
    let lastSeekTime = 0
    const SEEK_THROTTLE_MS = 50 // Only actually seek video every 50ms
    
    const handleMouseMove = (moveEvent) => {
      if (!isDraggingSeekRef.current) return
      
      const video = videoRef.current
      if (!video || clips.length === 0) return
      
      const clickX = moveEvent.clientX - rect.left
      const newTimelineTime = Math.max(0, Math.min((clickX / rect.width) * totalDuration, totalDuration))
      
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      
      // Use requestAnimationFrame for smooth UI updates
      rafId = requestAnimationFrame(() => {
        // ALWAYS update UI immediately for smooth visual feedback
        if (progressBarRef.current && seekHandleRef.current && totalDuration > 0) {
          const progress = (newTimelineTime / totalDuration) * 100
          progressBarRef.current.style.width = `${progress}%`
          seekHandleRef.current.style.left = `${progress}%`
        }
        
        // Update time display
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = `${formatTime(newTimelineTime)} / ${formatTime(totalDuration)}`
        }
        
        // Only actually seek video at throttled rate to prevent flicker
        const now = Date.now()
        if (now - lastSeekTime > SEEK_THROTTLE_MS) {
          lastSeekTime = now
          seekToTime(newTimelineTime)
        }
      })
    }
    
    const handleMouseUp = () => {
      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      
      // Clear scrubbing flag first
      isDraggingSeekRef.current = false
      
      // Sync state to match refs after scrubbing completes (single update)
      const finalTime = currentTimeRef.current
      const finalClipIndex = actualClipIndexRef.current
      
      console.log('Scrub ended - syncing state:', { time: finalTime, clipIndex: finalClipIndex })
      
      setCurrentTime(finalTime)
      if (finalClipIndex !== currentClipIndex) {
        setCurrentClipIndex(finalClipIndex)
      }
      
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    // Also seek immediately on mousedown
    const clickX = e.clientX - rect.left
    const newTimelineTime = Math.max(0, Math.min((clickX / rect.width) * totalDuration, totalDuration))
    seekToTime(newTimelineTime)
  }

  const seekToTime = (newTimelineTime) => {
    const video = videoRef.current
    if (!video || clips.length === 0) return
    
    // Find which clip this time corresponds to
    let accumulatedTime = 0
    let targetClipIndex = 0
    let timeInTargetClip = 0
    
    for (let i = 0; i < clips.length; i++) {
      const clipDuration = clips[i].trimEnd - clips[i].trimStart
      if (newTimelineTime <= accumulatedTime + clipDuration) {
        targetClipIndex = i
        timeInTargetClip = newTimelineTime - accumulatedTime
        break
      }
      accumulatedTime += clipDuration
    }
    
    const targetClip = clips[targetClipIndex]
    if (!targetClip) return
    
    // Check if we're switching clips
    const isSwitchingClips = targetClipIndex !== currentClipIndex
    
    // If switching clips, need to update the clip index immediately for scrubbing to work
    if (isSwitchingClips) {
      setCurrentClipIndex(targetClipIndex)
      actualClipIndexRef.current = targetClipIndex
    }
    
    // Set video position immediately
    const baseOffset = targetClip.clip.videoOffsetStart !== undefined 
      ? targetClip.clip.videoOffsetStart 
      : targetClip.trimStart
    const targetVideoTime = baseOffset + timeInTargetClip
    
    // Only log when not scrubbing to avoid spam
    if (!isDraggingSeekRef.current) {
      console.log('=== SeekToTime ===')
      console.log('  Target timeline time:', newTimelineTime)
      console.log('  Target clip index:', targetClipIndex)
      console.log('  Seeking to video time:', targetVideoTime)
      console.log('  Is switching clips:', isSwitchingClips)
    }
    
    // Try to seek - this will only work if the video source is already loaded
    try {
      video.currentTime = targetVideoTime
    } catch (err) {
      console.warn('Seek failed:', err)
    }
    
    // Update ref (no re-render)
    currentTimeRef.current = newTimelineTime
    actualClipIndexRef.current = targetClipIndex
    
    // Update state for consistency
    if (!isDraggingSeekRef.current) {
      setCurrentTime(newTimelineTime)
    }
    
    // Update progress bar and handle directly via DOM (no React re-render)
    if (progressBarRef.current && seekHandleRef.current && totalDuration > 0) {
      const progress = (newTimelineTime / totalDuration) * 100
      progressBarRef.current.style.width = `${progress}%`
      seekHandleRef.current.style.left = `${progress}%`
    }
    
    // Update time display directly via DOM (no React re-render)
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${formatTime(newTimelineTime)} / ${formatTime(totalDuration)}`
    }
    
    // Update playhead position (this might cause parent re-render, but necessary for timeline sync)
    const firstClip = clips[0]
    const firstClipStartTime = firstClip?.startTime || 0
    const firstClipTrimStart = firstClip?.trimStart || 0
    const playheadPosition = firstClipStartTime + firstClipTrimStart + newTimelineTime
    if (onPlayheadMove) {
      onPlayheadMove(playheadPosition)
    }
  }

  const formatTime = (time) => {
    // Handle negative values and ensure we don't show invalid times
    const safeTime = Math.max(0, time || 0)
    const mins = Math.floor(safeTime / 60)
    const secs = Math.floor(safeTime % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'none'
  }

  const handleDrop = (e) => {
    e.preventDefault()
    console.log('TimelinePreview: Direct drop to player prevented - use timeline instead')
  }

  if (clips.length === 0) {
    return (
      <div 
        className="video-player"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="video-player-empty">
          <div className="empty-icon">📺</div>
          <h3>No Timeline Content</h3>
          <p className="text-muted">Add clips to the timeline to preview</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="video-player"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="video-container">
        <video
          ref={videoRef}
          className="video-element"
          preload="metadata"
          crossOrigin="anonymous"
          playsInline
        />
        
        {/* Timeline Info Badge */}
        <div className="video-trim-info">
          <div className="trim-badge">
            🎬 Timeline: {formatTime(totalDuration)} 
            <span className="trim-range-detail"> ({clips.length} clip{clips.length !== 1 ? 's' : ''})</span>
          </div>
        </div>
        
        {/* Custom Video Controls */}
        <div className="custom-video-controls">
          <div className="video-controls-row">
            <button 
              className="video-control-btn"
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            
            <div className="video-time-display" ref={timeDisplayRef}>
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </div>
            
            <div className="video-clip-info">
              Clip {safeClipIndex + 1}/{clips.length}: {currentClip?.clip.fileName || ''}
            </div>
          </div>
          
          <div className="video-seek-container">
            <div 
              className="video-seek-bar"
              onClick={handleSeek}
              onMouseDown={handleSeekMouseDown}
            >
              <div 
                className="video-seek-progress"
                ref={progressBarRef}
                style={{
                  width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%`
                }}
              />
              <div 
                className="video-seek-handle"
                ref={seekHandleRef}
                style={{
                  left: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%`
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  handleSeekMouseDown(e)
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TimelinePreview
