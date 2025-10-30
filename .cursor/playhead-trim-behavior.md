# Playhead & Trim Behavior Visualization

## The Rule
**The playhead follows the trim handle whenever you drag it past the playhead position.**

---

## Example 1: Front Trim (Left Handle)

### Initial State
```
Clip: [==========================================]
      |    grey    |  ACTIVE REGION   |  grey  |
      0s          10s     PLAYHEAD     40s     60s
                           at 30s
```

### Scenario A: Trim but don't pass playhead
**Action**: Drag left trim handle from 10s → 20s (still before playhead)
```
Clip: [==========================================]
      |       grey       |  ACTIVE  |   grey   |
      0s                20s  30s    40s       60s
                            ↑
                        Playhead
                        STAYS at 30s
```
✅ **Result**: Playhead does NOT move (still at 30s)

---

### Scenario B: Trim PAST playhead
**Action**: Drag left trim handle from 10s → 40s (past the 30s playhead)
```
Clip: [==========================================]
      |              grey              | ACTIVE |
      0s                              40s      60s
                                       ↑
                                   Playhead
                                   MOVES to 40s
```
✅ **Result**: Playhead FOLLOWS the trim handle to 40s

**Why?** The playhead was at 30s, but now the active region starts at 40s. The trim handle "pushed" the playhead along with it.

---

## Example 2: Back Trim (Right Handle)

### Initial State
```
Clip: [==========================================]
      |  grey  |    ACTIVE REGION    |  grey   |
      0s      10s      PLAYHEAD      50s       60s
                         at 30s
```

### Scenario A: Trim but don't pass playhead
**Action**: Drag right trim handle from 50s → 40s (still after playhead)
```
Clip: [==========================================]
      |  grey  |   ACTIVE   |      grey        |
      0s      10s    30s    40s               60s
                      ↑
                  Playhead
                  STAYS at 30s
```
✅ **Result**: Playhead does NOT move (still at 30s)

---

### Scenario B: Trim PAST playhead
**Action**: Drag right trim handle from 50s → 20s (past the 30s playhead)
```
Clip: [==========================================]
      |  grey  | ACTIVE |         grey          |
      0s      10s      20s                     60s
                        ↑
                    Playhead
                    MOVES to 20s
```
✅ **Result**: Playhead FOLLOWS the trim handle to 20s

**Why?** The playhead was at 30s, but now the active region ends at 20s. The trim handle "pushed" the playhead along with it.

---

## Example 3: Playhead Outside Clip

### Initial State
```
Clip 1: [=============] Clip 2: [=============]
        0s          15s         15s   ↑     30s
                                   Playhead
                                   at 20s
```

### Trim Clip 1
**Action**: Trim Clip 1 in any way
```
Clip 1: [=======]       Clip 2: [=============]
        0s    10s               15s   ↑     30s
                                   Playhead
                                   STAYS at 20s
```
✅ **Result**: Playhead does NOT move (it's not in Clip 1)

---

## Key Takeaways

1. **Playhead only moves if:**
   - The playhead is within the clip's visual bounds (even in grey areas)
   - AND the trim handle passes the playhead position

2. **Playhead follows trim handle in real-time:**
   - As you drag the trim handle, the playhead updates immediately
   - You see the playhead move along with your mouse cursor

3. **Playhead stays put if:**
   - Trimming a different clip
   - Trim handle doesn't reach the playhead position
   - Playhead is outside the clip entirely

---

## Technical Implementation

The check in `handleTimelineClipTrim`:

```javascript
// Check if playhead is anywhere within this clip's visual bounds (including grey areas)
if (currentPlayheadPosition >= clipVisualStart && currentPlayheadPosition < clipVisualEnd) {
  
  // Front trim: if new active start > playhead position
  if (newActiveStart > currentPlayheadPosition) {
    newTimeline.playheadPosition = newActiveStart  // Follow trim handle
  }
  
  // Back trim: if new active end < playhead position
  else if (newActiveEnd < currentPlayheadPosition) {
    newTimeline.playheadPosition = newActiveEnd    // Follow trim handle
  }
  
  // Otherwise: playhead stays where it is
}
```

This ensures the playhead "follows" the trim handle whenever it would otherwise be in a greyed-out (trimmed) region.

