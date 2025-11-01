// Load environment variables from .env file
// Find .env file relative to the app root (works in both dev and production)
const path = require('path')
const fs = require('fs')
const envPath = path.join(__dirname, '../../.env')
require('dotenv').config({ path: envPath })

console.log('Main: Loading .env from:', envPath)
console.log('Main: .env file exists:', fs.existsSync(envPath))
if (process.env.OPENAI_API_KEY) {
  console.log('Main: OPENAI_API_KEY loaded successfully (length:', process.env.OPENAI_API_KEY.length, ')')
} else {
  console.warn('Main: OPENAI_API_KEY not found in environment')
}

const { app, BrowserWindow, ipcMain, dialog, protocol, desktopCapturer } = require('electron')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static')
const ffprobePath = require('ffprobe-static').path
const OpenAI = require('openai')
const os = require('os')

// Safe logging helper to avoid EPIPE errors
function safeLog(...args) {
  try {
    console.log(...args)
  } catch (e) {
    // Ignore EPIPE errors
  }
}

// Configure FFmpeg paths with production fallback
function setupFFmpegPaths() {
  let ffmpegExecutable = ffmpegPath
  let ffprobeExecutable = ffprobePath
  
  // In production, the executables might be in a different location
  if (app && app.isPackaged) {
    safeLog('Setting up FFmpeg paths for production build')
    
    // Try to find FFmpeg in the packaged app (prioritize unpacked versions)
    const possibleFFmpegPaths = [
      path.join(process.resourcesPath, 'app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg'),
      path.join(process.resourcesPath, 'ffmpeg'),
      path.join(__dirname, '../../node_modules/ffmpeg-static/ffmpeg'),
      path.join(process.resourcesPath, 'node_modules/ffmpeg-static/ffmpeg'),
      ffmpegPath
    ]
    
    const possibleFFprobePaths = [
      path.join(process.resourcesPath, 'app.asar.unpacked/node_modules/ffprobe-static/bin/darwin/arm64/ffprobe'),
      path.join(process.resourcesPath, 'app.asar.unpacked/node_modules/ffprobe-static/ffprobe'),
      path.join(process.resourcesPath, 'ffprobe'),
      path.join(__dirname, '../../node_modules/ffprobe-static/ffprobe'),
      path.join(process.resourcesPath, 'node_modules/ffprobe-static/ffprobe'),
      ffprobePath
    ]
    
    // Find the first existing FFmpeg path
    for (const possiblePath of possibleFFmpegPaths) {
      if (require('fs').existsSync(possiblePath)) {
        ffmpegExecutable = possiblePath
        console.log('Found FFmpeg at:', ffmpegExecutable)
        break
      }
    }
    
    // Find the first existing FFprobe path
    for (const possiblePath of possibleFFprobePaths) {
      if (require('fs').existsSync(possiblePath)) {
        ffprobeExecutable = possiblePath
        console.log('Found FFprobe at:', ffprobeExecutable)
        break
      }
    }
  }
  
  console.log('Setting FFmpeg path to:', ffmpegExecutable)
  console.log('Setting FFprobe path to:', ffprobeExecutable)
  
  ffmpeg.setFfmpegPath(ffmpegExecutable)
  ffmpeg.setFfprobePath(ffprobeExecutable)
}

// We'll use the custom protocol instead of HTTP server

// Register custom protocol for local files
app.whenReady().then(() => {
  // Configure FFmpeg paths after app is ready
  setupFFmpegPaths()
  
  protocol.registerFileProtocol('local', (request, callback) => {
    let filePath = request.url.substr(7) // Remove 'local://' prefix
    
    // Handle double slashes
    if (filePath.startsWith('//')) {
      filePath = filePath.substring(1)
    }
    
    // Decode URI if needed
    try {
      filePath = decodeURIComponent(filePath)
    } catch (e) {
      // If decoding fails, use the original path
      console.log('Protocol handler: Could not decode URI, using original path')
    }
    
    console.log('Protocol handler: Serving file:', filePath)
    console.log('Protocol handler: File exists:', require('fs').existsSync(filePath))
    
    callback({ path: filePath })
  })
})

let mainWindow

// Helper function to handle dropped files
async function handleDroppedFile(filePath) {
  try {
    console.log('Main: Processing dropped file:', filePath)
    
    if (!require('fs').existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`)
    }
    
    // Get file name from path
    const fileName = path.basename(filePath)
    
    // Get comprehensive metadata
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('Main: FFprobe error for dropped file:', err)
          reject(err)
        } else {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video')
          const fileStats = require('fs').statSync(filePath)
          
          const metadata_result = {
            duration: metadata.format.duration,
            width: videoStream ? videoStream.width : 0,
            height: videoStream ? videoStream.height : 0,
            fileSize: fileStats.size,
            codec: videoStream ? videoStream.codec_name : 'unknown',
            bitrate: metadata.format.bit_rate ? parseInt(metadata.format.bit_rate) : 0
          }
          
          console.log('Main: Dropped file metadata:', metadata_result)
          resolve(metadata_result)
        }
      })
    })
    
    // Generate thumbnail
    const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg')
    console.log('Main: Generating thumbnail for dropped file at:', thumbnailPath)
    const generatedThumbnail = await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .screenshots({
          timestamps: ['10%'],
          filename: path.basename(thumbnailPath),
          folder: path.dirname(thumbnailPath),
          size: '320x180'
        })
        .on('end', () => resolve(thumbnailPath))
        .on('error', (err) => {
          console.error('Main: Thumbnail generation error for dropped file:', err)
          reject(err)
        })
    })
    
    // Send the video data to the renderer process
    mainWindow.webContents.send('video-dropped', {
      filePath,
      fileName,
      duration: Math.round(metadata.duration),
      width: metadata.width,
      height: metadata.height,
      fileSize: metadata.fileSize,
      codec: metadata.codec,
      bitrate: metadata.bitrate,
      thumbnailPath: generatedThumbnail
    })
    
    console.log('Main: Successfully processed dropped file:', fileName)
  } catch (error) {
    console.error('Error handling dropped file:', error)
    // Send error to renderer
    mainWindow.webContents.send('video-drop-error', error.message)
  }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false, // Required for file.path access
        allowRunningInsecureContent: true // Additional security relaxation for file access
      },
    show: false,
    frame: true,
    resizable: true,
    movable: true
  })

  // Drag and drop is disabled for security and reliability
  // Users should use the Import button instead
  mainWindow.on('focus', () => {
    mainWindow.webContents.send('window-focused')
  })

  // Provide visual feedback for drag & drop but don't process files
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(`
      // Provide visual feedback for drag & drop
      document.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        const mediaLibrary = e.target.closest('.timeline')
        if (mediaLibrary) {
          e.dataTransfer.dropEffect = 'copy'
          mediaLibrary.classList.add('drag-over')
        }
      })

      document.addEventListener('dragleave', (e) => {
        const mediaLibrary = e.target.closest('.timeline')
        if (mediaLibrary) {
          if (!e.relatedTarget || !mediaLibrary.contains(e.relatedTarget)) {
            mediaLibrary.classList.remove('drag-over')
          }
        }
      })

      document.addEventListener('drop', (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        const mediaLibrary = e.target.closest('.timeline')
        if (mediaLibrary) {
          mediaLibrary.classList.remove('drag-over')
        }
      })
    `)
  })

  // Load the app
  // Check if we're in development mode
  // In dev mode, process.versions.electron is present but we should check for Vite dev server
  const isDev = !app.isPackaged
  
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173')
    console.log('Loading from Vite dev server at http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// App event handlers
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC Handlers

// Import video file
ipcMain.handle('import-video', async (event) => {
  try {
    console.log('Main: import-video IPC called')
    console.log('Main: mainWindow exists?', !!mainWindow)
    console.log('Main: mainWindow id?', mainWindow?.id)
    console.log('Main: event.sender id?', event.sender?.id)
    
    // Try multiple ways to get the window
    let window = mainWindow
    if (!window) {
      window = BrowserWindow.getFocusedWindow()
    }
    if (!window) {
      window = BrowserWindow.fromWebContents(event.sender)
    }
    
    console.log('Main: Using window:', window?.id)
    
    if (!window) {
      console.error('Main: No window available for dialog')
      throw new Error('No window available')
    }
    
    console.log('Main: Showing open dialog...')
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [
        { name: 'Videos', extensions: ['mp4', 'mov', 'webm'] }
      ]
    })
    
    console.log('Main: Dialog result:', result)
    console.log('Main: Dialog canceled?', result.canceled)
    console.log('Main: File paths count:', result.filePaths?.length)
    
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      console.log('Main: Returning file path:', filePath)
      console.log('Main: File exists?', require('fs').existsSync(filePath))
      return filePath
    }
    console.log('Main: No file selected')
    return null
  } catch (error) {
    console.error('Error importing video:', error)
    console.error('Error stack:', error.stack)
    throw error
  }
})

// Removed process-dropped-file handler - drag & drop is disabled

// Import subtitle file
ipcMain.handle('import-subtitle', async (event) => {
  try {
    console.log('Main: import-subtitle IPC called')
    
    const window = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.fromWebContents(event.sender)
    
    if (!window) {
      throw new Error('No window available')
    }
    
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [
        { name: 'Subtitle Files', extensions: ['srt', 'vtt'] }
      ]
    })
    
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      console.log('Main: Subtitle file selected:', filePath)
      
      // Read and parse the subtitle file
      const fs = require('fs')
      const content = fs.readFileSync(filePath, 'utf8')
      const fileName = path.basename(filePath)
      
      // Parse SRT format
      const subtitles = parseSRT(content)
      
      return {
        filePath,
        fileName,
        subtitles,
        fileSize: fs.statSync(filePath).size
      }
    }
    
    return null
  } catch (error) {
    console.error('Error importing subtitle:', error)
    throw error
  }
})

// Helper function to parse SRT format
function parseSRT(content) {
  const subtitles = []
  const blocks = content.trim().split(/\n\s*\n/)
  
  blocks.forEach((block, index) => {
    const lines = block.trim().split('\n')
    if (lines.length < 3) return
    
    // Parse sequence number (first line)
    const sequence = parseInt(lines[0])
    if (isNaN(sequence)) return
    
    // Parse timecode (second line) - format: HH:MM:SS,mmm --> HH:MM:SS,mmm
    const timecodeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
    if (!timecodeMatch) return
    
    const startHours = parseInt(timecodeMatch[1])
    const startMinutes = parseInt(timecodeMatch[2])
    const startSeconds = parseInt(timecodeMatch[3])
    const startMilliseconds = parseInt(timecodeMatch[4])
    const startTime = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000
    
    const endHours = parseInt(timecodeMatch[5])
    const endMinutes = parseInt(timecodeMatch[6])
    const endSeconds = parseInt(timecodeMatch[7])
    const endMilliseconds = parseInt(timecodeMatch[8])
    const endTime = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000
    
    // Get subtitle text (remaining lines)
    const text = lines.slice(2).join(' ').trim()
    
    if (text) {
      subtitles.push({
        id: `subtitle_imported_${Date.now()}_${index}`,
        startTime,
        endTime,
        text
      })
    }
  })
  
  return subtitles
}

// Get video duration
ipcMain.handle('get-video-duration', async (event, filePath) => {
  try {
    console.log('Main: get-video-duration called for:', filePath)
    console.log('Main: filePath type:', typeof filePath)
    console.log('Main: filePath is undefined?', filePath === undefined)
    
    if (!filePath) {
      throw new Error('No file path provided')
    }
    
    if (!require('fs').existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`)
    }
    
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('Main: FFprobe error:', err)
          reject(err)
        } else {
          console.log('Main: Video duration:', metadata.format.duration)
          resolve(metadata.format.duration)
        }
      })
    })
  } catch (error) {
    console.error('Error getting video duration:', error)
    throw error
  }
})

// Get video metadata (duration, resolution, file size)
ipcMain.handle('get-video-metadata', async (event, filePath, fallbackDuration = null) => {
  try {
    console.log('Main: get-video-metadata called for:', filePath)
    console.log('Main: fallbackDuration provided:', fallbackDuration)
    
    if (!filePath) {
      throw new Error('No file path provided')
    }
    
    if (!require('fs').existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`)
    }
    
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('Main: FFprobe error:', err)
          
          // If FFprobe fails and we have a fallback duration, use it
          if (fallbackDuration && fallbackDuration > 0) {
            console.log('Main: Using fallback duration due to FFprobe error:', fallbackDuration)
            const fileStats = require('fs').statSync(filePath)
            resolve({
              duration: fallbackDuration,
              width: 1920, // Default width
              height: 1080, // Default height
              fileSize: fileStats.size,
              codec: 'webm',
              bitrate: 0
            })
            return
          }
          
          reject(err)
        } else {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video')
          const fileStats = require('fs').statSync(filePath)
          
          // Handle WebM files that might have duration issues
          let duration = metadata.format.duration
          console.log('Main: Raw duration from format:', duration)
          console.log('Main: Video stream duration:', videoStream ? videoStream.duration : 'N/A')
          
          if (!duration || duration === 'N/A' || isNaN(duration) || duration <= 0) {
            // For WebM files, try to get duration from video stream
            if (videoStream && videoStream.duration && !isNaN(parseFloat(videoStream.duration))) {
              duration = parseFloat(videoStream.duration)
              console.log('Main: Using video stream duration:', duration)
            } else {
              // Try to calculate duration from bitrate and file size
              const fileSize = fileStats.size
              const bitrate = metadata.format.bit_rate ? parseInt(metadata.format.bit_rate) : 0
              if (bitrate > 0 && fileSize > 0) {
                duration = fileSize / (bitrate / 8) // Convert bitrate to bytes per second
                console.log('Main: Calculated duration from bitrate:', duration)
              } else {
                // Use fallback duration if provided (from recording time)
                duration = fallbackDuration || 0
                console.log('Main: Using fallback duration:', duration)
              }
            }
          } else {
            duration = parseFloat(duration)
            console.log('Main: Using format duration:', duration)
          }
          
          // Handle bitrate for WebM files
          let bitrate = 0
          if (metadata.format.bit_rate && !isNaN(parseInt(metadata.format.bit_rate))) {
            bitrate = parseInt(metadata.format.bit_rate)
          } else if (videoStream && videoStream.bit_rate && !isNaN(parseInt(videoStream.bit_rate))) {
            bitrate = parseInt(videoStream.bit_rate)
          }
          
          const metadata_result = {
            duration: duration,
            width: videoStream ? videoStream.width : 0,
            height: videoStream ? videoStream.height : 0,
            fileSize: fileStats.size,
            codec: videoStream ? videoStream.codec_name : 'unknown',
            bitrate: bitrate
          }
          
          console.log('Main: Video metadata:', metadata_result)
          resolve(metadata_result)
        }
      })
    })
  } catch (error) {
    console.error('Error getting video metadata:', error)
    throw error
  }
})

// Create a placeholder thumbnail when FFmpeg fails
const createPlaceholderThumbnail = (outputPath, resolve, reject) => {
  try {
    console.log('Main: Creating placeholder thumbnail for corrupted video')
    const fs = require('fs')
    const path = require('path')
    
    // Create a simple placeholder image (1x1 pixel PNG)
    const placeholderData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type, etc.
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, // compressed data
      0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // more data
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
      0xAE, 0x42, 0x60, 0x82
    ])
    
    fs.writeFileSync(outputPath, placeholderData)
    console.log('Main: Placeholder thumbnail created successfully')
    resolve(outputPath)
  } catch (error) {
    console.error('Main: Error creating placeholder thumbnail:', error)
    reject(error)
  }
}

// Generate video thumbnail
ipcMain.handle('generate-thumbnail', async (event, filePath, outputPath) => {
  try {
    console.log('Main: generate-thumbnail called for:', filePath)
    console.log('Main: Output path:', outputPath)
    
    if (!filePath) {
      throw new Error('No file path provided')
    }
    
    if (!require('fs').existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`)
    }
    
    return new Promise((resolve, reject) => {
      // Try multiple approaches for thumbnail generation
      const tryThumbnailGeneration = (attempt = 1) => {
        console.log(`Main: Thumbnail generation attempt ${attempt}`)
        
        // First try to get duration to determine if we can use percentage
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err || !metadata.format.duration || metadata.format.duration === 'N/A') {
            // If we can't get duration, use a fixed timestamp (1 second)
            console.log('Main: Using fixed timestamp for thumbnail (1 second)')
            ffmpeg(filePath)
              .screenshots({
                timestamps: ['00:00:01'], // Take thumbnail at 1 second
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '320x180'
              })
              .on('end', () => {
                console.log('Main: Thumbnail generated successfully (fixed timestamp)')
                resolve(outputPath)
              })
              .on('error', (err) => {
                console.error('Main: Thumbnail generation error (fixed timestamp):', err)
                if (attempt < 3) {
                  console.log('Main: Retrying thumbnail generation...')
                  setTimeout(() => tryThumbnailGeneration(attempt + 1), 1000)
                } else {
                  // Create a placeholder thumbnail
                  createPlaceholderThumbnail(outputPath, resolve, reject)
                }
              })
          } else {
            // Use percentage if we have duration
            console.log('Main: Using percentage timestamp for thumbnail (10%)')
            ffmpeg(filePath)
              .screenshots({
                timestamps: ['10%'],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: '320x180'
              })
              .on('end', () => {
                console.log('Main: Thumbnail generated successfully (percentage)')
                resolve(outputPath)
              })
              .on('error', (err) => {
                console.error('Main: Thumbnail generation error (percentage):', err)
                if (attempt < 3) {
                  console.log('Main: Retrying thumbnail generation...')
                  setTimeout(() => tryThumbnailGeneration(attempt + 1), 1000)
                } else {
                  // Create a placeholder thumbnail
                  createPlaceholderThumbnail(outputPath, resolve, reject)
                }
              })
          }
        })
      }
      
      // Start the first attempt
      tryThumbnailGeneration()
    })
  } catch (error) {
    console.error('Error generating thumbnail:', error)
    throw error
  }
})

// Handle drag and drop file import



// Save dialog
ipcMain.handle('save-dialog', async () => {
  try {
    const window = mainWindow || BrowserWindow.getFocusedWindow()
    
    if (!window) {
      console.error('Main: No window available for save dialog')
      throw new Error('No window available')
    }
    
    const result = await dialog.showSaveDialog(window, {
      defaultPath: 'trimmed_video.mp4',
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] }
      ]
    })
    
    if (!result.canceled) {
      return result.filePath
    }
    return null
  } catch (error) {
    console.error('Error opening save dialog:', error)
    throw error
  }
})

// Export video
ipcMain.handle('export-video', async (event, options) => {
  const { inputPath, outputPath, startTime, duration, resolution = 'original' } = options
  
  try {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
      
      // Apply resolution scaling and bitrate if not original
      if (resolution !== 'original') {
        const resolutionMap = {
          '4K': { size: '3840:2160', bitrate: '15000k' },
          '1080p': { size: '1920:1080', bitrate: '5000k' },
          '720p': { size: '1280:720', bitrate: '2500k' },
          '480p': { size: '854:480', bitrate: '1000k' },
          '360p': { size: '640:360', bitrate: '500k' }
        }
        
        if (resolutionMap[resolution]) {
          command = command
            .size(resolutionMap[resolution].size)
            .videoBitrate(resolutionMap[resolution].bitrate)
          console.log(`Main: Scaling video to ${resolution} (${resolutionMap[resolution].size}) with bitrate ${resolutionMap[resolution].bitrate}`)
        }
      }
      
      command
        .on('progress', (progress) => {
          // Send progress updates to renderer
          mainWindow.webContents.send('export-progress', {
            percent: Math.round(progress.percent || 0)
          })
        })
        .on('end', () => {
          mainWindow.webContents.send('export-complete')
          resolve({ success: true })
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err)
          mainWindow.webContents.send('export-error', err.message)
          reject(err)
        })
        .run()
    })
  } catch (error) {
    console.error('Error exporting video:', error)
    throw error
  }
})

// Export timeline (multiple clips stitched together)
ipcMain.handle('export-timeline', async (event, options) => {
  const { clips, outputPath, resolution = 'original' } = options
  
  try {
    console.log('Main: Exporting timeline with', clips.length, 'clips')
    console.log('Main: Clips:', clips.map(c => ({ file: c.filePath, start: c.startTime, duration: c.duration })))
    
    // Validate inputs
    if (!clips || clips.length === 0) {
      throw new Error('No clips provided for export')
    }
    
    if (!outputPath) {
      throw new Error('No output path provided')
    }
    
    const fs = require('fs')
    
    // Validate all input files exist and have valid parameters
    const clipMetadata = []
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      
      if (!clip.filePath) {
        throw new Error(`Clip ${i + 1} is missing file path`)
      }
      
      // Normalize file path - remove any protocol prefixes (local://, file://, etc.)
      let normalizedPath = clip.filePath
      if (normalizedPath.startsWith('local://')) {
        normalizedPath = normalizedPath.replace('local://', '')
      }
      if (normalizedPath.startsWith('file://')) {
        normalizedPath = normalizedPath.replace('file://', '')
      }
      // Remove leading slash if present after protocol removal
      if (normalizedPath.startsWith('/') && !normalizedPath.startsWith('//')) {
        // Keep the leading slash for absolute paths
      }
      
      if (!fs.existsSync(normalizedPath)) {
        throw new Error(`Clip ${i + 1} file does not exist: ${normalizedPath}`)
      }
      
      if (typeof clip.startTime !== 'number' || isNaN(clip.startTime) || clip.startTime < 0) {
        throw new Error(`Clip ${i + 1} has invalid startTime: ${clip.startTime}`)
      }
      
      if (typeof clip.duration !== 'number' || isNaN(clip.duration) || clip.duration <= 0) {
        throw new Error(`Clip ${i + 1} has invalid duration: ${clip.duration}`)
      }
      
      // Check if clip has audio track and get file duration and stream indices
      const probeResult = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(normalizedPath, (err, metadata) => {
          if (err) {
            console.warn(`Main: Error probing clip ${i + 1}:`, err.message)
            resolve({ hasAudio: false, duration: null, videoStreamIndex: 0, audioStreamIndex: 1 })
          } else {
            const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio')
            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video')
            const duration = metadata.format?.duration || videoStream?.duration || null
            
            // Get actual stream indices
            const videoStreamIndex = metadata.streams.findIndex(stream => stream.codec_type === 'video')
            const audioStreamIndex = metadata.streams.findIndex(stream => stream.codec_type === 'audio')
            
            resolve({ 
              hasAudio: !!audioStream, 
              duration: duration,
              videoStreamIndex: videoStreamIndex >= 0 ? videoStreamIndex : 0,
              audioStreamIndex: audioStreamIndex >= 0 ? audioStreamIndex : 1
            })
          }
        })
      })
      
      const hasAudio = probeResult.hasAudio
      const fileDuration = probeResult.duration
      const videoStreamIndex = probeResult.videoStreamIndex
      const audioStreamIndex = probeResult.audioStreamIndex
      
      // Validate that startTime + duration doesn't exceed file duration
      if (fileDuration !== null && (clip.startTime + clip.duration > fileDuration + 0.5)) {
        console.warn(`Main: Clip ${i + 1} trim exceeds file duration. File: ${fileDuration}s, Requested: ${clip.startTime + clip.duration}s`)
        // Adjust duration to fit within file
        const adjustedDuration = Math.max(0, fileDuration - clip.startTime)
        if (adjustedDuration <= 0) {
          throw new Error(`Clip ${i + 1} startTime (${clip.startTime}s) exceeds file duration (${fileDuration}s)`)
        }
        console.log(`Main: Adjusting clip ${i + 1} duration from ${clip.duration}s to ${adjustedDuration}s`)
        clip.duration = adjustedDuration
      }
      
      clipMetadata.push({ ...clip, filePath: normalizedPath, hasAudio, videoStreamIndex, audioStreamIndex })
      console.log(`Main: Clip ${i + 1} (${path.basename(normalizedPath)}) has audio:`, hasAudio, 'duration:', fileDuration, 'videoStream:', videoStreamIndex, 'audioStream:', audioStreamIndex)
    }
    
    // Validate that we have clips to export
    if (clipMetadata.length === 0) {
      throw new Error('No valid clips found for export')
    }
    
    console.log(`Main: Preparing to export ${clipMetadata.length} clips`)
    clipMetadata.forEach((clip, idx) => {
      console.log(`Main: Clip ${idx + 1}:`, {
        filePath: clip.filePath,
        exists: fs.existsSync(clip.filePath),
        startTime: clip.startTime,
        duration: clip.duration,
        hasAudio: clip.hasAudio
      })
    })
    
    // Use simpler two-pass approach: extract each segment, then concat into a SINGLE file
    // All segments are concatenated into one output video file (not separate files)
    const os = require('os')
    const tempDir = os.tmpdir()
    const tempFiles = []
    const concatListPath = path.join(tempDir, `clipforge_concat_${Date.now()}.txt`)
    
    try {
      // Step 1: Extract each clip segment to a temporary file
      console.log('Main: Step 1 - Extracting clip segments...')
      
      for (let i = 0; i < clipMetadata.length; i++) {
        const clip = clipMetadata[i]
        const tempFile = path.join(tempDir, `clipforge_segment_${Date.now()}_${i}.mp4`)
        tempFiles.push(tempFile)
        
        console.log(`Main: Extracting clip ${i + 1} to ${tempFile}`)
        
        await new Promise((resolveExtract, rejectExtract) => {
          ffmpeg(clip.filePath)
            .setStartTime(clip.startTime)
            .setDuration(clip.duration)
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
              '-preset', 'fast',
              '-crf', '23',
              '-pix_fmt', 'yuv420p',
              '-ar', '48000',  // 48kHz audio
              '-ac', '2'       // Stereo audio
            ])
            .output(tempFile)
            .on('start', (cmd) => console.log(`Main: FFmpeg extract cmd: ${cmd}`))
            .on('progress', (progress) => {
              const percent = Math.round((i / clipMetadata.length + (progress.percent || 0) / 100 / clipMetadata.length) * 50)
              mainWindow.webContents.send('export-progress', { percent })
            })
            .on('end', () => {
              console.log(`Main: Clip ${i + 1} extracted successfully`)
              resolveExtract()
            })
            .on('error', (err) => {
              console.error(`Main: Error extracting clip ${i + 1}:`, err.message)
              rejectExtract(err)
            })
            .run()
        })
      }
      
      // Step 2: Concatenate all temp files
      console.log('Main: Step 2 - Concatenating segments...')
      const concatList = tempFiles.map(f => `file '${f}'`).join('\n')
      fs.writeFileSync(concatListPath, concatList)
      console.log(`Main: Concat list:\n${concatList}`)
      
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .videoCodec('copy')
          .audioCodec('copy')
          .output(outputPath)
          .on('start', (cmd) => console.log(`Main: FFmpeg concat cmd: ${cmd}`))
          .on('progress', (progress) => {
            const percent = Math.round(50 + (progress.percent || 0) / 2)
            mainWindow.webContents.send('export-progress', { percent })
          })
          .on('end', () => {
            console.log('Main: Timeline export completed successfully')
            mainWindow.webContents.send('export-complete')
            resolve({ success: true })
          })
          .on('error', (err) => {
            console.error('Main: FFmpeg concat error:', err)
            mainWindow.webContents.send('export-error', err.message)
            reject(err)
          })
          .run()
      })
      
      // Cleanup temp files
      console.log('Main: Cleaning up temp files...')
      tempFiles.forEach(f => {
        try { fs.unlinkSync(f) } catch (e) {}
      })
      try { fs.unlinkSync(concatListPath) } catch (e) {}
      
    } catch (error) {
      // Cleanup on error
      tempFiles.forEach(f => {
        try { fs.unlinkSync(f) } catch (e) {}
      })
      try { fs.unlinkSync(concatListPath) } catch (e) {}
      throw error
    }
  } catch (error) {
    console.error('Error exporting timeline:', error)
    throw error
  }
})

// Recording IPC Handlers

// List available video sources (screens/windows)
ipcMain.handle('list-video-sources', async () => {
  try {
    safeLog('Main: Listing video sources...')
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window']
    })
    
    safeLog('Main: Found sources:', sources.length)
    
    // Handle case where no sources are available (permission denied)
    if (sources.length === 0) {
      throw new Error('No screen recording sources available. Please grant screen recording permission in System Preferences > Security & Privacy > Screen Recording.')
    }
    
    // Filter out the app's own window to prevent self-recording issues
    const filteredSources = sources.filter(source => {
      // Exclude windows that contain "ClipEdit" or "Electron" in the name
      const name = source.name.toLowerCase()
      return !name.includes('clipedit') && 
             !name.includes('electron') && 
             !name.includes('cursor') &&
             !name.includes('vite')
    })
    
    safeLog('Main: Filtered sources:', filteredSources.length)
    
    return filteredSources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      type: source.id.startsWith('screen:') ? 'screen' : 'window'
    }))
  } catch (error) {
    // Use a safer logging method to avoid EPIPE errors
    try {
      console.error('Error listing video sources:', error)
    } catch (logError) {
      // If console.error fails (EPIPE), just continue
    }
    
    // Check if it's a permission error
    if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
      throw new Error('Screen recording permission denied. Please grant permission in System Preferences > Security & Privacy > Screen Recording.')
    }
    
    throw error
  }
})

// List available audio sources (microphones)
ipcMain.handle('list-audio-sources', async () => {
  try {
    safeLog('Main: Listing audio sources...')
    // Note: In Electron, we can't directly list audio sources like we do for video
    // The renderer process will use navigator.mediaDevices.enumerateDevices() instead
    // This handler is here for consistency but will return empty array
    return []
  } catch (error) {
    console.error('Error listing audio sources:', error)
    throw error
  }
})

// Start screen recording
ipcMain.handle('start-screen-recording', async (event, sourceId) => {
  try {
    console.log('Main: Starting screen recording for source:', sourceId)
    
    // Get the source details
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window']
    })
    
    const source = sources.find(s => s.id === sourceId)
    if (!source) {
      throw new Error('Source not found')
    }
    
    // Send source info to renderer for getUserMedia
    mainWindow.webContents.send('screen-recording-source', {
      sourceId: source.id,
      sourceName: source.name
    })
    
    return { success: true, sourceId: source.id }
  } catch (error) {
    console.error('Error starting screen recording:', error)
    throw error
  }
})

// Start webcam recording
ipcMain.handle('start-webcam-recording', async (event, deviceId) => {
  try {
    console.log('Main: Starting webcam recording for device:', deviceId)
    
    // Send device info to renderer for getUserMedia
    mainWindow.webContents.send('webcam-recording-device', {
      deviceId: deviceId
    })
    
    return { success: true, deviceId: deviceId }
  } catch (error) {
    console.error('Error starting webcam recording:', error)
    throw error
  }
})

// Start PiP recording (screen + webcam)
ipcMain.handle('start-pip-recording', async (event, sourceId, deviceId) => {
  try {
    console.log('Main: Starting PiP recording - screen:', sourceId, 'webcam:', deviceId)
    
    // Get the screen source details
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window']
    })
    
    const source = sources.find(s => s.id === sourceId)
    if (!source) {
      throw new Error('Screen source not found')
    }
    
    // Send both source info to renderer
    mainWindow.webContents.send('pip-recording-sources', {
      screenSourceId: source.id,
      screenSourceName: source.name,
      webcamDeviceId: deviceId
    })
    
    return { success: true, screenSourceId: source.id, webcamDeviceId: deviceId }
  } catch (error) {
    console.error('Error starting PiP recording:', error)
    throw error
  }
})

// Stop recording and save file
ipcMain.handle('stop-recording', async (event, recordingData) => {
  try {
    console.log('Main: Stopping recording, data:', recordingData)
    
    // The actual recording stop and file save is handled in the renderer
    // This handler just acknowledges the stop request
    return { success: true }
  } catch (error) {
    console.error('Error stopping recording:', error)
    throw error
  }
})

// Window management for recording
ipcMain.handle('minimize-window', async () => {
  try {
    if (mainWindow) {
      mainWindow.minimize()
      console.log('Main: Window minimized for recording')
    }
    return { success: true }
  } catch (error) {
    console.error('Error minimizing window:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('restore-window', async () => {
  try {
    if (mainWindow) {
      mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      console.log('Main: Window restored after recording')
    }
    return { success: true }
  } catch (error) {
    console.error('Error restoring window:', error)
    return { success: false, error: error.message }
  }
})

// Save recording file
ipcMain.handle('save-recording-file', async (event, arrayBuffer, fileName) => {
  try {
    console.log('Main: Saving recording file:', fileName)
    
    // Create file path in Downloads folder
    const downloadsPath = path.join(os.homedir(), 'Downloads')
    const filePath = path.join(downloadsPath, fileName)
    
    // Ensure Downloads directory exists
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true })
    }
    
    // Convert ArrayBuffer to Buffer and write file
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, buffer)
    
    console.log('Main: Recording saved to:', filePath)
    
    return {
      success: true,
      filePath: filePath,
      fileName: fileName
    }
  } catch (error) {
    console.error('Error saving recording file:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// OpenAI API Key Management - Load from environment variable
const getOpenAIApiKey = () => {
  // First try environment variable
  if (process.env.OPENAI_API_KEY) {
    console.log('Main: OpenAI API key loaded from environment variable')
    return process.env.OPENAI_API_KEY
  }
  console.warn('Main: OpenAI API key not found in environment variable')
  return null
}

ipcMain.handle('get-openai-api-key', async () => {
  return getOpenAIApiKey()
})

ipcMain.handle('set-openai-api-key', async (event, apiKey) => {
  // Still allow runtime setting but prefer env variable
  // Environment variable takes precedence
  return { success: true }
})

// Transcribe audio using OpenAI Whisper API
ipcMain.handle('transcribe-audio', async (event, { clips }) => {
  try {
    console.log('Main: Starting transcription for clips:', clips.length)
    
    const apiKey = getOpenAIApiKey()
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set OPENAI_API_KEY in your .env file.')
    }
    
    const openai = new OpenAI({ apiKey: apiKey })
    const tempDir = os.tmpdir()
    const tempAudioPath = path.join(tempDir, `clipforge_transcribe_${Date.now()}.wav`)
    const tempVideoPath = path.join(tempDir, `clipforge_video_${Date.now()}.mp4`)
    
    try {
      // Step 1: Create a temporary video with all clips concatenated
      console.log('Main: Step 1 - Creating temporary video for transcription...')
      const tempClipFiles = []
      const concatListPath = path.join(tempDir, `clipforge_transcribe_concat_${Date.now()}.txt`)
      
      // Extract each clip segment to a temporary file
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        const tempFile = path.join(tempDir, `clipforge_transcribe_segment_${Date.now()}_${i}.mp4`)
        tempClipFiles.push(tempFile)
        
        console.log(`Main: Extracting clip ${i + 1} to ${tempFile}`)
        
        await new Promise((resolve, reject) => {
          ffmpeg(clip.filePath)
            .setStartTime(clip.startTime)
            .setDuration(clip.duration)
            .videoCodec('copy')
            .audioCodec('copy')
            .output(tempFile)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run()
        })
        
        // Send progress update
        const progress = Math.round((i / clips.length) * 30)
        mainWindow.webContents.send('transcription-progress', { percent: progress, status: 'Preparing audio...' })
      }
      
      // Concatenate all temp files
      const concatList = tempClipFiles.map(f => `file '${f}'`).join('\n')
      fs.writeFileSync(concatListPath, concatList)
      
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .videoCodec('copy')
          .audioCodec('copy')
          .output(tempVideoPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })
      
      // Cleanup temp clip files
      tempClipFiles.forEach(f => {
        try { fs.unlinkSync(f) } catch (e) {}
      })
      try { fs.unlinkSync(concatListPath) } catch (e) {}
      
      mainWindow.webContents.send('transcription-progress', { percent: 40, status: 'Extracting audio...' })
      
      // Step 2: Extract audio as WAV
      console.log('Main: Step 2 - Extracting audio to WAV...')
      await new Promise((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .audioCodec('pcm_s16le')
          .audioFrequency(16000)
          .audioChannels(1)
          .outputOptions(['-ar', '16000'])
          .output(tempAudioPath)
          .on('end', () => {
            console.log('Main: Audio extraction complete')
            resolve()
          })
          .on('error', (err) => {
            console.error('Main: Audio extraction error:', err)
            reject(err)
          })
          .run()
      })
      
      // Check if audio file was created and is not empty
      const audioStats = fs.statSync(tempAudioPath)
      console.log('Main: Audio file size:', audioStats.size, 'bytes')
      
      if (audioStats.size === 0) {
        throw new Error('Extracted audio file is empty. The video may not contain audio.')
      }
      
      // Check if file is too large (Whisper API has 25MB limit)
      const maxSize = 25 * 1024 * 1024 // 25MB
      if (audioStats.size > maxSize) {
        throw new Error('Audio file is too large for transcription. Maximum size is 25MB.')
      }
      
      mainWindow.webContents.send('transcription-progress', { percent: 60, status: 'Transcribing with AI...' })
      
      // Step 3: Send to OpenAI Whisper API
      console.log('Main: Step 3 - Sending to OpenAI Whisper API...')
      console.log('Main: Audio file path:', tempAudioPath)
      console.log('Main: Audio file size:', audioStats.size, 'bytes')
      
      let transcription
      try {
        transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempAudioPath),
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularities: ['segment']
        })
      } catch (apiError) {
        console.error('Main: OpenAI API error details:', {
          message: apiError.message,
          status: apiError.status,
          code: apiError.code,
          type: apiError.type,
          response: apiError.response
        })
        
        // Provide more helpful error messages
        if (apiError.code === 'ENOTFOUND' || apiError.message.includes('getaddrinfo')) {
          throw new Error('Network connection failed. Please check your internet connection.')
        } else if (apiError.status === 401) {
          throw new Error('Invalid API key. Please check your OPENAI_API_KEY in the .env file.')
        } else if (apiError.status === 429) {
          throw new Error('API rate limit exceeded. Please try again later.')
        } else if (apiError.status === 500 || apiError.status === 502 || apiError.status === 503) {
          throw new Error('OpenAI service is temporarily unavailable. Please try again later.')
        } else {
          throw new Error(`OpenAI API error: ${apiError.message || 'Unknown error'}`)
        }
      }
      
      console.log('Main: Transcription complete, segments:', transcription.segments?.length || 0)
      
      mainWindow.webContents.send('transcription-progress', { percent: 90, status: 'Processing subtitles...' })
      
      // Step 4: Format segments for subtitle use
      const segments = (transcription.segments || []).map((segment, index) => ({
        id: `subtitle_${Date.now()}_${index}`,
        startTime: segment.start,
        endTime: segment.end,
        text: segment.text.trim()
      }))
      
      console.log('Main: Formatted segments:', segments.length)
      
      // Cleanup temp files
      try { fs.unlinkSync(tempAudioPath) } catch (e) {}
      try { fs.unlinkSync(tempVideoPath) } catch (e) {}
      
      mainWindow.webContents.send('transcription-progress', { percent: 100, status: 'Complete!' })
      
      return {
        success: true,
        segments: segments,
        duration: transcription.duration
      }
      
    } catch (error) {
      // Cleanup on error
      try { fs.unlinkSync(tempAudioPath) } catch (e) {}
      try { fs.unlinkSync(tempVideoPath) } catch (e) {}
      throw error
    }
    
  } catch (error) {
    console.error('Error transcribing audio:', error)
    console.error('Error stack:', error.stack)
    
    // Return a more user-friendly error message
    const errorMessage = error.message || 'Unknown error occurred during transcription'
    throw new Error(errorMessage)
  }
})

// Export timeline with subtitles to a folder
ipcMain.handle('export-timeline-with-subtitles', async (event, { clips, outputPath, resolution, subtitles }) => {
  try {
    console.log('Main: Exporting timeline with subtitles to:', outputPath)
    
    // Create output folder
    const folderPath = outputPath.replace(/\.[^/.]+$/, '') // Remove extension
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true })
    }
    
    // Export video (reuse existing export logic)
    const videoPath = path.join(folderPath, 'video.mp4')
    
    // Prepare clip metadata
    const clipMetadata = []
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      let normalizedPath = clip.filePath
      
      if (normalizedPath.startsWith('local://')) {
        normalizedPath = normalizedPath.replace('local://', '')
      }
      if (normalizedPath.startsWith('file://')) {
        normalizedPath = normalizedPath.replace('file://', '')
      }
      
      if (!fs.existsSync(normalizedPath)) {
        throw new Error(`Clip file not found: ${normalizedPath}`)
      }
      
      // Get file duration and check for audio
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(normalizedPath, (err, metadata) => {
          if (err) reject(err)
          else resolve(metadata)
        })
      })
      
      const hasAudio = metadata.streams.some(s => s.codec_type === 'audio')
      const videoStreamIndex = metadata.streams.findIndex(s => s.codec_type === 'video')
      const audioStreamIndex = metadata.streams.findIndex(s => s.codec_type === 'audio')
      const fileDuration = metadata.format.duration || 0
      
      clipMetadata.push({ ...clip, filePath: normalizedPath, hasAudio, videoStreamIndex, audioStreamIndex })
    }
    
    // Extract and concatenate clips
    const tempDir = os.tmpdir()
    const tempFiles = []
    const concatListPath = path.join(tempDir, `clipforge_export_concat_${Date.now()}.txt`)
    
    try {
      // Extract each clip segment
      for (let i = 0; i < clipMetadata.length; i++) {
        const clip = clipMetadata[i]
        const tempFile = path.join(tempDir, `clipforge_export_segment_${Date.now()}_${i}.mp4`)
        tempFiles.push(tempFile)
        
        await new Promise((resolve, reject) => {
          ffmpeg(clip.filePath)
            .setStartTime(clip.startTime)
            .setDuration(clip.duration)
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
              '-preset', 'fast',
              '-crf', '23',
              '-pix_fmt', 'yuv420p',
              '-ar', '48000',
              '-ac', '2'
            ])
            .output(tempFile)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run()
        })
        
        const percent = Math.round((i / clipMetadata.length) * 50)
        mainWindow.webContents.send('export-progress', { percent })
      }
      
      // Concatenate
      const concatList = tempFiles.map(f => `file '${f}'`).join('\n')
      fs.writeFileSync(concatListPath, concatList)
      
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .videoCodec('copy')
          .audioCodec('copy')
          .output(videoPath)
          .on('progress', (progress) => {
            const percent = Math.round(50 + (progress.percent || 0) / 2)
            mainWindow.webContents.send('export-progress', { percent })
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })
      
      // Cleanup temp files
      tempFiles.forEach(f => {
        try { fs.unlinkSync(f) } catch (e) {}
      })
      try { fs.unlinkSync(concatListPath) } catch (e) {}
      
    } catch (error) {
      // Cleanup on error
      tempFiles.forEach(f => {
        try { fs.unlinkSync(f) } catch (e) {}
      })
      try { fs.unlinkSync(concatListPath) } catch (e) {}
      throw error
    }
    
    // Generate SRT file if subtitles provided
    if (subtitles && subtitles.length > 0) {
      const srtPath = path.join(folderPath, 'subtitles.srt')
      const srtContent = generateSRT(subtitles)
      fs.writeFileSync(srtPath, srtContent, 'utf8')
      console.log('Main: SRT file created:', srtPath)
    }
    
    console.log('Main: Export with subtitles complete')
    mainWindow.webContents.send('export-complete')
    
    // Open folder in Finder/Explorer
    require('electron').shell.showItemInFolder(videoPath)
    
    return { success: true, folderPath }
    
  } catch (error) {
    console.error('Error exporting timeline with subtitles:', error)
    mainWindow.webContents.send('export-error', error.message)
    throw error
  }
})

// Helper function to generate SRT format
function generateSRT(segments) {
  let srt = ''
  
  segments.forEach((segment, index) => {
    const startTime = formatSRTTime(segment.startTime)
    const endTime = formatSRTTime(segment.endTime)
    
    srt += `${index + 1}\n`
    srt += `${startTime} --> ${endTime}\n`
    srt += `${segment.text}\n`
    srt += `\n`
  })
  
  return srt
}

// Helper function to format time for SRT (HH:MM:SS,mmm)
function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}
