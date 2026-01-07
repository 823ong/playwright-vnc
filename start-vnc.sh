#!/bin/bash
set -e

echo "========================================"
echo "Starting Playwright VNC Container..."
echo "========================================"

# 启动虚拟显示服务器
echo "[1/5] Starting Xvfb (virtual display)..."
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
sleep 2

# 启动窗口管理器
echo "[2/5] Starting Fluxbox window manager..."
fluxbox &
sleep 1

# 启动x11vnc（VNC服务器）
echo "[3/5] Starting x11vnc server..."
x11vnc -display :99 -forever -shared -rfbport 5900 -nopw &
sleep 1

# 启动noVNC（通过浏览器访问VNC）
echo "[4/5] Starting noVNC (web-based VNC)..."
websockify --web /usr/share/novnc/ 6080 localhost:5900 &
sleep 1

# 启动Playwright浏览器
echo "[5/5] Starting Playwright browser with CDP endpoint..."
node /root/start-browser.js

echo ""
echo "========================================"
echo "All services started successfully!"
echo "========================================"
echo "访问方式:"
echo "  - VNC Web界面: http://localhost:6080/vnc.html"
echo "  - VNC协议:    localhost:5900"
echo "  - CDP调试接口: http://localhost:9223 (可通过 EXTERNAL_PORT 环境变量修改)"
echo "========================================"
echo ""

# 保持容器运行
tail -f /dev/null
