# Playwright VNC

Docker 容器中运行的 Playwright 浏览器，支持通过 VNC 和 Chrome DevTools Protocol (CDP) 进行远程访问和调试。

## 功能特性

- 🌐 **Playwright 浏览器**: 基于 Chromium 的自动化浏览器
- 🖥️ **VNC 访问**: 通过 VNC 协议查看和操作浏览器界面
- 🌍 **Web 界面**: 通过 noVNC 在浏览器中访问 VNC
- 🔌 **CDP 支持**: Chrome DevTools Protocol 远程调试接口
- 🔗 **WebSocket 端点**: 支持外部 Playwright 通过 WebSocket 连接
- 🎛️ **控制 API**: 重启浏览器、清空 Profile 等管理功能
- 💾 **持久化**: 支持浏览器用户数据持久化

## 统一端口架构

所有服务通过 **单一端口 8080** 对外暴露：

| 路径                     | 说明                       |
| ------------------------ | -------------------------- |
| `/`                    | 服务首页，显示所有端点信息 |
| `/vnc/*`               | noVNC Web 界面访问         |
| `/cdp/*`               | CDP 调试接口               |
| `/ws`                  | Playwright WebSocket 端点  |
| `/api/status`          | 获取服务状态               |
| `/api/restart-browser` | 重启浏览器                 |
| `/api/clear-profile`   | 清空 Profile 并重启        |

## 快速开始

### 构建镜像

```bash
docker build -t playwright-vnc .
```

### 运行容器

```bash
docker run -d \
  -p 8080:8080 \
  --name playwright-browser \
  playwright-vnc
```

> 你可以直接拉取镜像使用
> docker pull ghcr.io/823ong/playwright-vnc:latest

### 访问服务

- **服务首页**: http://localhost:8080/
- **VNC Web 界面**: http://localhost:8080/vnc/vnc.html
- **CDP 接口**: http://localhost:8080/cdp/json
- **API 状态**: http://localhost:8080/api/status

## 环境变量配置

| 变量              | 说明             | 默认值      |
| ----------------- | ---------------- | ----------- |
| `GATEWAY_PORT`  | 统一网关端口     | 8080        |
| `CDP_PORT`      | CDP 内部端口     | 9222        |
| `VNC_PORT`      | VNC 内部端口     | 6080        |
| `HEADLESS`      | 是否无头模式     | false       |
| `WINDOW_WIDTH`  | 浏览器窗口宽度   | 1280        |
| `WINDOW_HEIGHT` | 浏览器窗口高度   | 720         |
| `START_URL`     | 启动时打开的 URL | about:blank |

### 配置示例

```bash
docker run -d \
  -e HEADLESS=false \
  -e WINDOW_WIDTH=1920 \
  -e WINDOW_HEIGHT=1080 \
  -e START_URL=https://example.com \
  -p 8080:8080 \
  --name playwright-browser \
  playwright-vnc
```

### Docker Compose 示例

```yaml
version: '3.8'

services:
  playwright-browser:
    build: .
    container_name: playwright-browser
    ports:
      - "8080:8080"
    environment:
      - HEADLESS=false
      - WINDOW_WIDTH=1920
      - WINDOW_HEIGHT=1080
      - START_URL=https://example.com
    restart: unless-stopped
```

## 连接方式

### Node.js (Playwright) - CDP 连接

```javascript
const { chromium } = require('playwright');

const browser = await chromium.connectOverCDP('http://localhost:8080/cdp');
const page = await browser.newPage();
await page.goto('https://example.com');
```

### Node.js (Playwright) - WebSocket 连接

```javascript
const { chromium } = require('playwright');

const browser = await chromium.connect('ws://localhost:8080/ws');
const page = await browser.newPage();
await page.goto('https://example.com');
```

### Node.js (Puppeteer)

```javascript
const puppeteer = require('puppeteer');

const browser = await puppeteer.connect({
  browserURL: 'http://localhost:8080/cdp'
});
const page = await browser.newPage();
await page.goto('https://example.com');
```

### Java

```java
ChromiumBrowser browser = chromium().connectOverCDP("http://localhost:8080/cdp");
Page page = browser.newPage();
page.navigate("https://example.com");
```

### Python

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://localhost:8080/cdp')
    page = browser.new_page()
    page.goto('https://example.com')
```

## 控制 API

### 获取状态

```bash
curl http://localhost:8080/api/status
```

响应示例：

```json
{
  "status": "running",
  "browser": {
    "running": true,
    "wsEndpoint": "ws://...",
    "profileDir": "/app/profile"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 重启浏览器

```bash
curl -X POST http://localhost:8080/api/restart-browser
```

### 清空 Profile

```bash
curl -X POST http://localhost:8080/api/clear-profile
```

## 持久化数据

容器内的浏览器用户数据存储在 `/app/profile` 目录，如需持久化可以挂载卷：

```bash
docker run -d \
  -v /path/to/profile:/app/profile \
  -p 8080:8080 \
  playwright-vnc
```

## 项目结构

```
.
├── Dockerfile          # Docker 镜像构建文件
├── gateway-server.js   # 统一网关服务器
├── start-vnc.sh        # VNC 和服务启动脚本
├── start-browser.js    # Playwright 浏览器管理模块
└── README.md           # 项目说明文档
```

## 技术栈

- **Playwright**: 浏览器自动化框架
- **Chromium**: 浏览器内核
- **Express**: HTTP 服务器框架
- **http-proxy-middleware**: HTTP/WebSocket 代理
- **Xvfb**: 虚拟显示服务器
- **Fluxbox**: 窗口管理器
- **x11vnc**: VNC 服务器
- **noVNC**: Web VNC 客户端

## License

MIT
