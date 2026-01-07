# Playwright VNC

Docker 容器中运行的 Playwright 浏览器，支持通过 VNC 和 Chrome DevTools Protocol (CDP) 进行远程访问和调试。

## 功能特性

- 🌐 **Playwright 浏览器**: 基于 Chromium 的自动化浏览器
- 🖥️ **VNC 访问**: 通过 VNC 协议查看和操作浏览器界面
- 🌍 **Web 界面**: 通过 noVNC 在浏览器中访问 VNC
- 🔌 **CDP 支持**: Chrome DevTools Protocol 远程调试接口
- 🔄 **端口转发**: 通过 socat 实现 CDP 端口的外部访问
- 💾 **持久化**: 支持浏览器用户数据持久化

## 端口说明

| 端口 | 协议 | 说明 |
|------|------|------|
| 6080 | HTTP | noVNC Web 界面访问 |
| 5900 | VNC | 标准 VNC 协议端口 |
| 9223 | HTTP | CDP 调试接口（外部访问） |

## 快速开始

### 构建镜像

```bash
docker build -t playwright-vnc .
```

### 运行容器

```bash
docker run -d \
  -p 6080:6080 \
  -p 5900:5900 \
  -p 9223:9223 \
  --name playwright-browser \
  playwright-vnc
```

### 访问浏览器

- **VNC Web 界面**: http://localhost:6080/vnc.html
- **VNC 客户端**: localhost:5900
- **CDP 接口**: http://localhost:9223/json

## 环境变量配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CDP_PORT` | CDP 内部端口 | 9222 |
| `EXTERNAL_PORT` | CDP 外部访问端口 | 9223 |
| `HEADLESS` | 是否无头模式 | false |
| `WINDOW_WIDTH` | 浏览器窗口宽度 | 1280 |
| `WINDOW_HEIGHT` | 浏览器窗口高度 | 720 |
| `START_URL` | 启动时打开的 URL | about:blank |

### 配置示例

```bash
docker run -d \
  -e HEADLESS=false \
  -e WINDOW_WIDTH=1920 \
  -e WINDOW_HEIGHT=1080 \
  -e START_URL=https://example.com \
  -e EXTERNAL_PORT=9223 \
  -p 6080:6080 \
  -p 5900:5900 \
  -p 9223:9223 \
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
      - "6080:6080"
      - "5900:5900"
      - "9223:9223"
    environment:
      - HEADLESS=false
      - WINDOW_WIDTH=1920
      - WINDOW_HEIGHT=1080
      - START_URL=https://example.com
      - EXTERNAL_PORT=9223
    restart: unless-stopped
```

## CDP 连接方式

### Node.js (Playwright)

```javascript
const { chromium } = require('playwright');

const browser = await chromium.connectOverCDP('http://localhost:9223');
const page = await browser.newPage();
await page.goto('https://example.com');
```

### Node.js (Puppeteer)

```javascript
const puppeteer = require('puppeteer');

const browser = await puppeteer.connect({
  browserURL: 'http://localhost:9223'
});
const page = await browser.newPage();
await page.goto('https://example.com');
```

### Java

```java
ChromiumBrowser browser = chromium().connectOverCDP("http://localhost:9223");
Page page = browser.newPage();
page.navigate("https://example.com");
```

### Python

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://localhost:9223')
    page = browser.new_page()
    page.goto('https://example.com')
```

## 持久化数据

容器内的浏览器用户数据存储在 `/app/profile` 目录，如需持久化可以挂载卷：

```bash
docker run -d \
  -v /path/to/profile:/app/profile \
  -p 6080:6080 \
  -p 9223:9223 \
  playwright-vnc
```

## 项目结构

```
.
├── Dockerfile          # Docker 镜像构建文件
├── start-vnc.sh        # VNC 和浏览器启动脚本
├── start-browser.js    # Playwright 浏览器启动脚本
└── README.md           # 项目说明文档
```

## 技术栈

- **Playwright**: 浏览器自动化框架
- **Chromium**: 浏览器内核
- **Xvfb**: 虚拟显示服务器
- **Fluxbox**: 窗口管理器
- **x11vnc**: VNC 服务器
- **noVNC**: Web VNC 客户端
- **socat**: 端口转发工具

## License

MIT
