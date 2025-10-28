# ClipForge MVP - Task List for Cursor Agent

**MVP Deadline:** Tuesday, October 29, 2024 at 10:59 PM CT

---

## PR #1: Project Setup & Electron Boilerplate

### Setup Tasks
- Initialize Node.js project with `npm init -y`
- Create folder structure:
  - `src/main/` (Electron main process)
  - `src/renderer/` (React frontend)
  - `src/renderer/components/`
  - `src/styles/`
  - `build/` (for app icons)
- Install core dependencies:
  - `electron`
  - `react`
  - `react-dom`
  - `fluent-ffmpeg`
  - `ffmpeg-static`
- Install dev dependencies:
  - `@vitejs/plugin-react`
  - `vite`
  - `vite-plugin-electron`
  - `electron-builder`
- Configure `package.json` with build scripts and electron-builder config
- Create `vite.config.js` for React build configuration
- Create `.gitignore` file

### Electron Main Process
- Create `src/main/main.js` with:
  - BrowserWindow setup (1280x800, min 1024x768)
  - Load Vite dev server in development mode
  - Load built files in production mode
  - Window lifecycle management
- Create `src/main/preload.js` with:
  - Context bridge for secure IPC
  - Expose electron APIs to renderer

### React Frontend
- Create `src/renderer/index.html` (entry point)
- Create `src/renderer/main.jsx` (React root setup)
- Create `src/renderer/App.jsx` with basic layout:
  - Header with "ClipForge MVP" title
  - Main content area
  - Basic state management setup (useState for clips and selectedClip)
- Create `src/styles/app.css` with:
  - CSS reset
  - Dark theme variables
  - Base layout styles (header, main)

### Verification
- App launches without errors
- Electron window displays React content
- DevTools accessible in development mode

---

## PR #2: Video Import Functionality

### IPC Handlers (Main Process)
- Add IPC handler in `src/main/main.js` for `import-video`:
  - Open native file dialog
  - Filter for MP4 and MOV files
  - Return selected file path
- Add IPC handler for `get-video-duration`:
  - Use fluent-ffmpeg.ffprobe() to extract video metadata
  - Return duration in seconds
- Configure fluent-ffmpeg to use bundled ffmpeg-static binary

### Preload Script
- Expose `importVideo()` method via context bridge
- Expose `getVideoDuration(filePath)` method via context bridge

### FileImport Component
- Create `src/renderer/components/FileImport.jsx` with:
  - "Import Video" button that triggers file picker
  - Drag-and-drop zone for video files
  - File type validation (MP4, MOV only)
  - Error handling for invalid files
  - Call parent callback with `{ filePath, duration }` on successful import
- Add styles for:
  - Import button (blue, prominent)
  - Drag-drop zone with dashed border
  - Dragging state visual feedback

### App Integration
- Update `src/renderer/App.jsx`:
  - Add FileImport component
  - Implement `handleVideoImported` function
  - Create clip object with: id, filePath, fileName, duration, trimStart, trimEnd
  - Add clip to clips array state
  - Set newly imported clip as selectedClip

### Verification
- Click "Import Video" opens file picker
- Selecting MP4/MOV file adds it to app state
- Drag-drop MP4/MOV file works
- Non-video files show error message
- Video duration extracted correctly

---

## PR #3: Timeline Display

### Timeline Component
- Create `src/renderer/components/Timeline.jsx` with:
  - Display "No clips" message when empty
  - Horizontal scrollable container for clips
  - Render clip cards for each imported video
  - Each clip card shows:
    - Placeholder thumbnail (emoji or icon)
    - Filename (truncated if needed)
    - Duration in MM:SS format
  - Click handler to select clip
  - Visual indicator for selected clip (border/background color)
  - Helper function to format seconds as MM:SS

### Timeline Styles
- Add styles to `src/styles/app.css`:
  - Timeline container with dark background
  - Horizontal scrolling layout
  - Clip card styling (fixed width ~150px)
  - Hover effects on clips
  - Selected state styling (blue border/background)
  - Empty state styling

### App Integration
- Update `src/renderer/App.jsx`:
  - Add Timeline component
  - Pass clips array, selectedClip, and onClipSelect callback
  - Implement `handleClipSelect` to update selectedClip state

### Verification
- Imported clips appear in timeline
- Timeline scrolls horizontally with many clips
- Clicking clip selects it (visual change)
- Empty timeline shows placeholder message

---

## PR #4: Video Player

### VideoPlayer Component
- Create `src/renderer/components/VideoPlayer.jsx` with:
  - HTML5 `<video>` element with ref
  - Load video from file:// URL when clip selected
  - Play/Pause button
  - Seek bar (range input) for scrubbing
  - Time display showing current time / total duration
  - Handle video events:
    - `timeupdate` to track playback position
    - `loadedmetadata` to get video duration
    - `ended` to reset play button
  - Empty state when no clip selected
  - Helper function to format seconds as MM:SS

### VideoPlayer Styles
- Add styles to `src/styles/app.css`:
  - Video element sizing (max-height 500px, full width)
  - Controls bar layout (flexbox)
  - Play/pause button styling
  - Custom seek bar styling (webkit and mozilla)
  - Time display styling
  - Empty state placeholder

### App Integration
- Update `src/renderer/App.jsx`:
  - Add VideoPlayer component above Timeline
  - Pass selectedClip as prop

### Verification
- Selecting clip loads video in player
- Play button starts playback
- Pause button stops playback
- Seek bar scrubs to different positions
- Time display updates during playback
- Switching clips loads new video

---

## PR #5: Trim Controls

### TrimControls Component
- Create `src/renderer/components/TrimControls.jsx` with:
  - Display only when clip is selected
  - Input field for start time (seconds or MM:SS)
  - Input field for end time (seconds or MM:SS)
  - Display calculated trim duration
  - Validation:
    - Start time >= 0
    - End time <= video duration
    - End time > start time
  - Error messages for invalid inputs
  - Update parent state when trim values change
  - Helper functions:
    - Parse time input (handle both seconds and MM:SS format)
    - Format seconds as MM:SS
    - Validate trim range

### TrimControls Styles
- Add styles to `src/styles/app.css`:
  - Container styling
  - Input field styling
  - Labels and help text
  - Error message styling (red text)
  - Duration display styling

### App Integration
- Update `src/renderer/App.jsx`:
  - Add TrimControls component
  - Pass selectedClip and update callback
  - Implement `handleTrimUpdate` to update clip's trimStart and trimEnd in state
  - Update clips array with modified trim values

### Verification
- Trim controls appear when clip selected
- Can set start time within valid range
- Can set end time within valid range
- Invalid times show error messages
- Trim duration calculates correctly
- Trim values persist when switching between clips

---

## PR #6: Video Export

### IPC Handlers (Main Process)
- Add IPC handler in `src/main/main.js` for `export-video`:
  - Receive export options: inputPath, outputPath, startTime, duration
  - Use fluent-ffmpeg to process video:
    - Set start time with `.setStartTime()`
    - Set duration with `.setDuration()`
    - Set output path with `.output()`
    - Configure codecs: H.264 video, AAC audio
  - Send progress updates via IPC event `export-progress`
  - Send completion via IPC event `export-complete`
  - Send errors via IPC event `export-error`
  - Return promise that resolves when export completes
- Add IPC handler for `save-dialog`:
  - Open native save file dialog
  - Default to MP4 extension
  - Return selected save path

### Preload Script
- Expose `exportVideo(options)` method via context bridge
- Expose `onExportProgress(callback)` listener via context bridge
- Expose `onExportComplete(callback)` listener via context bridge
- Expose `onExportError(callback)` listener via context bridge
- Expose `saveDialog()` method via context bridge

### ExportButton Component
- Create `src/renderer/components/ExportButton.jsx` with:
  - "Export Video" button
  - Disabled state when no clip selected or already exporting
  - Progress bar showing export percentage
  - Status messages (exporting, complete, error)
  - Handle export flow:
    - Open save dialog
    - Calculate trim parameters
    - Call export IPC handler
    - Listen for progress updates
    - Show completion/error messages

### ExportButton Styles
- Add styles to `src/styles/app.css`:
  - Export button styling (prominent, green)
  - Disabled state styling
  - Progress bar container and fill
  - Status message styling
  - Success/error message colors

### App Integration
- Update `src/renderer/App.jsx`:
  - Add ExportButton component
  - Pass selectedClip as prop

### Verification
- Export button appears
- Clicking opens save dialog
- Export progress updates in real-time
- Exported file is created at chosen location
- Exported video plays in external player (VLC, QuickTime)
- Trim points are applied correctly
- Video maintains quality and resolution
- Success message appears on completion
- Errors are displayed if export fails

---

## PR #7: App Packaging & Distribution

### Packaging Configuration
- Update `package.json` with electron-builder configuration:
  - Set appId (e.g., "com.clipforge.app")
  - Set productName ("ClipForge")
  - Configure Mac target (dmg or app)
  - Configure Windows target (nsis)
  - Include dist folder and node_modules in build
  - Bundle ffmpeg-static binary in extraResources
- Update build scripts in package.json:
  - `build`: Vite build command
  - `package`: electron-builder for current platform
  - `package:mac`: Build for macOS
  - `package:win`: Build for Windows

### Production Path Handling
- Update `src/main/main.js`:
  - Correctly load built files in production mode
  - Handle file:// protocol for loading index.html
  - Set correct path for ffmpeg binary in production
- Test that packaged app can find all resources

### App Icons
- Create or add app icons in `build/` folder:
  - `icon.icns` for macOS
  - `icon.ico` for Windows
  - Reference in electron-builder config

### Build Process
- Run Vite build to create production files in `dist/`
- Run electron-builder to create distributable packages
- Test packaged app on clean machine (without dev tools)

### README Documentation
- Create `README.md` with:
  - Project description
  - System requirements
  - Installation instructions for development
  - How to run in dev mode
  - How to build for production
  - How to use the app (basic user guide)
  - Technical stack overview
  - Known limitations

### Verification
- `npm run build` succeeds without errors
- `npm run package` creates executable
- Packaged app launches on clean system
- All features work in packaged app
- FFmpeg operations work in production
- App size is reasonable (<200MB)
- App icon displays correctly

---

## Final Testing Checklist

### Functional Tests
- [ ] App launches without errors
- [ ] Import MP4 via file picker
- [ ] Import MOV via drag-drop
- [ ] Multiple clips display in timeline
- [ ] Select clip loads in player
- [ ] Video plays and pauses correctly
- [ ] Seek bar scrubs through video
- [ ] Set trim start time
- [ ] Set trim end time
- [ ] Invalid trim values show errors
- [ ] Export opens save dialog
- [ ] Export completes successfully
- [ ] Exported video plays in external player
- [ ] Trimmed video has correct duration and content

### Build Tests
- [ ] Production build completes
- [ ] Packaged app installs/opens
- [ ] All features work in packaged version
- [ ] FFmpeg binary is bundled
- [ ] No console errors in production

### Performance Tests
- [ ] App launches in under 5 seconds
- [ ] Can handle 100MB+ video files
- [ ] Export completes in reasonable time
- [ ] UI remains responsive during operations

---

## MVP Success Criteria

✅ Desktop app launches  
✅ Basic video import (drag & drop or file picker for MP4/MOV)  
✅ Simple timeline view showing imported clips  
✅ Video preview player that plays imported clips  
✅ Basic trim functionality (set in/out points on a single clip)  
✅ Export to MP4 (even if just one clip)  
✅ Built and packaged as a native app (not just running in dev mode)

---

## Notes for Cursor Agent

- Use Electron + React + Vite stack
- fluent-ffmpeg for video processing
- ffmpeg-static for bundled FFmpeg binary
- electron-builder for packaging
- Dark theme UI (background: #1a1a1a)
- File paths should use Node.js `path` module for cross-platform compatibility
- All IPC communication should go through preload script (context bridge)
- Error handling for all file operations and FFmpeg processes
- Test with real video files throughout development