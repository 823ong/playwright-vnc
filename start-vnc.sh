#!/bin/bash
set -e

# 屏幕分辨率配置 - 默认 1280x720
SCREEN_WIDTH=${SCREEN_WIDTH:-1280}
SCREEN_HEIGHT=${SCREEN_HEIGHT:-720}

echo "========================================"
echo "Starting Playwright VNC Container..."
echo "Screen Resolution: ${SCREEN_WIDTH}x${SCREEN_HEIGHT}"
echo "========================================"

# 启动虚拟显示服务器
echo "[1/4] Starting Xvfb (virtual display)..."
Xvfb :99 -screen 0 ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24 &
export DISPLAY=:99

# 导出给 start-browser.js 使用
export WINDOW_WIDTH=${SCREEN_WIDTH}
export WINDOW_HEIGHT=${SCREEN_HEIGHT}

sleep 2

# 启动窗口管理器
echo "[2/4] Starting Fluxbox window manager..."
fluxbox &
sleep 1

# 启动x11vnc（VNC服务器）
echo "[3/4] Starting x11vnc server..."
x11vnc -display :99 -forever -shared -rfbport 5900 -nopw &
sleep 1

# 启动noVNC（独立端口 6080）
echo "[4/4] Starting noVNC on port 6080..."
/opt/novnc/utils/websockify/run --web /opt/novnc 6080 localhost:5900 &
sleep 1

# 启动Gateway服务器（包含浏览器和API服务）
echo "[5/5] Starting Gateway server with browser..."
cd /app && node /root/start-browser.js

echo ""
echo "========================================"
echo "All services started successfully!"
echo "========================================"
echo ""
echo "访问方式:"
echo "  - VNC Web:       http://localhost:6080/vnc_lite.html"
echo "  - Gateway:       http://localhost:8080/"
echo "  - CDP接口:       http://localhost:8080/cdp"
echo "  - Playwright WS: ws://localhost:8080/ws"
echo "  - API状态:       http://localhost:8080/api/status"
echo ""
echo "API 操作:"
echo "  - POST /api/restart-browser  重启浏览器"
echo "  - POST /api/clear-profile    清空Profile并重启"
echo "========================================"
echo ""

# 保持容器运行
tail -f /dev/null
