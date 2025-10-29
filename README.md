# ClipForge MVP

A modern desktop video editor built with Electron, React, and FFmpeg for professional video trimming and export functionality.

## 🎬 Current Project Status

**Version**: 1.0.0  
**Status**: Production Ready ✅  
**Last Updated**: October 2024  

### ✅ Completed Features

- **Video Import**: Import MP4, MOV, and WebM video files via file picker or drag-and-drop
- **Interactive Timeline**: Visual timeline with drag-and-drop clip management
- **Advanced Trim Controls**: 
  - Click-to-select timeline clips
  - Visual trim handles (left/right)
  - Persistent trim values
  - Real-time visual feedback
- **Video Preview**: HTML5 video player with play/pause and seek controls
- **Screen Recording**: Built-in screen and webcam recording capabilities
- **Video Export**: Export trimmed videos as MP4 with H.264 video and AAC audio codecs
- **Modern UI**: Dark theme with responsive design

### 🔧 Recent Improvements (v1.0.0)

- **Fixed Trim Persistence**: Trim values now persist when clicking away and returning to clips
- **Improved Timeline UX**: Trim handles only appear when clips are selected (not on hover)
- **Visual Trim Feedback**: Left trim handle properly shrinks blue bar from left side
- **Synchronized Controls**: Trim controls and timeline are now fully synchronized
- **Export Accuracy**: Export now uses correct trimmed portions, not full videos

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ClipForge Desktop App                    │
├─────────────────────────────────────────────────────────────────┤
│  Electron Main Process (Node.js)                               │
│  ├── main.js - App lifecycle, window management                │
│  ├── preload.js - Secure IPC bridge                            │
│  └── FFmpeg Integration - Video processing                     │
├─────────────────────────────────────────────────────────────────┤
│  Renderer Process (React + Vite)                               │
│  ├── App.jsx - Main application state                          │
│  ├── Components/                                               │
│  │   ├── MediaLibrary.jsx - Video import/management            │
│  │   ├── VideoPlayer.jsx - HTML5 video preview                 │
│  │   ├── HorizontalTimeline.jsx - Timeline with trim handles   │
│  │   ├── TrimControls.jsx - Trim input controls                │
│  │   ├── RecordingPanel.jsx - Screen/webcam recording          │
│  │   └── ExportButton.jsx - Video export functionality         │
│  └── Styles/ - CSS with dark theme                             │
├─────────────────────────────────────────────────────────────────┤
│  Native Dependencies                                            │
│  ├── ffmpeg-static - Video processing engine                   │
│  ├── ffprobe-static - Video metadata extraction                │
│  └── electron-builder - App packaging                          │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 System Requirements

- **macOS**: 10.14 or later (Apple Silicon optimized)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free disk space
- **Architecture**: ARM64 (M1/M2/M3 Macs)

## 🚀 Installation

### For End Users

**Option 1: Direct Download (Recommended)**
1. Download `ClipForge-1.0.0-arm64.dmg` (205MB)
2. Double-click the DMG file to mount it
3. Drag ClipForge to your Applications folder
4. Launch ClipForge from Applications or Spotlight
5. If macOS shows security warning, go to System Preferences → Security & Privacy → Allow

**Option 2: GitHub Releases**
1. Go to [Releases](https://github.com/tornari2/gauntletai_week3_clipforge/releases)
2. Download the latest DMG file
3. Follow the same installation steps as Option 1

### For Developers

**Prerequisites:**
- Node.js 18+ 
- npm 9+
- Git

**Setup Steps:**

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tornari2/gauntletai_week3_clipforge.git
   cd gauntletai_week3_clipforge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   This installs:
   - Electron 38+ (desktop framework)
   - React 19+ (UI framework)
   - Vite (build tool)
   - FFmpeg binaries (video processing)
   - All other dependencies

3. **Run in development mode:**
   ```bash
   npm run dev
   ```
   This starts:
   - Vite dev server on `http://localhost:5173`
   - Hot reload for React components
   - Electron app with dev tools

4. **Alternative development command:**
   ```bash
   npm run electron-dev
   ```
   Runs both Vite and Electron concurrently

5. **Build for production:**
   ```bash
   npm run build
   ```
   Creates optimized build in `dist/` and `dist-electron/`

6. **Package for distribution:**
   ```bash
   npm run package:mac    # macOS DMG
   npm run package:win    # Windows EXE
   npm run package        # Current platform
   ```

## 📖 Usage Guide

### Basic Workflow

1. **Import Video**: 
   - Click "Choose Video File" button
   - Or drag video files onto the media library area
   - Supports MP4, MOV, and WebM formats

2. **Add to Timeline**:
   - Drag videos from media library to timeline
   - Videos appear as blue bars on the timeline
   - Multiple tracks available (Main, Overlay)

3. **Select and Trim**:
   - Click on a timeline clip to select it
   - Trim handles appear on selected clips
   - Drag left handle to trim from start
   - Drag right handle to trim from end
   - Or use trim controls panel for precise input

4. **Preview and Export**:
   - Use video player to preview your edits
   - Click "Export Video" when ready
   - Choose save location and format

### Advanced Features

- **Screen Recording**: Use the recording panel to capture screen or webcam
- **Timeline Management**: Right-click clips for context menu options
- **Visual Feedback**: Real-time updates as you trim videos
- **Persistent Edits**: Trim values save when switching between clips

## 🔧 Troubleshooting

### Common Issues

**App won't launch:**
- Check macOS version (10.14+ required)
- Verify it's an Apple Silicon Mac (M1/M2/M3)
- Try right-clicking app → "Open" to bypass security

**Video import fails:**
- Ensure video format is supported (MP4, MOV, WebM)
- Check file isn't corrupted
- Try with a different video file

**Export fails:**
- Ensure sufficient disk space
- Check write permissions to destination folder
- Try a different export location

**Performance issues:**
- Close other applications
- Use smaller video files for testing
- Restart the application

### Getting Help

- Check the [Issues](https://github.com/tornari2/gauntletai_week3_clipforge/issues) page
- Create a new issue with:
  - macOS version
  - App version
  - Steps to reproduce
  - Error messages (if any)

## 🛠️ Technical Stack

- **Desktop Framework**: Electron 38+ (Cross-platform desktop apps)
- **Frontend**: React 19+ with Vite (Modern UI framework)
- **Video Processing**: fluent-ffmpeg + ffmpeg-static + ffprobe-static
- **Build Tool**: electron-builder (App packaging)
- **Language**: JavaScript (ES6+)
- **Styling**: CSS3 with custom properties
- **State Management**: React hooks (useState, useEffect)
- **File Handling**: Node.js fs module with Electron APIs

## 📁 Project Structure

```
WK3_ClipForge/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── main.js             # App lifecycle, window management
│   │   └── preload.js          # Secure IPC bridge
│   ├── renderer/               # React frontend
│   │   ├── components/         # React components
│   │   │   ├── MediaLibrary.jsx      # Video import/management
│   │   │   ├── VideoPlayer.jsx       # HTML5 video preview
│   │   │   ├── HorizontalTimeline.jsx # Timeline with trim handles
│   │   │   ├── TrimControls.jsx      # Trim input controls
│   │   │   ├── RecordingPanel.jsx    # Screen/webcam recording
│   │   │   ├── RecordingControls.jsx # Recording state management
│   │   │   ├── SourceSelector.jsx    # Recording source selection
│   │   │   └── ExportButton.jsx      # Video export functionality
│   │   ├── App.jsx             # Main React component
│   │   ├── main.jsx            # React entry point
│   │   └── index.html          # HTML template
│   └── styles/
│       └── app.css             # Application styles (1450+ lines)
├── test-videos/                # Test video files
├── build/                      # App icons and assets
├── dist-electron/              # Built application
│   └── ClipForge-1.0.0-arm64.dmg  # Production DMG (205MB)
├── node_modules/               # Dependencies
├── package.json                # Project configuration
├── vite.config.js              # Vite build configuration
└── README.md                   # This file
```

## 🧪 Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite development server only |
| `npm run electron-dev` | Run both Vite and Electron in development |
| `npm run build` | Build for production (creates dist/ folder) |
| `npm run package` | Package for current platform |
| `npm run package:mac` | Create macOS DMG installer |
| `npm run package:win` | Create Windows EXE installer |

### Testing

The application includes test video files in the `test-videos/` directory:
- `test1.mp4` - 10-second test video
- `test2.mp4` - 5-second test video  
- `test3.mp4` - 15-second test video
- `simple-test.mp4` - Basic test file
- `test1_trimmed.mp4` - Pre-trimmed example

### Development Workflow

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Make changes to React components** (auto-reload enabled)

3. **Test timeline functionality:**
   - Import test videos
   - Test trim handles
   - Verify export functionality

4. **Build and test production:**
   ```bash
   npm run build
   npm run package:mac
   ```

## 📝 Changelog

### v1.0.0 (October 2024) - Production Release
- ✅ **Fixed Trim Persistence**: Trim values now persist when switching between clips
- ✅ **Improved Timeline UX**: Trim handles only appear when clips are selected
- ✅ **Visual Trim Feedback**: Left trim handle properly shrinks blue bar from left side
- ✅ **Synchronized Controls**: Trim controls and timeline fully synchronized
- ✅ **Export Accuracy**: Export uses correct trimmed portions
- ✅ **Screen Recording**: Added screen and webcam recording capabilities
- ✅ **Modern UI**: Dark theme with responsive design
- ✅ **Production Build**: Ready-to-distribute DMG package

### v0.9.0 (October 2024) - Beta Release
- 🎬 Basic video import and preview
- 🎬 Timeline with drag-and-drop
- 🎬 Trim controls with visual feedback
- 🎬 Video export functionality
- 🎬 FFmpeg integration

## Known Limitations

- Only supports MP4 and MOV video formats
- Single clip editing only (no multi-clip concatenation)
- No undo/redo functionality
- No keyboard shortcuts
- No project save/load
- No advanced timeline features

## Future Enhancements

- Screen recording capability
- Webcam recording
- Multi-clip concatenation
- Audio waveform visualization
- Transitions and effects
- Text overlays
- Undo/redo functionality
- Keyboard shortcuts
- Project save/load

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions, please create an issue on GitHub.
