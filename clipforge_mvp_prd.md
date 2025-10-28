# ClipForge MVP - Product Requirements Document

**Version:** 1.0  
**Deadline:** Tuesday, October 29, 2024 at 10:59 PM CT  
**Target:** Minimum Viable Product (Hard Gate)

---

## Executive Summary

ClipForge MVP is a desktop video editor that proves core video handling capabilities: import a video file, display it on a timeline, trim it, and export the result. This MVP validates the technical foundation before adding advanced features like recording, multi-clip editing, and effects.

**Core Value Proposition:** A working desktop application that can process video files end-to-end in a native environment.

---

## Success Criteria

The MVP passes if all 7 requirements are met by Tuesday 10:59 PM CT:

1. ✅ Desktop app launches successfully
2. ✅ Can import video files (MP4/MOV)
3. ✅ Displays imported clips in timeline view
4. ✅ Plays video in preview player
5. ✅ Can set trim in/out points on a clip
6. ✅ Exports trimmed clip to MP4
7. ✅ Packaged as native app (not dev mode)

---

## Technical Architecture

### Tech Stack
- **Desktop Framework:** Electron 27+
- **Frontend:** React 18+ with Vite
- **Video Processing:** fluent-ffmpeg + ffmpeg-static
- **Build Tool:** electron-builder
- **Language:** JavaScript/TypeScript

### Architecture Diagram
```
┌─────────────────────────────────────┐
│         Electron Main Process       │
│  - Window management                │
│  - File system access               │
│  - FFmpeg operations                │
└─────────────────────────────────────┘
                 │
                 │ IPC
                 │
┌─────────────────────────────────────┐
│      Electron Renderer Process      │
│                                     │
│  ┌──────────────────────────────┐  │
│  │      React Application       │  │
│  │                              │  │
│  │  ├─ File Import Component   │  │
│  │  ├─ Timeline Component       │  │
│  │  ├─ Video Player Component   │  │
│  │  ├─ Trim Controls Component  │  │
│  │  └─ Export Component         │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
                 │
                 │ Node.js bindings
                 │
┌─────────────────────────────────────┐
│         FFmpeg (Native Binary)      │
│  - Video encoding/decoding          │
│  - Format conversion                │
│  - Trimming operations              │
└─────────────────────────────────────┘
```

---

## MVP Requirements (Detailed)

### 1. Desktop App Launch

**Requirement:** Application starts and displays main window

**Acceptance Criteria:**
- Double-click app icon launches window
- Window displays within 5 seconds
- No console errors or crashes on launch
- Window is resizable and closable
- Minimum window size: 1024x768

**Technical Implementation:**
- Electron main.js creates BrowserWindow
- Loads React app via Vite dev server (dev) or built files (production)
- Basic menu bar (File > Quit)

---

### 2. Video Import

**Requirement:** Users can add video files to the application

**Acceptance Criteria:**
- File picker button opens native file dialog
- Supports MP4 and MOV formats
- Drag & drop video file onto app window works
- Displays file name after import
- Shows error message for unsupported formats
- Can import multiple files sequentially

**Technical Implementation:**
- Electron dialog.showOpenDialog() for file picker
- Filter: `['.mp4', '.mov']`
- Drag-drop: Handle `ondrop` event in React
- Validate file extension before accepting
- Store file path in React state

**UI Elements:**
- "Import Video" button (primary action)
- Drag-drop zone with visual feedback
- Imported file list showing filename and duration

---

### 3. Timeline View

**Requirement:** Visual representation of imported clips

**Acceptance Criteria:**
- Horizontal timeline container displays imported clips
- Each clip shows:
  - Thumbnail or placeholder
  - Filename
  - Duration (MM:SS)
- Clips are visually distinct (borders, spacing)
- Timeline scales to show all imported clips
- Selected clip is highlighted

**Technical Implementation:**
- Scrollable horizontal container (CSS: `overflow-x: auto`)
- Each clip as a React component (div with metadata)
- Click handler to select clip
- Extract video duration using fluent-ffmpeg.ffprobe()
- Optional: Generate thumbnail using FFmpeg frame extraction

**UI Layout:**
```
┌─────────────────────────────────────────────────┐
│  Timeline                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Clip 1  │  │  Clip 2  │  │  Clip 3  │     │
│  │  [img]   │  │  [img]   │  │  [img]   │     │
│  │  2:34    │  │  1:15    │  │  0:45    │     │
│  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────┘
```

---

### 4. Video Preview Player

**Requirement:** Play selected video clip in preview window

**Acceptance Criteria:**
- Click clip in timeline → loads in player
- Video displays at reasonable size (maintain aspect ratio)
- Play/pause button controls playback
- Video plays smoothly at native framerate
- Shows current playback time (MM:SS / MM:SS)
- Seek bar allows scrubbing through video

**Technical Implementation:**
- HTML5 `<video>` element
- Set `src` attribute to file:// URL of selected clip path
- Standard video controls or custom React controls
- Handle `timeupdate` event to track playback position
- Handle `loadedmetadata` event to get duration

**UI Elements:**
```
┌───────────────────────────────┐
│                               │
│      Video Preview Area       │
│        [video player]         │
│                               │
├───────────────────────────────┤
│  [Play] ━━━━●━━━━━  [2:34]   │
└───────────────────────────────┘
```

---

### 5. Trim Functionality

**Requirement:** Set in/out points to trim a single clip

**Acceptance Criteria:**
- Select a clip to enable trim controls
- Set "Start Time" (in point) in seconds or MM:SS format
- Set "End Time" (out point) in seconds or MM:SS format
- Visual feedback shows trimmed region
- Invalid times show error (e.g., end < start)
- Trim settings persist when selecting different clips
- Preview player respects trim points (optional for MVP)

**Technical Implementation:**
- Input fields for start and end time
- Validate: 0 ≤ start < end ≤ duration
- Store trim data in clip object: `{ start: number, end: number }`
- Display trimmed duration: `end - start`
- Optional: Add markers on video seek bar showing trim region

**UI Elements:**
```
┌─────────────────────────────────────┐
│  Trim Controls (Clip: video.mp4)   │
│                                     │
│  Start Time: [00:15] seconds       │
│  End Time:   [01:45] seconds       │
│  Duration:   01:30                  │
│                                     │
│  [Apply Trim]                       │
└─────────────────────────────────────┘
```

---

### 6. Export to MP4

**Requirement:** Export trimmed clip as MP4 file

**Acceptance Criteria:**
- "Export" button triggers export process
- File save dialog lets user choose output location and name
- Progress indicator shows export status
- Exported file:
  - Format: MP4
  - Video codec: H.264
  - Audio codec: AAC (if source has audio)
  - Applies trim points correctly
  - Maintains source resolution and quality
- Success message shows when export completes
- Error message if export fails
- Exported file plays in standard video players (VLC, QuickTime)

**Technical Implementation:**
- Use fluent-ffmpeg to process video:
  ```javascript
  ffmpeg(inputPath)
    .setStartTime(startTime) // in seconds
    .setDuration(duration)   // end - start
    .output(outputPath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .on('progress', (progress) => { /* update UI */ })
    .on('end', () => { /* show success */ })
    .on('error', (err) => { /* show error */ })
    .run();
  ```
- Electron dialog.showSaveDialog() for output path
- Display progress percentage in UI
- Disable export button during processing

**UI Elements:**
```
┌─────────────────────────────────────┐
│  [Export Video]                     │
│                                     │
│  Exporting...                       │
│  ████████████░░░░░░░  65%          │
│                                     │
└─────────────────────────────────────┘
```

---

### 7. Packaged Native App

**Requirement:** Distribute as standalone executable, not dev mode

**Acceptance Criteria:**
- Build creates platform-specific executable:
  - macOS: `.app` bundle or `.dmg`
  - Windows: `.exe` installer
- User can launch app without Node.js or npm installed
- FFmpeg binary is bundled (no external dependencies)
- App icon displays correctly
- App appears in Applications folder (Mac) or Program Files (Windows)
- Build size under 200MB

**Technical Implementation:**
- Use electron-builder for packaging
- Configuration in `package.json` or `electron-builder.yml`:
  ```json
  {
    "build": {
      "appId": "com.clipforge.app",
      "productName": "ClipForge",
      "mac": {
        "target": "dmg",
        "icon": "build/icon.icns"
      },
      "win": {
        "target": "nsis",
        "icon": "build/icon.ico"
      },
      "files": [
        "dist/**/*",
        "node_modules/**/*"
      ],
      "extraResources": [
        "node_modules/ffmpeg-static/ffmpeg"
      ]
    }
  }
  ```
- ffmpeg-static automatically includes correct binary for target platform
- Test packaged app on clean machine (no dev tools)

**Build Commands:**
```bash
# Development
npm run dev

# Build production files
npm run build

# Package for current platform
npm run package

# Package for specific platform
npm run package:mac
npm run package:win
```

---

## Non-Goals for MVP

The following are **explicitly out of scope** for MVP (save for Wednesday):

❌ Screen recording  
❌ Webcam recording  
❌ Multi-clip concatenation  
❌ Timeline playback of multiple clips  
❌ Audio waveform visualization  
❌ Transitions or effects  
❌ Text overlays  
❌ Undo/redo  
❌ Keyboard shortcuts  
❌ Project save/load  
❌ Cloud upload  
❌ Advanced timeline features (multi-track, snap-to-grid)

**Focus:** Prove the core video pipeline works. Add features Wednesday.

---

## User Flow

### Happy Path
1. Launch ClipForge app
2. Click "Import Video" or drag video file
3. See video appear in timeline
4. Click video to load in player
5. Watch video play
6. Set start time (e.g., 0:15) and end time (e.g., 1:45)
7. Click "Export"
8. Choose save location
9. Wait for export progress (show %)
10. Receive success notification
11. Open exported file in VLC → plays trimmed section

### Edge Cases to Handle
- Import non-video file → show error
- Set invalid trim times → show validation error
- Export fails (disk full, permissions) → show error message
- App quit during export → clean up temp files
- Video file deleted after import → handle missing file gracefully

---

## Testing Checklist

Before submitting MVP on Tuesday:

### Functional Tests
- [ ] App launches without errors
- [ ] Import MP4 file via file picker
- [ ] Import MOV file via drag-drop
- [ ] Timeline displays imported clip with correct duration
- [ ] Click clip → loads in player
- [ ] Play/pause button works
- [ ] Seek bar allows scrubbing
- [ ] Set trim start and end times
- [ ] Validation prevents invalid trim times
- [ ] Export button triggers save dialog
- [ ] Export completes successfully
- [ ] Exported video plays in external player (VLC/QuickTime)
- [ ] Trimmed video has correct duration
- [ ] Trimmed video starts and ends at correct points

### Build Tests
- [ ] `npm run build` succeeds
- [ ] `npm run package` creates executable
- [ ] Packaged app launches on clean system (no dev tools)
- [ ] FFmpeg binary is bundled correctly
- [ ] App size under 200MB
- [ ] App icon displays

### Performance Tests
- [ ] App launches in under 5 seconds
- [ ] Import 100MB video file works
- [ ] Export completes in reasonable time (2-min video → <1 min export)
- [ ] No memory leaks (check Activity Monitor during 10-min session)

---

## File Structure

```
clipforge/
├── src/
│   ├── main/
│   │   ├── main.js              # Electron main process
│   │   ├── preload.js           # Context bridge
│   │   └── ffmpeg-handler.js    # FFmpeg operations
│   ├── renderer/
│   │   ├── App.jsx              # Main React component
│   │   ├── components/
│   │   │   ├── FileImport.jsx
│   │   │   ├── Timeline.jsx
│   │   │   ├── VideoPlayer.jsx
│   │   │   ├── TrimControls.jsx
│   │   │   └── ExportButton.jsx
│   │   ├── main.jsx             # React entry point
│   │   └── index.html
│   └── styles/
│       └── app.css
├── build/
│   ├── icon.icns                # macOS icon
│   └── icon.ico                 # Windows icon
├── package.json
├── vite.config.js
├── electron-builder.yml
└── README.md
```

---

## Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "electron": "^27.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "fluent-ffmpeg": "^2.1.2",
    "ffmpeg-static": "^5.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "electron-builder": "^24.6.4",
    "vite": "^5.0.0",
    "vite-plugin-electron": "^0.14.0"
  }
}
```

---

## Risk Mitigation

### High Risk Items
1. **FFmpeg configuration** - Most likely source of issues
   - Mitigation: Test FFmpeg export early (Monday afternoon)
   - Have backup: @ffmpeg/ffmpeg (WASM) if native fails

2. **Electron packaging** - Build issues can appear late
   - Mitigation: Test packaging Monday evening
   - Allocate 2-3 hours for packaging debugging

3. **File path handling** - Cross-platform differences
   - Mitigation: Use Node.js `path` module consistently
   - Test with files in different locations

### Medium Risk Items
1. **Video duration extraction** - Some formats are tricky
   - Mitigation: Use ffprobe via fluent-ffmpeg
   - Handle errors gracefully

2. **Trim validation** - Edge cases with different video formats
   - Mitigation: Test with multiple video files
   - Add input sanitization

---

## Success Metrics

**MVP passes if:**
- All 7 requirements work end-to-end
- Demo video shows successful workflow
- Packaged app runs on instructor's machine
- No critical bugs during testing

**Quality indicators:**
- Export completes in under 2 minutes for 2-minute video
- App feels responsive (no freezing UI)
- Error messages are clear and helpful
- Exported video quality is good

---

## Timeline

### Monday (Today)
- **0-2 hours:** Environment setup, Electron + React boilerplate
- **2-4 hours:** Video import and basic timeline display
- **4-6 hours:** Video player component
- **6-8 hours:** FFmpeg integration and test export

### Tuesday (MVP Deadline Day)
- **0-3 hours:** Trim controls implementation
- **3-5 hours:** Polish export functionality
- **5-7 hours:** Packaging and build testing
- **7-9 hours:** Full MVP testing and bug fixes
- **9-10 hours:** Demo video recording
- **10:59 PM:** Submit MVP

---

## Submission Deliverables

By Tuesday 10:59 PM CT, submit:

1. **GitHub Repository**
   - All source code
   - README with setup instructions
   - Build instructions

2. **Packaged App**
   - macOS: `.dmg` or `.app` (hosted on GitHub Releases or Google Drive)
   - Download link in README

3. **Demo Video** (optional for MVP, required for final)
   - Show: launch, import, timeline, play, trim, export
   - 2-3 minutes max

---

## Post-MVP (Wednesday Work)

After MVP submission Tuesday night, Wednesday goals:

- Screen recording via desktopCapturer
- Webcam recording via getUserMedia
- Multi-clip concatenation
- Enhanced timeline (multi-track, playback of sequence)
- Polish UI/UX
- Windows build (if possible)
- Comprehensive testing

---

## Appendix: Key Code Snippets

### FFmpeg Trim and Export
```javascript
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

function exportVideo(inputPath, outputPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent}% done`);
      })
      .on('end', () => {
        console.log('Export completed');
        resolve();
      })
      .on('error', (err) => {
        console.error('Export error:', err);
        reject(err);
      })
      .run();
  });
}
```

### Get Video Duration
```javascript
function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
    });
  });
}
```

### Electron File Import
```javascript
// Main process
const { dialog } = require('electron');

ipcMain.handle('import-video', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mov'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});
```

---

**End of PRD**

*This document defines the minimum requirements to pass MVP checkpoint. Ship this first, then iterate.*