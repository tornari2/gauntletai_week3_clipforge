#!/bin/bash

# Kill any existing processes
pkill -f "WK3_ClipForge" 2>/dev/null

# Start Vite dev server in background
echo "Starting Vite dev server..."
npm run dev &
VITE_PID=$!

# Wait for Vite to be ready
echo "Waiting for Vite dev server to be ready..."
sleep 5

# Check if Vite is running
if ps -p $VITE_PID > /dev/null; then
    echo "Vite dev server is running. Starting Electron..."
    npm run electron &
    ELECTRON_PID=$!
    
    # Wait for user to stop
    echo "Development server is running. Press Ctrl+C to stop."
    wait $ELECTRON_PID
else
    echo "Failed to start Vite dev server"
    exit 1
fi
