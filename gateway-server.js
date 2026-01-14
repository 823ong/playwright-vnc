const express = require("express")
const { createProxyMiddleware } = require("http-proxy-middleware")
const { createServer } = require("http")
const path = require("path")
const fs = require("fs")

// Configuration
const CONFIG = {
  port: parseInt(process.env.GATEWAY_PORT || "8080", 10),
  vncPort: parseInt(process.env.VNC_PORT || "6080", 10),
  cdpPort: parseInt(process.env.CDP_PORT || "9222", 10),
  profileDir: "/app/profile",
}

// Browser manager reference
let browserManager = null

// Create Express application
const app = express()
app.use(express.json())

// ==================== API Routes ====================

// Get status
app.get("/api/status", (req, res) => {
  res.json({
    status: "running",
    browser: browserManager ? browserManager.getStatus() : { running: false },
    config: {
      port: CONFIG.port,
      profileDir: CONFIG.profileDir,
    },
    timestamp: new Date().toISOString(),
  })
})

// Restart browser
app.post("/api/restart-browser", async (req, res) => {
  try {
    if (!browserManager) {
      return res.status(500).json({ error: "Browser manager not initialized" })
    }
    await browserManager.restartBrowser()
    res.json({ success: true, message: "Browser restarted successfully" })
  } catch (error) {
    console.error("Failed to restart browser:", error)
    res.status(500).json({ error: error.message })
  }
})

// Clear profile
app.post("/api/clear-profile", async (req, res) => {
  try {
    if (!browserManager) {
      return res.status(500).json({ error: "Browser manager not initialized" })
    }

    // Stop browser first
    await browserManager.stopBrowser()

    // Clear profile directory
    if (fs.existsSync(CONFIG.profileDir)) {
      fs.rmSync(CONFIG.profileDir, { recursive: true, force: true })
      fs.mkdirSync(CONFIG.profileDir, { recursive: true })
      console.log("Profile directory cleared:", CONFIG.profileDir)
    }

    // Restart browser
    await browserManager.startBrowser()

    res.json({
      success: true,
      message: "Profile cleared and browser restarted",
    })
  } catch (error) {
    console.error("Failed to clear profile:", error)
    res.status(500).json({ error: error.message })
  }
})

// ==================== Proxy Configuration ====================

// CDP proxy
const cdpProxy = createProxyMiddleware({
  target: `http://127.0.0.1:${CONFIG.cdpPort}`,
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    "^/cdp": "", // Remove /cdp prefix
  },
  logLevel: "warn",
})

// Mount proxy routes
app.use("/cdp", cdpProxy)

// ==================== Root Route ====================

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Playwright VNC Gateway</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #00d9ff; }
    a { color: #00d9ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .endpoint { background: #16213e; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #00d9ff; }
    .endpoint h3 { margin: 0 0 8px 0; color: #fff; }
    .endpoint code { background: #0f3460; padding: 3px 8px; border-radius: 4px; }
    .api { border-left-color: #e94560; }
    .api h3 { color: #e94560; }
  </style>
</head>
<body>
  <h1>🎭 Playwright Gateway</h1>
  <p>Services available:</p>
  
  <div class="endpoint">
    <h3>VNC Web Interface</h3>
    <p>Access directly on port <code>6080</code>: <code>http://host:6080/vnc_lite.html</code></p>
  </div>
  
  <div class="endpoint">
    <h3>CDP (Chrome DevTools Protocol)</h3>
    <p><code>/cdp/*</code> - CDP interface for Playwright/Puppeteer connections</p>
    <p>Connect via: <code>chromium.connectOverCDP("http://host:8080/cdp")</code></p>
    <p><a href="/cdp/json/version">/cdp/json/version</a> - CDP version info</p>
  </div>
  
  <div class="endpoint">
    <h3>Playwright WebSocket</h3>
    <p><code>/ws</code> - WebSocket endpoint for Playwright</p>
    <p>Connect via: <code>chromium.connect("ws://host:8080/ws")</code></p>
  </div>
  
  <div class="endpoint api">
    <h3>Control API</h3>
    <p><code>GET /api/status</code> - Service status</p>
    <p><code>POST /api/restart-browser</code> - Restart browser</p>
    <p><code>POST /api/clear-profile</code> - Clear profile and restart</p>
  </div>
</body>
</html>
  `)
})

// ==================== WebSocket Route (Playwright WS) ====================

// Create HTTP server
const server = createServer(app)

// Setup WebSocket upgrade handling
server.on("upgrade", (req, socket, head) => {
  const pathname = req.url

  if (pathname === "/ws" || pathname.startsWith("/ws?")) {
    // Playwright WebSocket connection
    if (browserManager && browserManager.getWsEndpoint()) {
      const wsEndpoint = browserManager.getWsEndpoint()
      // Use cdpProxy to handle WebSocket upgrade
      const targetUrl = new URL(wsEndpoint)
      const proxy = createProxyMiddleware({
        target: `ws://${targetUrl.host}`,
        ws: true,
        changeOrigin: true,
        pathRewrite: () => targetUrl.pathname + targetUrl.search,
      })
      proxy.upgrade(req, socket, head)
    } else {
      console.error("Browser WebSocket endpoint not available")
      socket.destroy()
    }
  } else if (pathname.startsWith("/cdp")) {
    // CDP WebSocket
    cdpProxy.upgrade(req, socket, head)
  } else {
    socket.destroy()
  }
})

// ==================== Start Service ====================

async function start(browserMgr) {
  browserManager = browserMgr

  return new Promise((resolve, reject) => {
    server.listen(CONFIG.port, "0.0.0.0", () => {
      console.log("")
      console.log("========================================")
      console.log("Gateway server started on port", CONFIG.port)
      console.log("========================================")
      console.log("Endpoints:")
      console.log(
        `  - VNC Web:  http://localhost:6080/vnc_lite.html (separate port)`
      )
      console.log(`  - CDP:      http://localhost:${CONFIG.port}/cdp`)
      console.log(`  - WS:       ws://localhost:${CONFIG.port}/ws`)
      console.log(`  - API:      http://localhost:${CONFIG.port}/api/status`)
      console.log("========================================")
      console.log("")
      resolve(server)
    })

    server.on("error", reject)
  })
}

module.exports = { start, CONFIG }
