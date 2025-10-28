# ClipForge MVP

A desktop video editor built with Electron, React, and FFmpeg for basic video trimming and export functionality.

## Features

- **Video Import**: Import MP4 and MOV video files via file picker or drag-and-drop
- **Timeline View**: Visual timeline showing imported clips with thumbnails and duration
- **Video Preview**: HTML5 video player with play/pause and seek controls
- **Trim Controls**: Set start and end times for video trimming
- **Video Export**: Export trimmed videos as MP4 with H.264 video and AAC audio codecs

## System Requirements

- macOS 10.14 or later
- 4GB RAM minimum
- 500MB free disk space

## Installation

### For End Users

1. Download the latest release from the [Releases](https://github.com/yourusername/clipforge/releases) page
2. Download `ClipForge-1.0.0-arm64.dmg`
3. Double-click the DMG file to mount it
4. Drag ClipForge to your Applications folder
5. Launch ClipForge from Applications

### For Developers

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/clipforge.git
   cd clipforge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run electron-dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

5. Package for macOS:
   ```bash
   npm run package:mac
   ```

## Usage

1. **Import Video**: Click "Choose Video File" or drag a video file onto the import area
2. **Select Clip**: Click on a clip in the timeline to select it
3. **Preview Video**: Use the play/pause button and seek bar to preview the video
4. **Set Trim Points**: Enter start and end times in the trim controls
5. **Export Video**: Click "Export Video" and choose a save location

## Technical Stack

- **Desktop Framework**: Electron 38+
- **Frontend**: React 19+ with Vite
- **Video Processing**: fluent-ffmpeg + ffmpeg-static + ffprobe-static
- **Build Tool**: electron-builder
- **Language**: JavaScript/TypeScript

## Project Structure

```
clipforge/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.js          # Main process entry point
│   │   └── preload.js       # Context bridge for IPC
│   ├── renderer/            # React frontend
│   │   ├── components/      # React components
│   │   ├── App.jsx          # Main React component
│   │   ├── main.jsx         # React entry point
│   │   └── index.html       # HTML template
│   └── styles/
│       └── app.css          # Application styles
├── test-videos/             # Test video files
├── build/                   # App icons and assets
└── dist-electron/           # Built application
```

## Development

### Available Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run electron-dev` - Run Electron in development mode
- `npm run package` - Package for current platform
- `npm run package:mac` - Package for macOS
- `npm run package:win` - Package for Windows

### Testing

The application includes test video files in the `test-videos/` directory:
- `test1.mp4` - 10-second test video
- `test2.mp4` - 5-second test video  
- `test3.mp4` - 15-second test video

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
