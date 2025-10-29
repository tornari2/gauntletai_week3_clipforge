<!-- 48e4d6fc-ed67-4ddd-8084-fe9fb8145f4c a15be3a5-d26c-4bb8-b0b9-87a1eee11e99 -->
# Rebuild Timeline Editor

## Overview

Rebuild the timeline component to match proper video editor behavior with clean visual trimming, auto-expanding timeline, scroll-wheel zoom, playhead auto-movement, and clip splitting.

## Current State Analysis

- Timeline has broken time ruler with duplicate drop issues
- Trim handles exist but visual feedback is incorrect
- Timeline duration uses fixed 2x video length calculation
- No zoom functionality
- Playhead exists but doesn't move during playback
- No split functionality

## Implementation Plan

### 1. Remove Time Ruler (Answer: 1b)

**File: `src/renderer/components/HorizontalTimeline.jsx`**

- Remove the entire ruler rendering section (lines ~203-243)
- Remove ruler-related CSS from timeline
- Keep timeline header with duration display

### 2. Fix Clip Trimming Visual Behavior (Answer: 2b)

**File: `src/renderer/components/HorizontalTimeline.jsx`**

- Clips keep same visual size on timeline
- Add trim marker indicators (colored overlay/shading) to show trimmed regions
- Left trim: show darkened/striped overlay on left portion
- Right trim: show darkened/striped overlay on right portion
- Trim handles visible only when clip is selected

**CSS Changes: `src/styles/app.css`**

- Add `.timeline-clip-trim-overlay` styles for visual trim indicators
- Style trim markers with semi-transparent overlays

### 3. Auto-Expanding Timeline Duration (Answer: 3b)

**File: `src/renderer/App.jsx`**

- Remove fixed 2x calculation (lines 193-203)
- Calculate timeline duration as: `max(all clip end times) + padding`
- Add 30 seconds padding after last clip
- Recalculate timeline duration when clips are added/removed/moved
- Keep static during trim operations only

### 4. Scroll-Wheel Zoom (Answer: 4b)

**File: `src/renderer/components/HorizontalTimeline.jsx`**

- Add `onWheel` event handler to timeline container
- Implement zoom scale state (1.0 = 100%, range: 0.25x to 4x)
- Apply zoom via CSS transform or width scaling
- Zoom centers on mouse cursor position
- Update clip positioning calculations based on zoom level

### 5. Playhead (Current Time Indicator) with Auto-Movement (Answer: 5a)

**Files: `src/renderer/App.jsx`, `src/renderer/components/VideoPlayer.jsx`, `src/renderer/components/HorizontalTimeline.jsx`**

- Add playhead position state in App.jsx
- Pass video playback state from VideoPlayer to App
- Update playhead position based on video currentTime during playback
- Render playhead as prominent vertical red line in HorizontalTimeline
- Add playhead head (triangle/diamond) at top
- Display current time label near playhead
- Make playhead draggable for manual seeking
- Clicking on timeline moves playhead to that position

### 6. Split Clips at Playhead (Answer: 6a)

**Files: `src/renderer/App.jsx`, `src/renderer/components/HorizontalTimeline.jsx`**

- Add split button/action in timeline (keyboard shortcut: 'S' key)
- Find clip at playhead position
- Create two new clips from the split:
  - Clip 1: original start → playhead position
  - Clip 2: playhead position → original end
- Update timeline state with two separate clips
- Maintain trim values relative to new clip boundaries

### 7. Snap-to-Grid and Snap-to-Clip Edges

**File: `src/renderer/components/HorizontalTimeline.jsx`**

**Snap-to-Grid:**

- Implement grid intervals based on zoom level (e.g., 1 second at high zoom, 5 seconds at medium zoom)
- When dragging clips or playhead, snap to nearest grid line
- Visual grid lines in background (subtle)
- Toggle on/off with magnet icon or keyboard shortcut

**Snap-to-Clip Edges:**

- When dragging a clip, detect nearby clip edges (within ~10px threshold)
- Snap dragged clip to:
  - Start of another clip
  - End of another clip
  - Playhead position
- Visual feedback: highlight snap points when near
- Show temporary vertical guide line at snap point
- Works for both clip movement and trim handles

## Key Code Changes

### HorizontalTimeline.jsx

```javascript
// Remove ruler section entirely
// Add trim overlay rendering
const renderTrimOverlays = (clip, trimStart, trimEnd) => {
  const leftTrimPercent = (trimStart / clip.duration) * 100
  const rightTrimPercent = ((clip.duration - trimEnd) / clip.duration) * 100
  return (
    <>
      {trimStart > 0 && <div className="trim-overlay-left" style={{width: `${leftTrimPercent}%`}} />}
      {trimEnd < clip.duration && <div className="trim-overlay-right" style={{width: `${rightTrimPercent}%`}} />}
    </>
  )
}

// Add zoom state and handler
const [zoomLevel, setZoomLevel] = useState(1.0)
const handleWheel = (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoomLevel(prev => Math.max(0.25, Math.min(4, prev * delta)))
  }
}

// Render playhead
<div className="playhead" style={{left: `${(timeline.playheadPosition / timeline.duration) * 100}%`}} />
```

### App.jsx

```javascript
// Auto-expanding timeline duration
const calculateTimelineDuration = (tracks) => {
  let maxEndTime = 0
  tracks.forEach(track => {
    track.clips.forEach(clip => {
      const endTime = clip.startTime + clip.duration
      maxEndTime = Math.max(maxEndTime, endTime)
    })
  })
  return maxEndTime + 30 // 30 seconds padding
}

// Split clip function
const handleSplitClip = (clipId, splitTime) => {
  // Find clip, create two new clips, update timeline state
}

// Playhead update from video player
const handleVideoTimeUpdate = (currentTime) => {
  setTimeline(prev => ({...prev, playheadPosition: currentTime}))
}
```

## Testing Checklist

- [ ] Time ruler removed, timeline clean
- [ ] Trim handles show visual overlays, clip size unchanged
- [ ] Timeline expands automatically when clips added
- [ ] Scroll-wheel zoom works smoothly
- [ ] Playhead moves during video playback
- [ ] Split creates two separate clips at playhead
- [ ] All trim operations keep timeline static

### To-dos

- [ ] Remove broken timeline duration and ruler logic
- [ ] Implement dynamic timeline duration calculation with padding
- [ ] Implement adaptive ruler with major/minor marks
- [ ] Fix clip positioning and width based on trimmed duration
- [ ] Fix trimming to move/resize clips correctly