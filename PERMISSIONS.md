# ClipForge Permissions Guide

ClipForge requires specific permissions to record your screen and microphone. This guide will help you grant the necessary permissions on macOS.

## Required Permissions

### 1. Screen Recording Permission
- **Purpose**: Allows ClipForge to record your screen or specific windows
- **Required for**: Screen recording, window recording, and Picture-in-Picture recording

### 2. Microphone Permission  
- **Purpose**: Allows ClipForge to record audio from your microphone
- **Required for**: Audio recording during screen/webcam recording

## How to Grant Permissions

### macOS 13+ (Ventura and later)
1. Open **System Settings**
2. Go to **Privacy & Security**
3. Select **Screen Recording** from the left sidebar
4. Toggle **ON** next to **ClipForge** (or your terminal app if running in development)
5. Select **Microphone** from the left sidebar
6. Toggle **ON** next to **ClipForge** (or your terminal app if running in development)

### macOS 12 and earlier
1. Open **System Preferences**
2. Go to **Security & Privacy**
3. Click the **Privacy** tab
4. Select **Screen Recording** from the left sidebar
5. Check the box next to **ClipForge** (or your terminal app if running in development)
6. Select **Microphone** from the left sidebar
7. Check the box next to **ClipForge** (or your terminal app if running in development)

## Troubleshooting

### If you don't see ClipForge in the list:
1. Try running the app again - macOS should prompt you for permission
2. If running in development mode, look for your terminal app (Terminal, iTerm2, etc.)
3. Restart the app after granting permissions

### If recording still doesn't work:
1. Make sure you've granted both Screen Recording AND Microphone permissions
2. Try restarting your computer
3. Check that no other apps are using your camera or microphone
4. Ensure your camera and microphone are working in other apps

### Development Mode Notes:
- When running `npm run dev`, you may need to grant permissions to your terminal app instead of ClipForge
- The app name in permissions might appear as "Electron" or your terminal app name
- After building the app with `npm run package`, the permissions will be for "ClipForge"

## Security Note
ClipForge only accesses your screen and microphone when you explicitly start a recording. The app does not record or transmit any data without your permission.
