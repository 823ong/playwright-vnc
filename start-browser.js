const { chromium } = require("playwright")
const fs = require("fs")
const path = require("path")

// 配置 - 从环境变量读取，提供默认值
const CONFIG = {
  cdpPort: parseInt(process.env.CDP_PORT || "9222", 10),
  headless: process.env.HEADLESS === "true",
  profileDir: process.env.PROFILE_DIR || "/app/profile",
  windowSize: {
    width: parseInt(process.env.WINDOW_WIDTH || "1280", 10),
    height: parseInt(process.env.WINDOW_HEIGHT || "720", 10),
  },
  startUrl: process.env.START_URL || "about:blank",
}

// 浏览器状态
let browserContext = null
let browserServer = null
let currentPage = null

/**
 * 获取浏览器状态
 */
function getStatus() {
  return {
    running: browserContext !== null,
    wsEndpoint: browserServer ? browserServer.wsEndpoint() : null,
    profileDir: CONFIG.profileDir,
    headless: CONFIG.headless,
  }
}

/**
 * 获取 WebSocket 端点 URL
 */
function getWsEndpoint() {
  return browserServer ? browserServer.wsEndpoint() : null
}

/**
 * 获取当前浏览器上下文
 */
function getBrowserContext() {
  return browserContext
}

/**
 * 启动 Playwright 浏览器
 */
async function startBrowser() {
  if (browserContext) {
    console.log("Browser already running")
    return browserContext
  }

  try {
    console.log("Launching Playwright Chromium...")

    // 确保 profile 目录存在
    if (!fs.existsSync(CONFIG.profileDir)) {
      fs.mkdirSync(CONFIG.profileDir, { recursive: true })
    }

    // 先启动 browserServer 用于 WebSocket 连接
    browserServer = await chromium.launchServer({
      headless: CONFIG.headless,
      args: [
        `--window-size=${CONFIG.windowSize.width},${CONFIG.windowSize.height}`,
        "--window-position=0,0",
        `--remote-debugging-port=${CONFIG.cdpPort}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
        "--disable-infobars",
        "--disable-blink-features=AutomationControlled",
      ],
    })

    console.log(
      "Browser server started, WS endpoint:",
      browserServer.wsEndpoint()
    )

    // 通过 WS 连接到浏览器
    const browser = await chromium.connect(browserServer.wsEndpoint())

    // 创建持久化上下文 (使用 CDP 连接到已存在的浏览器)
    // 注意: launchServer 不支持 persistent context，所以 profile 需要通过其他方式持久化
    // 这里我们使用默认 context
    browserContext =
      browser.contexts()[0] ||
      (await browser.newContext({
        viewport: CONFIG.windowSize,
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
      }))

    // 获取或创建页面
    const pages = browserContext.pages()
    currentPage = pages.length > 0 ? pages[0] : await browserContext.newPage()
    await currentPage.goto(CONFIG.startUrl)

    console.log("Browser started successfully!")
    console.log(`  - Headless: ${CONFIG.headless}`)
    console.log(`  - Profile Dir: ${CONFIG.profileDir}`)
    console.log(`  - CDP Port: ${CONFIG.cdpPort}`)
    console.log(`  - Start URL: ${CONFIG.startUrl}`)
    console.log(`  - WS Endpoint: ${browserServer.wsEndpoint()}`)

    return browserContext
  } catch (error) {
    console.error("Failed to start browser:", error)
    throw error
  }
}

/**
 * 停止浏览器
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
    // 强制清理引用
    browserContext = null
    browserServer = null
    currentPage = null
    throw error
  }
}

/**
 * 重启浏览器
 */
async function restartBrowser() {
  console.log("Restarting browser...")
  await stopBrowser()
  // 等待一小段时间确保资源释放
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await startBrowser()
  console.log("Browser restarted successfully")
}

/**
 * 主启动函数 - 用于独立运行模式
 */
async function main() {
  // 检查是否需要启动 gateway (默认启动)
  const useGateway = process.env.USE_GATEWAY !== "false"

  if (useGateway) {
    // 导入并启动 gateway server
    const gateway = require("/root/gateway-server")

    // 先启动浏览器
    await startBrowser()

    // 然后启动 gateway，传入浏览器管理器
    await gateway.start({
      getStatus,
      getWsEndpoint,
      getBrowserContext,
      startBrowser,
      stopBrowser,
      restartBrowser,
    })
  } else {
    // 独立模式，只启动浏览器
    await startBrowser()
  }

  // 优雅退出处理
  const cleanup = async () => {
    console.log("Shutting down...")
    await stopBrowser()
    process.exit(0)
  }

  process.on("SIGTERM", cleanup)
  process.on("SIGINT", cleanup)
}

// 导出模块接口
module.exports = {
  CONFIG,
  getStatus,
  getWsEndpoint,
  getBrowserContext,
  startBrowser,
  stopBrowser,
  restartBrowser,
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
}
