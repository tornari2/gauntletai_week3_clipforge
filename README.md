# ClipEdit

A modern desktop video editor built with Electron, React, and FFmpeg for professional video editing with advanced timeline management, clip splitting, trimming, and export functionality.

## 🎬 Current Project Status

**Version**: 2.1.0  
**Status**: Production Ready ✅  
**Last Updated**: November 2024  

### ✨ Key Features

#### Core Video Editing
- **Advanced Timeline System**: Horizontal timeline with visual playhead overlay showing current position
- **Multi-Clip Support**: Stitch together multiple videos (MP4, MOV, WebM) seamlessly
- **Clip Splitting**: Split clips at playhead position (supports recursive splitting)
- **Precision Trimming**: Visual trim handles with real-time preview
- **Drag & Drop Reordering**: Easily swap and rearrange clips on timeline
- **Timeline Preview**: Full timeline playback with seamless transitions between clips
- **Subtitle Support**: Import .srt/.vtt subtitle files and display them on timeline and during playback

#### Playback & Navigation
- **Spacebar Play/Pause**: Quick keyboard control for video playback
- **Playhead-Centered Zoom**: Zoom in/out while keeping playhead in view
- **Visual Playhead Indicator**: Red line shows exact playback position on timeline
- **Smart Playhead Behavior**: Automatically skips trimmed regions during playback

#### Import & Recording
- **File Import**: Import videos via file picker (drag-and-drop from file system not supported due to Electron security restrictions)
- **Subtitle Import**: Import subtitle files (.srt, .vtt) with automatic video name matching
- **Screen Recording**: Built-in screen capture with audio support
- **Multiple Format Support**: MP4, MOV, and WebM for videos; SRT and VTT for subtitles

#### Export
- **Multi-Resolution Export**: Original, 4K, 1080p, 720p, 480p, 360p
- **Single File Output**: All segments concatenated into one video file
- **Subtitle Export**: Optional SRT file export alongside video
- **Format Support**: Export to MP4 with H.264 video and AAC audio
- **Progress Tracking**: Real-time export progress feedback

#### User Experience
- **Modern Dark UI**: Professional dark theme interface
- **No Overlap Guarantee**: Clips positioned using full duration to prevent visual overlap
- **Context Menus**: Right-click clips for quick actions
- **Magnetic Snapping**: Clips snap to edges when repositioning

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ClipEdit Desktop App                     │
├─────────────────────────────────────────────────────────────────┤
│  Electron Main Process (Node.js)                               │
│  ├── main.js - App lifecycle, IPC handlers, FFmpeg integration │
│  │   ├── Video import/export handlers                          │
│  │   ├── Screen recording source enumeration                   │
│  │   ├── File system operations                                │
│  │   └── FFmpeg command construction                           │
│  └── preload.js - Secure IPC bridge (contextBridge)            │
├─────────────────────────────────────────────────────────────────┤
│  Renderer Process (React + Vite)                               │
│  ├── App.jsx - Main application state & logic                  │
│  │   ├── Clip management (import, split, trim, delete)        │
│  │   ├── Timeline state (tracks, duration, playhead, zoom)    │
│  │   ├── Clip positioning (full duration, no overlap)         │
│  │   └── Split/trim/reposition handlers                        │
│  ├── Components/                                               │
│  │   ├── MediaLibrary.jsx - Video import & library management  │
│  │   ├── VideoPlayer.jsx - Single clip preview                 │
│  │   ├── TimelinePreview.jsx - Multi-clip timeline playback    │
│  │   │   ├── Seamless clip transitions                         │
│  │   │   ├── Playhead position tracking                        │
│  │   │   └── Spacebar play/pause control                       │
│  │   ├── HorizontalTimeline.jsx - Visual timeline editor       │
│  │   │   ├── Playhead overlay with skip behavior              │
│  │   │   ├── Clip drag/drop/reordering                         │
│  │   │   ├── Trim handles (left/right)                         │
│  │   │   ├── Zoom controls (playhead-centered)                 │
│  │   │   ├── Context menu (split/delete)                       │
│  │   │   └── Magnetic snapping                                 │
│  │   ├── RecordingPanel.jsx - Screen/webcam recording          │
│  │   │   ├── Source selection (screen/window/mic)             │
│  │   │   ├── Recording controls                                │
│  │   │   └── Auto-add to timeline                              │
│  │   └── ExportButton.jsx - Multi-clip export with scaling     │
│  │       ├── Resolution selection                              │
│  │       ├── Split clip support (videoOffset handling)        │
│  │       └── Progress tracking                                 │
│  └── Styles/ - app.css (1750+ lines) with dark theme           │
├─────────────────────────────────────────────────────────────────┤
│  Native Dependencies                                            │
│  ├── ffmpeg-static - Video processing engine                   │
│  ├── ffprobe-static - Video metadata extraction                │
│  ├── fluent-ffmpeg - FFmpeg JavaScript API                     │
│  └── electron-builder - App packaging                          │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Timeline State (full duration positioning)
  ↓
App.jsx (clip management, split/trim logic)
  ↓
HorizontalTimeline (visual representation, user interaction)
  ↓
TimelinePreview (playback with active durations)
  ↓
Playhead Position (visual timeline position)
  ↓
ExportButton (FFmpeg filter complex with trim/concat/scale)
```

### Key Design Decisions

1. **Full Duration Positioning**: Clips positioned using full video duration on timeline to prevent visual overlap of trim regions
2. **Active Duration Playback**: Playback uses only active (non-trimmed) portions with seamless transitions
3. **Split Clip Architecture**: Split clips track `videoOffsetStart/End` to reference original video correctly
4. **Playhead-Centered Zoom**: Zoom recalculates pixels-per-second before/after to maintain visual position
5. **Video-Only Concat**: FFmpeg filter uses video-only concat with optional audio mapping for compatibility

## 📋 System Requirements

- **macOS**: 10.14 or later (Apple Silicon optimized)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 1GB free disk space
- **Architecture**: ARM64 (M1/M2/M3/M4 Macs)

## 🚀 Getting Started

### For End Users

**Installation:**
1. Download the latest DMG from [Releases](https://github.com/tornari2/gauntletai_week3_clipedit/releases)
2. Double-click the DMG file to mount it
3. Drag ClipEdit to your Applications folder
4. Launch ClipEdit from Applications
5. Grant permissions when prompted:
   - Screen Recording (for screen capture)
   - Microphone (for audio recording)

**First Launch:**
- If macOS shows security warning: System Preferences → Security & Privacy → Open Anyway

### For Developers

**Prerequisites:**
- Node.js 18+ (LTS recommended)
- npm 9+
- Git
- macOS (for building macOS apps)

**Setup:**

```bash
# Clone the repository
git clone https://github.com/tornari2/gauntletai_week3_clipedit.git
cd gauntletai_week3_clipedit

# Install dependencies
npm install
```

**Development:**

```bash
# Run in development mode (hot reload enabled)
npm run dev

# Run Electron in development with Vite
npm run electron-dev

# The dev script starts Vite on http://localhost:5173
# Changes to React components will hot-reload automatically
```

**Building:**

```bash
# Build for production
npm run build

# Package for macOS (creates DMG in dist/ folder)
npm run package:mac

# Package for Windows (creates EXE - requires Windows or Wine)
npm run package:win

# Package for current platform
npm run package
```

**Available Scripts:**

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (React hot reload) |
| `npm run electron-dev` | Run Vite + Electron concurrently |
| `npm run build` | Build production bundles (dist/ and dist-electron/) |
| `npm run package` | Package for current platform |
| `npm run package:mac` | Create macOS DMG installer |
| `npm run package:win` | Create Windows EXE installer |

## 📖 Usage Guide

### Basic Workflow

1. **Import Videos**:
   - Click "Choose Video File" button in Media Library
   - Select MP4, MOV, or WebM files
   - Videos appear in the media library with thumbnails

2. **Build Timeline**:
   - Drag clips from media library to timeline tracks
   - Clips appear as colored bars (blue for normal, green when selected)
   - Drag clips horizontally to reorder/swap positions

3. **Trim Clips**:
   - Click a clip on timeline to select it (turns green)
   - Trim handles appear on left and right edges
   - Drag handles to trim clip start/end
   - Greyed-out regions show trimmed portions

4. **Split Clips**:
   - Move playhead (red line) to desired position
   - Right-click the clip under playhead
   - Select "Split at playhead"
   - Clip splits into two independent clips

5. **Preview**:
   - Press spacebar or click play button
   - Playhead moves along timeline showing current position
   - Playhead automatically skips trimmed regions
   - Video transitions seamlessly between clips

6. **Zoom Timeline**:
   - Click +/- buttons or click percentage to reset
   - Zoom centers on playhead position
   - Scroll horizontally to navigate

7. **Export**:
   - Select resolution (Original, 1080p, 720p, etc.)
   - Optionally enable subtitle export (if subtitles present)
   - Click "Export Video"
   - Choose save location
   - Wait for progress bar to complete
   - Output: Single concatenated video file (+ optional .srt file)

### Advanced Features

#### Subtitle Management
1. **Import Subtitles**:
   - Click "Import Subtitles" button
   - Select .srt or .vtt file
   - File appears in media library with video name matching
   - Drag subtitle file to timeline to add

2. **Timeline Display**:
   - Subtitles appear in dedicated track
   - Shows segment count and video association
   - Right-click segments to delete
   - Subtitles display during timeline preview

3. **Export with Subtitles**:
   - Check "Include Subtitles" in export dialog
   - Creates .srt file alongside video
   - Both files saved in output folder

#### Screen Recording
1. Open Recording Panel
2. Select screen/window source
3. Select microphone (optional)
4. Click "Start Recording"
5. Recording auto-adds to timeline when stopped

#### Multi-Clip Editing
- Add multiple clips to timeline
- Clips play in sequence automatically
- Reorder by dragging clips
- Split any clip multiple times
- Trim individual clips independently

#### Keyboard Shortcuts
- **Spacebar**: Play/Pause timeline preview
- **S**: Split clip at playhead (when over active region)

### Tips & Best Practices

1. **Trimming**: Select clip first, then use handles for precise control
2. **Splitting**: Position playhead carefully before splitting
3. **Reordering**: Drag clips and drop anywhere over another clip to swap
4. **Zooming**: Use zoom to see more detail when trimming precisely
5. **Exporting**: Use "Original" resolution to maintain quality

## ⚠️ Known Limitations

### Drag-and-Drop Restriction
**You cannot drag video files directly from Finder/File Explorer into the media library.** This is due to Electron security restrictions on file system access. 

**Workaround**: Use the "Choose Video File" button to open the file picker dialog.

### Other Limitations
- Audio only exports from first clip (multi-clip audio concatenation not implemented)
- No undo/redo functionality
- No project save/load
- No transitions between clips
- No audio waveform visualization
- No subtitle editing (only import and display)

## 🐛 Troubleshooting

### App Issues

**App won't launch:**
- Verify macOS 10.14+ and Apple Silicon Mac
- Right-click app → Open (bypasses security)
- Check Console.app for error messages

**Recording doesn't work:**
- Grant Screen Recording permission: System Preferences → Security & Privacy → Screen Recording
- Grant Microphone permission: System Preferences → Security & Privacy → Microphone
- Restart app after granting permissions

**Video import fails:**
- Ensure file format is MP4, MOV, or WebM
- Check video isn't corrupted (play in QuickTime)
- Try a different video file

### Export Issues

**Export fails with FFmpeg error:**
- Check available disk space
- Ensure write permissions to destination
- Try exporting to Desktop
- Check video files aren't corrupted

**Export has no audio:**
- Currently only first clip's audio is exported
- Ensure first clip has audio track
- Check source video has audio

**Export takes a long time:**
- Large videos take time to process
- Higher resolutions take longer
- Progress bar shows current status

### Timeline Issues

**Can't split clip:**
- Ensure playhead is over clip's active (non-greyed) region
- Playhead must be within clip bounds
- Right-click the specific clip under playhead

**Clips overlap visually:**
- This shouldn't happen in v2.0+
- If it does, try restarting the app
- Report as a bug with reproduction steps

## 📝 Changelog

### v2.1.0 (November 2024) - Subtitle Support

#### 📝 Subtitle Features
- ✅ **Subtitle Import**: Import .srt and .vtt subtitle files
- ✅ **Auto-Naming**: Automatically matches subtitle files with video files by name
- ✅ **Media Library Display**: Subtitle files shown with segment count and file size
- ✅ **Timeline Integration**: Dedicated subtitle track with visual display
- ✅ **Playback Overlay**: Subtitles display during timeline preview
- ✅ **Export Support**: Optional SRT file export alongside video
- ✅ **Drag & Drop**: Drag subtitle files from library to timeline

#### 🎨 UI Improvements
- ✅ **Aligned Buttons**: Import Video and Import Subtitles buttons properly aligned
- ✅ **Track Labeling**: Subtitle track labeled as "Subtitles" matching "Main" track style
- ✅ **Visual Distinction**: Subtitle files shown with green border and document icon
- ✅ **Segment Display**: Shows number of subtitle segments in each file

#### 🔧 Technical
- ✅ **SRT Parser**: Built-in parser for SRT format subtitle files
- ✅ **VTT Support**: Compatible with WebVTT subtitle format
- ✅ **Single File Export**: All clips concatenated into one output video file
- ✅ **Subtitle Synchronization**: Subtitles properly timed with video segments

### v2.0.0 (October 2024) - Major Feature Update

#### 🎯 Timeline & Playback
- ✅ **Playhead Overlay**: Visual red line indicator showing current playback position
- ✅ **Smart Playhead**: Automatically skips trimmed regions during playback
- ✅ **Playhead-Centered Zoom**: Zoom in/out keeps playhead in same visual position
- ✅ **Multi-Clip Timeline Preview**: Seamless playback across multiple clips
- ✅ **Spacebar Control**: Press spacebar to play/pause (standard video editor behavior)

#### ✂️ Clip Editing
- ✅ **Split at Playhead**: Split clips at current playhead position
- ✅ **Recursive Splitting**: Split already-split clips (unlimited splits)
- ✅ **Split Trimmed Clips**: Fixed split functionality for trimmed clips
- ✅ **Removed Split at Center**: Simplified to playhead-only splitting
- ✅ **videoOffset Tracking**: Proper tracking of split clip positions in original video

#### 🎨 Visual Improvements
- ✅ **No Overlap**: Clips positioned using full duration prevents visual overlap
- ✅ **Trim Region Display**: Greyed-out areas show trimmed portions
- ✅ **Magnetic Snapping**: Clips snap to edges when repositioning
- ✅ **Improved Drag UX**: Better visual feedback with grab/grabbing cursors
- ✅ **Clip Scaling**: Dragged clips scale up with shadow effect

#### 🎬 Export
- ✅ **Multi-Clip Export**: Stitch multiple clips together
- ✅ **Split Clip Support**: Export works correctly with split clips
- ✅ **Resolution Scaling**: Multiple export resolutions (4K to 360p)
- ✅ **FFmpeg Filter Complex**: Proper trim/concat/scale pipeline
- ✅ **Audio Handling**: Works with videos with or without audio

#### 🧹 UI Cleanup
- ✅ **Removed Trim Controls Panel**: Redundant - use timeline handles
- ✅ **Removed Recording Refresh Button**: Simplified recording panel header
- ✅ **Cleaner Context Menu**: Only shows applicable actions

#### 🐛 Bug Fixes
- ✅ Fixed clip swap logic for bidirectional swapping
- ✅ Fixed zoom calculation for accurate playhead centering
- ✅ Fixed export FFmpeg command construction
- ✅ Fixed export for split clips (videoOffset handling)
- ✅ Fixed resolution format (WIDTHxHEIGHT)
- ✅ Fixed audio stream handling (optional audio mapping)
- ✅ Fixed filter complex conflicts (moved scale into filter)
- ✅ Fixed split detection for trimmed clips

#### 🔇 Debug Cleanup
- ✅ Removed excessive console logging for trim operations
- ✅ Removed debug logging for clip reordering
- ✅ Optimized to skip unnecessary repositioning operations

### v1.0.0 (October 2024) - Initial Production Release
- 🎬 Basic video import and preview
- 🎬 Timeline with drag-and-drop
- 🎬 Trim controls with visual feedback
- 🎬 Video export functionality
- 🎬 Screen recording capability
- 🎬 Dark theme UI

## 🛠️ Technical Stack

### Core Technologies
- **Desktop**: Electron 38+ (Cross-platform desktop framework)
- **Frontend**: React 19+ (UI library)
- **Build Tool**: Vite 5+ (Fast build system with HMR)
- **Language**: JavaScript ES6+ (No TypeScript)
- **Styling**: CSS3 (Custom properties, no preprocessor)

### Video Processing
- **Engine**: FFmpeg (via ffmpeg-static)
- **API**: fluent-ffmpeg (JavaScript wrapper)
- **Metadata**: ffprobe-static (Video information extraction)
- **Codecs**: H.264 video, AAC audio

### Key Libraries
- **State**: React hooks (useState, useEffect, useRef)
- **IPC**: Electron contextBridge (secure renderer↔main communication)
- **Recording**: MediaRecorder API + desktopCapturer
- **File System**: Node.js fs module + Electron dialog

### Build & Distribution
- **Packager**: electron-builder
- **Target**: DMG (macOS), EXE (Windows)
- **Architecture**: Universal (ARM64 primary)

## 📁 Project Structure

```
WK3_ClipForge/
├── src/
│   ├── main/
│   │   ├── main.js              # Electron main process (970 lines)
│   │   │   ├── Window lifecycle
│   │   │   ├── IPC handlers (import, export, recording)
│   │   │   ├── FFmpeg integration
│   │   │   └── File system operations
│   │   └── preload.js           # Secure IPC bridge
│   │
│   ├── renderer/
│   │   ├── App.jsx              # Main app component (690 lines)
│   │   │   ├── Clip state management
│   │   │   ├── Timeline state (tracks, playhead, zoom)
│   │   │   ├── Split/trim/reposition handlers
│   │   │   └── Clip positioning logic
│   │   │
│   │   ├── components/
│   │   │   ├── MediaLibrary.jsx         # Import & library (245 lines)
│   │   │   ├── VideoPlayer.jsx          # Single clip preview (290 lines)
│   │   │   ├── TimelinePreview.jsx      # Multi-clip playback (660 lines)
│   │   │   │   ├── Seamless clip transitions
│   │   │   │   ├── Playhead tracking
│   │   │   │   └── Keyboard controls
│   │   │   ├── HorizontalTimeline.jsx   # Timeline editor (790 lines)
│   │   │   │   ├── Visual playhead overlay
│   │   │   │   ├── Trim handles
│   │   │   │   ├── Drag/drop/reorder
│   │   │   │   ├── Zoom (playhead-centered)
│   │   │   │   └── Context menu
│   │   │   ├── RecordingPanel.jsx       # Recording UI (210 lines)
│   │   │   ├── RecordingControls.jsx    # Recording state (120 lines)
│   │   │   ├── SourceSelector.jsx       # Source selection (85 lines)
│   │   │   └── ExportButton.jsx         # Export UI (248 lines)
│   │   │
│   │   ├── main.jsx             # React entry point
│   │   └── index.html           # HTML template
│   │
│   └── styles/
│       └── app.css              # Application styles (1750+ lines)
│           ├── Dark theme variables
│           ├── Component styles
│           ├── Timeline styles
│           └── Animation keyframes
│
├── build/                       # App icons & assets
│   ├── icon.icns               # macOS icon
│   ├── icon.ico                # Windows icon
│   └── icon.png                # App icon source
│
├── test-videos/                # Test video files
│   ├── test1.mp4
│   ├── test2.mp4
│   ├── test3.mp4
│   └── simple-test.mp4
│
├── dist/                       # Vite build output
├── dist-electron/              # Electron build output
├── node_modules/               # Dependencies
│
├── package.json                # Project configuration & scripts
├── vite.config.js              # Vite build configuration
├── PERMISSIONS.md              # macOS permissions guide
└── README.md                   # This file
```

## 🧪 Testing

### Test Files
Located in `test-videos/` directory:
- `test1.mp4` - 10-second test video
- `test2.mp4` - 5-second test video
- `test3.mp4` - 15-second test video
- `simple-test.mp4` - Basic test file

### Testing Workflow

1. **Import Tests**:
   ```
   - Import single video
   - Import multiple videos
   - Import different formats (MP4, MOV, WebM)
   ```

2. **Timeline Tests**:
   ```
   - Drag clips to timeline
   - Reorder clips (forward and backward)
   - Remove clips from timeline
   - Add same clip multiple times
   ```

3. **Trim Tests**:
   ```
   - Select clip
   - Trim from start (left handle)
   - Trim from end (right handle)
   - Trim both sides
   - Verify greyed-out regions
   ```

4. **Split Tests**:
   ```
   - Position playhead over clip
   - Right-click and split
   - Split multiple times (recursive)
   - Split trimmed clips
   ```

5. **Playback Tests**:
   ```
   - Play single clip
   - Play multiple clips (verify transitions)
   - Verify playhead skips trimmed regions
   - Test spacebar control
   ```

6. **Zoom Tests**:
   ```
   - Zoom in at different playhead positions
   - Zoom out
   - Reset zoom
   - Verify playhead stays centered
   ```

7. **Export Tests**:
   ```
   - Export single clip
   - Export multiple clips
   - Export with different resolutions
   - Export trimmed clips
   - Export split clips
   ```

## 🚧 Future Enhancements

### High Priority
- Multi-clip audio concatenation (currently only first clip's audio)
- Undo/redo functionality
- Project save/load (timeline state persistence)
- Audio waveform visualization

### Medium Priority
- Transitions between clips (fade, dissolve, etc.)
- Text overlays with positioning
- More keyboard shortcuts
- Clip color adjustment
- Speed control (slow-mo, time-lapse)

### Low Priority
- Multiple audio tracks
- Video effects and filters
- Greenscreen/chroma key
- Advanced color grading
- Plugin system

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Test all features before submitting
- Update README if adding new features
- Keep commits focused and atomic

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/tornari2/gauntletai_week3_clipedit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tornari2/gauntletai_week3_clipedit/discussions)

When reporting issues, include:
- macOS version
- App version
- Steps to reproduce
- Expected vs actual behavior
- Error messages or screenshots
- Video format and size (if relevant)

## 🙏 Acknowledgments

- FFmpeg team for the incredible video processing engine
- Electron team for the desktop framework
- React team for the UI library
- All open-source contributors

---

**Built with ❤️ using Electron, React, and FFmpeg**
