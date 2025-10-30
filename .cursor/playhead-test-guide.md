# Playhead Trim Behavior - Test Guide

## How to Test the New Playhead Logic

### Setup
1. Import a video clip to the media library
2. Drag it to the timeline (Main track)
3. The playhead should automatically be at position 0 (start of timeline)

---

## Test Case 1: Playhead Follows Front Trim

**Steps:**
1. Click on the clip to select it (it will turn purple and show trim handles)
2. Click anywhere in the middle of the clip to move the playhead (e.g., click at 30s mark)
3. Grab the **LEFT trim handle** (blue bar on the left edge)
4. Drag it **to the right**, past the playhead position

**Expected Result:**
- ✅ As you drag the trim handle past the playhead, the playhead should **follow** the trim handle
- ✅ The playhead moves in **real-time** as you drag (not just when you release)
- ✅ The playhead ends up at the new active start position

**Console Output:**
```
=== Playhead Trim Check ===
  Current playhead position: 30
  Clip visual bounds: 0 to 60
  New active region: 40 to 60
  -> Playhead is within clip visual bounds
  -> Front trim passed playhead, moving to: 40
```

---

## Test Case 2: Playhead Follows Back Trim

**Steps:**
1. Click on the clip to select it
2. Click in the middle of the clip to position playhead (e.g., at 30s)
3. Grab the **RIGHT trim handle** (blue bar on the right edge)
4. Drag it **to the left**, past the playhead position

**Expected Result:**
- ✅ As you drag the trim handle past the playhead, the playhead should **follow** the trim handle
- ✅ The playhead moves in **real-time** as you drag
- ✅ The playhead ends up at the new active end position

**Console Output:**
```
=== Playhead Trim Check ===
  Current playhead position: 30
  Clip visual bounds: 0 to 60
  New active region: 0 to 20
  -> Playhead is within clip visual bounds
  -> Back trim passed playhead, moving to: 20
```

---

## Test Case 3: Playhead Doesn't Move (Safe Trim)

**Steps:**
1. Click on the clip to select it
2. Position playhead in the middle (e.g., at 30s)
3. Drag the LEFT trim handle to the right, but STOP before reaching the playhead
4. OR drag the RIGHT trim handle to the left, but STOP before reaching the playhead

**Expected Result:**
- ✅ Playhead does NOT move
- ✅ Trim handles move normally
- ✅ Playhead stays exactly where you positioned it

**Console Output:**
```
=== Playhead Trim Check ===
  Current playhead position: 30
  Clip visual bounds: 0 to 60
  New active region: 10 to 50
  -> Playhead is within clip visual bounds
  -> Playhead is within active region, no change
```

---

## Test Case 4: Multiple Clips (Playhead Outside)

**Steps:**
1. Add 2+ clips to the timeline
2. Click on Clip 2 to position the playhead in Clip 2
3. Select Clip 1 and trim it (any trim)

**Expected Result:**
- ✅ Playhead does NOT move (it's in a different clip)
- ✅ Only the trim on Clip 1 is affected

**Console Output:**
```
=== Playhead Trim Check ===
  Current playhead position: 20
  Clip visual bounds: 0 to 10
  New active region: 2 to 8
  -> Playhead is outside clip, no adjustment
```

---

## Test Case 5: Playhead Resets to 0

**Test after each action:**

### After Adding First Clip
- ✅ Playhead automatically at 0

### After Deleting All Clips
- ✅ Playhead resets to 0
- ✅ Timeline shows "Drop clips to begin"

### After Splitting Clip (Press 'S' or right-click > Split)
- ✅ Playhead resets to 0
- ✅ Two new clips appear

### After Repositioning Clip (Drag clip to new position)
- ✅ Playhead resets to 0
- ✅ Clips reorganize

---

## Test Case 6: Playback with Playhead

**Steps:**
1. Add clip to timeline (playhead at 0)
2. Press SPACEBAR or click Play button
3. Watch the playhead move during playback

**Expected Result:**
- ✅ Playhead moves smoothly across the timeline during playback
- ✅ Video and playhead stay in sync
- ✅ When video ends, playhead is at the end of timeline

---

## Common Issues to Watch For

### ❌ Playhead NOT Following Trim Handle
- Check console for "Playhead is outside clip, no adjustment"
- Make sure playhead is positioned within the clip being trimmed
- Try clicking on the clip first to ensure it's the active clip

### ❌ Playhead Jumps Instead of Smooth Movement
- This is expected - playhead updates with each state change during drag
- Should still feel responsive (not laggy)

### ❌ Playhead Doesn't Reset to 0
- Check console logs for timeline updates
- Make sure timeline.playheadPosition is being set
- Verify TimelinePreview effect is detecting the change

---

## Debug Console Commands

Open browser DevTools (F12) and type:

```javascript
// Check current playhead position
window.__TIMELINE_STATE__.playheadPosition

// Check timeline duration
window.__TIMELINE_STATE__.duration

// Check clips in timeline
window.__TIMELINE_STATE__.tracks[0].clips.length
```

(Note: These commands require you to expose the state in development mode)

---

## Success Criteria

All tests should pass:
- ✅ Playhead starts at 0 when clips added
- ✅ Playhead follows trim handles when dragged past it
- ✅ Playhead doesn't move during safe trimming
- ✅ Playhead resets to 0 after reorganization
- ✅ Playhead moves smoothly during playback
- ✅ Console logs show correct behavior

If all tests pass, the playhead logic is working correctly! 🎉

