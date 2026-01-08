const { chromium } = require("playwright")
const fs = require("fs")
const path = require("path")

// Configuration - read from environment variables with defaults
const CONFIG = {
  cdpPort: parseInt(process.env.CDP_PORT || "9222", 10),
  wsPort: parseInt(process.env.WS_PORT || "3000", 10), // Fixed WebSocket port for Playwright
  headless: process.env.HEADLESS === "true",
  profileDir: process.env.PROFILE_DIR || "/app/profile",
  windowSize: {
    width: parseInt(process.env.WINDOW_WIDTH || "1280", 10),
    height: parseInt(process.env.WINDOW_HEIGHT || "720", 10),
  },
  startUrl: process.env.START_URL || "about:blank",
  browserLang: process.env.BROWSER_LANG || "zh-CN",
}

// Browser state
let browserContext = null
let browserServer = null
let currentPage = null

/**
 * Get browser status
 */
function getStatus() {
  return {
    running: browserContext !== null,
    wsEndpoint: browserServer ? browserServer.wsEndpoint() : null,
    profileDir: CONFIG.profileDir,
    headless: CONFIG.headless,
    browserLang: CONFIG.browserLang,
  }
}

/**
 * Get WebSocket endpoint URL
 */
function getWsEndpoint() {
  return browserServer ? browserServer.wsEndpoint() : null
}

/**
 * Get current browser context
 */
function getBrowserContext() {
  return browserContext
}

/**
 * Start Playwright browser
 */
async function startBrowser() {
  if (browserContext) {
    console.log("Browser already running")
    return browserContext
  }

  try {
    console.log("Launching Playwright Chromium...")

    // Ensure profile directory exists
    if (!fs.existsSync(CONFIG.profileDir)) {
      fs.mkdirSync(CONFIG.profileDir, { recursive: true })
    }

    // Determine timezone based on browser language
    const timezoneId = CONFIG.browserLang.startsWith("zh")
      ? "Asia/Shanghai"
      : "UTC"

    // Start browserServer for WebSocket connections
    browserServer = await chromium.launchServer({
      headless: CONFIG.headless,
      port: CONFIG.wsPort, // Fixed port for WebSocket connections
      args: [
        `--window-size=${CONFIG.windowSize.width},${CONFIG.windowSize.height}`,
        "--window-position=0,0",
        `--remote-debugging-port=${CONFIG.cdpPort}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
        "--disable-infobars",
        "--disable-blink-features=AutomationControlled",
        `--lang=${CONFIG.browserLang}`,
      ],
    })

    console.log(
      "Browser server started, WS endpoint:",
      browserServer.wsEndpoint()
    )

    // Connect to browser via WS
    const browser = await chromium.connect(browserServer.wsEndpoint())

    // Create context with locale settings
    // Note: launchServer doesn't support persistent context, profile needs to be persisted by other means
    // Here we use the default context
    browserContext =
      browser.contexts()[0] ||
      (await browser.newContext({
        viewport: CONFIG.windowSize,
        locale: CONFIG.browserLang,
        timezoneId: timezoneId,
      }))

    // Get or create page
    const pages = browserContext.pages()
    currentPage = pages.length > 0 ? pages[0] : await browserContext.newPage()
    await currentPage.goto(CONFIG.startUrl)

    console.log("Browser started successfully!")
    console.log(`  - Headless: ${CONFIG.headless}`)
    console.log(`  - Profile Dir: ${CONFIG.profileDir}`)
    console.log(`  - CDP Port: ${CONFIG.cdpPort}`)
    console.log(`  - WS Port: ${CONFIG.wsPort}`)
    console.log(`  - Start URL: ${CONFIG.startUrl}`)
    console.log(`  - Browser Language: ${CONFIG.browserLang}`)
    console.log(`  - WS Endpoint: ${browserServer.wsEndpoint()}`)

    return browserContext
  } catch (error) {
    console.error("Failed to start browser:", error)
    throw error
  }
}

/**
 * Stop browser
 */
async function stopBrowser() {
  console.log("Stopping browser...")

  try {
    if (browserContext) {
      const browser = browserContext.browser()
      if (browser) {
        await browser.close()
      }
      browserContext = null
    }

    if (browserServer) {
      await browserServer.close()
      browserServer = null
    }

    currentPage = null
    console.log("Browser stopped")
  } catch (error) {
    console.error("Error stopping browser:", error)
    // Force cleanup references
    browserContext = null
    browserServer = null
    currentPage = null
    throw error
  }
}

/**
 * Restart browser
 */
async function restartBrowser() {
  console.log("Restarting browser...")
  await stopBrowser()
  // Wait a moment to ensure resources are released
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await startBrowser()
  console.log("Browser restarted successfully")
}

/**
 * Main startup function - for standalone mode
 */
async function main() {
  // Check if gateway should be started (default: yes)
  const useGateway = process.env.USE_GATEWAY !== "false"

  if (useGateway) {
    // Import and start gateway server
    const gateway = require("/root/gateway-server")

    // Start browser first
    await startBrowser()

    // Then start gateway, passing browser manager
    await gateway.start({
      getStatus,
      getWsEndpoint,
      getBrowserContext,
      startBrowser,
      stopBrowser,
      restartBrowser,
    })
  } else {
    // Standalone mode, only start browser
    await startBrowser()
  }

  // Graceful shutdown handling
  const cleanup = async () => {
    console.log("Shutting down...")
    await stopBrowser()
    process.exit(0)
  }

  process.on("SIGTERM", cleanup)
  process.on("SIGINT", cleanup)
}

// Export module interface
module.exports = {
  CONFIG,
  getStatus,
  getWsEndpoint,
  getBrowserContext,
  startBrowser,
  stopBrowser,
  restartBrowser,
}

// If running this file directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
}
