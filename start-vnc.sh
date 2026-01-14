#!/bin/bash
set -e

# Screen resolution configuration - default 1280x720
SCREEN_WIDTH=${SCREEN_WIDTH:-1280}
SCREEN_HEIGHT=${SCREEN_HEIGHT:-720}

# VNC password configuration - default CHANGE_ME
VNC_PASSWORD=${VNC_PASSWORD:-CHANGE_ME}

echo "========================================"
echo "Starting Playwright VNC Container..."
echo "Screen Resolution: ${SCREEN_WIDTH}x${SCREEN_HEIGHT}"
echo "========================================"

# Start virtual display server
echo "[1/4] Starting Xvfb (virtual display)..."
Xvfb :99 -screen 0 ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24 &
export DISPLAY=:99

# Export for start-browser.js
export WINDOW_WIDTH=${SCREEN_WIDTH}
export WINDOW_HEIGHT=${SCREEN_HEIGHT}

sleep 2

# Start window manager
echo "[2/4] Starting Fluxbox window manager..."
fluxbox &
sleep 1

# Start x11vnc (VNC server)
echo "[3/4] Starting x11vnc server..."
# Setup VNC password
VNC_PASSWD_FILE=/tmp/vncpasswd
if [ -n "$VNC_PASSWORD" ]; then
  echo "[INFO] Setting VNC password..."
  x11vnc -storepasswd "$VNC_PASSWORD" "$VNC_PASSWD_FILE"
  x11vnc -display :99 -forever -shared -rfbport 5900 -rfbauth "$VNC_PASSWD_FILE" &
else
  echo "[WARN] No VNC password set, running without password!"
  x11vnc -display :99 -forever -shared -rfbport 5900 -nopw &
fi
sleep 1

# Start noVNC (separate port 6080)
echo "[4/4] Starting noVNC on port 6080..."
/opt/novnc/utils/websockify/run --web /opt/novnc 6080 localhost:5900 &
sleep 1

# Start Gateway server (includes browser and API service)
echo "[5/5] Starting Gateway server with browser..."
cd /app && node /root/start-browser.js

echo ""
echo "========================================"
echo "All services started successfully!"
echo "========================================"
echo ""
echo "Access URLs:"
echo "  - VNC Web:       http://localhost:6080/vnc_lite.html"
echo "  - Gateway:       http://localhost:8080/"
echo "  - CDP Interface: http://localhost:8080/cdp"
echo "  - Playwright WS: ws://localhost:8080/ws"
echo "  - API Status:    http://localhost:8080/api/status"
echo ""
echo "API Operations:"
echo "  - POST /api/restart-browser  Restart browser"
echo "  - POST /api/clear-profile    Clear profile and restart"
echo "========================================"
echo ""

# Keep container running
tail -f /dev/null
