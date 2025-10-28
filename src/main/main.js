const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron')
const path = require('path')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static')
const ffprobePath = require('ffprobe-static').path

// Configure FFmpeg paths with production fallback
function setupFFmpegPaths() {
  let ffmpegExecutable = ffmpegPath
  let ffprobeExecutable = ffprobePath
  
  // In production, the executables might be in a different location
  if (app.isPackaged) {
    console.log('Setting up FFmpeg paths for production build')
    
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

// Configure FFmpeg paths
setupFFmpegPaths()

// We'll use the custom protocol instead of HTTP server

// Register custom protocol for local files
app.whenReady().then(() => {
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
        webSecurity: false
      },
    show: false,
    frame: true,
    resizable: true,
    movable: true
  })

  // Load the app
  const isDev = process.env.NODE_ENV === 'development'
  
  if (isDev) {
    // Try different ports that Vite might use
    const tryLoadDevServer = async () => {
      const ports = [5173, 5174, 5175, 5176, 5177]
      
      for (const port of ports) {
        try {
          await mainWindow.loadURL(`http://localhost:${port}`)
          console.log(`Successfully loaded Vite dev server on port ${port}`)
          mainWindow.webContents.openDevTools()
          return
        } catch (error) {
          console.log(`Port ${port} not available, trying next...`)
        }
      }
      
      console.error('Could not load Vite dev server on any port')
      // Fallback to production build
      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    }
    
    tryLoadDevServer()
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
        { name: 'Videos', extensions: ['mp4', 'mov'] }
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

// Get video duration
ipcMain.handle('get-video-duration', async (event, filePath) => {
  try {
    console.log('Main: get-video-duration called for:', filePath)
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
  const { inputPath, outputPath, startTime, duration } = options
  
  try {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
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
