# Playhead Logic Revamp - Summary

## Overview
The playhead logic has been completely revamped to meet the following specifications:

1. **Playhead starts at the beginning of the active region** when clips are added to the timeline
2. **Playhead does NOT move during trimming** UNLESS you trim past its position
3. **Playhead ONLY moves** when:
   - Trimming from the front passes it (new active start > playhead position)
   - Trimming from the back passes it (new active end < playhead position)
4. **Playhead always points to playable content** (never in grey/trimmed areas)

## Key Concept: Active Region vs Visual Bounds

- **Visual Bounds**: The entire clip bar on the timeline (includes grey areas)
- **Active Region**: The blue/visible portion of the clip (excludes grey trimmed areas)
- **Playhead Position**: Always in absolute timeline coordinates (not relative to clip)

Example:
```
Clip: [==========================================]
      |    grey    |  ACTIVE REGION   |  grey  |
      0s          10s                40s       60s
      
startTime = 0
trimStart = 10s (grey area before active)
trimEnd = 40s (grey area after active)
Active region = 10s to 40s (on timeline)
```

When clip is added, playhead = startTime + trimStart = 0 + 10 = 10s (beginning of active region)

## Changes Made

### 1. App.jsx - Playhead Initialization

#### `addClipToTimeline` (Lines 157-202)
- **Changed**: Now sets playhead to beginning of first clip's **active region** (not just 0)
- **Logic**: `playheadPosition = firstClip.startTime + firstClip.trimStart`
- **Why**: Ensures playhead starts at playable content, not in a grey trimmed area
- **Example**: If clip has trimStart=5s, playhead starts at 5s (not 0s)

#### `handleTimelineClipDelete` (Lines 242-319)
- **Changed**: Resets playhead to first clip's active region start after deletion
- **Logic**: 
  - If no clips remain: `playheadPosition = 0`
  - If clips remain: Check if playhead is before first active region or beyond duration
  - If before: Reset to `firstClip.startTime + firstClip.trimStart`
  - If beyond: Clamp to duration or first active start (whichever is higher)

#### `handleTimelineClipTrim` (Lines 304-383)
- **Completely rewritten** for clearer logic
- **Key Changes**:
  - Captures old trim values before applying new ones
  - Calculates clip's visual bounds and new active region
  - **Critical**: Playhead follows the trim handle whenever it passes the playhead position
  - **Front trim**: Moves playhead to new active start if `newActiveStart > playheadPosition` (playhead follows trim handle)
  - **Back trim**: Moves playhead to new active end if `newActiveEnd < playheadPosition` (playhead follows trim handle)
  - Only checks clips where playhead is within the visual bounds (including grey areas)
  - **Otherwise**: Explicitly keeps playhead at same position (no change)

#### `handleClipSplitAtPlayhead` (Lines 458-606)
- **Changed**: Resets playhead to beginning of first split clip's active region (not 0)
- **Logic**: `playheadPosition = firstSplitClip.startTime + firstSplitClip.trimStart`
- **Reason**: Clips are reorganized, reset to beginning of playable content

#### `handleClipReposition` (Lines 609-655)
- **Changed**: Resets playhead to beginning of first clip's active region (not 0)
- **Logic**: `playheadPosition = firstClip.startTime + firstClip.trimStart`
- **Reason**: Clips are reorganized via drag-and-drop, reset to beginning of playable content

### 2. TimelinePreview.jsx - Playhead Synchronization

#### External Playhead Sync Effect (Lines 74-140)
- **Completely rewritten** for better synchronization
- **Functionality**:
  - Monitors `timeline.playheadPosition` for external changes
  - Detects changes > 0.1s (avoids fighting with playback updates)
  - Only syncs when video is paused (not during active playback or scrubbing)
  - Finds correct clip and time within clip based on playhead position
  - Seeks video to correct position
  - Updates progress bar, time display, and clip index
- **Why**: Ensures video player stays in sync when playhead is changed externally (trim, split, reposition)

### 3. HorizontalTimeline.jsx
- **No changes needed**: Already correctly displays playhead at `timeline.playheadPosition`

## Behavior Summary

### Scenario 1: Adding Clips
- First clip added → Playhead set to beginning of active region (startTime + trimStart)
- **Example**: Clip with trimStart=5s → Playhead at 5s (not 0s)
- Additional clips added → Playhead stays at current position (if valid)

### Scenario 2: Removing Clips
- Clip deleted, timeline empty → Playhead resets to 0
- Clip deleted, clips remain → Playhead adjusted if it's before first active region or beyond duration
- **Smart clamping**: Ensures playhead is always in a playable region

### Scenario 3: Trimming Clips

#### Case A: Playhead NOT in clip's visual bounds
- **Action**: Trim any clip where playhead is completely outside
- **Result**: Playhead does NOT move

#### Case B: Playhead in clip, trim doesn't pass it
- **Action**: Trim clip but new active region still includes playhead position
- **Result**: Playhead does NOT move

#### Case C: Front trim passes playhead
- **Action**: Drag left trim handle past playhead position (e.g., playhead at 30s, trim to 40s)
- **Result**: Playhead **follows the trim handle** and moves to the new active start (40s)
- **Real-time**: Playhead moves as you drag, not just when you release

#### Case D: Back trim passes playhead
- **Action**: Drag right trim handle past playhead position from right to left
- **Result**: Playhead **follows the trim handle** and moves to the new active end
- **Real-time**: Playhead moves as you drag, not just when you release

### Scenario 4: Splitting Clips
- Split at playhead → Playhead resets to beginning of first split clip's active region
- **Example**: First split clip has trimStart=0 and startTime=0 → Playhead at 0
- Reason: Two new clips created, start fresh from beginning

### Scenario 5: Repositioning Clips (Drag & Drop)
- Drag clip to new position → Playhead resets to beginning of first clip's active region
- **Example**: After reordering → Playhead at first clip's active start
- Reason: Clips reorganized, start fresh from beginning

### Scenario 6: Playback After Trimming
- Trim from front (playhead follows) → Playback starts from new trim position
- **Example**: Trim to 40s, playhead at 40s → Press play → Video starts at 40s
- **Key**: Video player syncs to playhead position via TimelinePreview effect

## Console Logging

Debug logging is included in `handleTimelineClipTrim` to help track playhead adjustments:
- Shows current playhead position
- Shows old vs new active regions
- Indicates whether playhead was moved and why

## Testing Checklist

- [ ] Add first clip → Playhead at 0
- [ ] Add second clip → Playhead stays at 0
- [ ] Trim clip (playhead elsewhere) → Playhead doesn't move
- [ ] Trim clip (playhead inside, safe trim) → Playhead doesn't move
- [ ] Trim from front past playhead → Playhead moves to trim edge
- [ ] Trim from back past playhead → Playhead moves to trim edge
- [ ] Delete all clips → Playhead at 0
- [ ] Split clip → Playhead resets to 0
- [ ] Reorder clips → Playhead resets to 0
- [ ] Play video → Playhead updates during playback (existing behavior preserved)

