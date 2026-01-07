const { chromium } = require("playwright")
const { spawn } = require("child_process")

// 配置 - 从环境变量读取，提供默认值
const CONFIG = {
  cdpPort: parseInt(process.env.CDP_PORT || "9222", 10), // Chrome DevTools Protocol 端口 (本地监听)
  externalPort: parseInt(process.env.EXTERNAL_PORT || "9223", 10), // 外部访问端口 (通过 socat 转发)
  headless: process.env.HEADLESS === "true", // 使用有头模式
  windowSize: {
    width: parseInt(process.env.WINDOW_WIDTH || "1280", 10),
    height: parseInt(process.env.WINDOW_HEIGHT || "720", 10),
  },
  startUrl: process.env.START_URL || "about:blank", // 默认打开页面
}

// 启动 socat 端口转发
function startPortForwarder() {
  console.log(
    `Starting socat port forwarder: 0.0.0.0:${CONFIG.externalPort} -> 127.0.0.1:${CONFIG.cdpPort}`
  )

  const socat = spawn(
    "socat",
    [
      `TCP-LISTEN:${CONFIG.externalPort},fork,reuseaddr,bind=0.0.0.0`,
      `TCP:127.0.0.1:${CONFIG.cdpPort}`,
    ],
    {
      stdio: "inherit",
    }
  )

  socat.on("error", (err) => {
    console.error("Failed to start socat:", err.message)
    console.error("Please ensure socat is installed: apt-get install socat")
  })

  socat.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`socat exited with code ${code}`)
    }
  })

  return socat
}

// 启动Playwright浏览器
async function startBrowser() {
  let socatProcess = null

  try {
    console.log("Launching Playwright Chromium with persistent context...")

    // 使用 launchPersistentContext 启动带用户数据目录的浏览器
    const context = await chromium.launchPersistentContext("/app/profile", {
      headless: CONFIG.headless,
      viewport: CONFIG.windowSize,
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      args: [
        // 窗口配置
        `--window-size=${CONFIG.windowSize.width},${CONFIG.windowSize.height}`,
        "--window-position=0,0",

        // CDP调试端口 - 只监听本地，通过 socat 转发外部访问
        `--remote-debugging-port=${CONFIG.cdpPort}`,

        // 其他有用的参数
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
        "--disable-infobars",
        "--disable-blink-features=AutomationControlled",
      ],
    })

    // 启动 socat 端口转发
    socatProcess = startPortForwarder()

    // 获取或创建页面
    const pages = context.pages()
    const page = pages.length > 0 ? pages[0] : await context.newPage()
    await page.goto(CONFIG.startUrl)

    console.log("Browser started successfully!")
    console.log(`- Headless: ${CONFIG.headless}`)
    console.log(`- User Data Dir: /app/profile`)
    console.log(`- CDP Port (internal): ${CONFIG.cdpPort}`)
    console.log(`- CDP Port (external): ${CONFIG.externalPort}`)
    console.log(`- Start URL: ${CONFIG.startUrl}`)
    console.log("")
    console.log(
      "You can connect to this browser from outside the container using:"
    )
    console.log(
      `  - Java: chromium().connectOverCDP("http://host:${CONFIG.externalPort}")`
    )
    console.log(
      `  - Node.js: await chromium.connectOverCDP("http://host:${CONFIG.externalPort}")`
    )
    console.log(
      `  - Puppeteer: await puppeteer.connect({browserURL: 'http://host:${CONFIG.externalPort}'})`
    )
    console.log(`  - CDP JSON: http://host:${CONFIG.externalPort}/json`)

    // 保持进程运行
    const cleanup = async () => {
      console.log("Shutting down...")
      if (socatProcess) {
        socatProcess.kill()
      }
      await context.close()
      process.exit(0)
    }

    process.on("SIGTERM", cleanup)
    process.on("SIGINT", cleanup)
  } catch (error) {
    console.error("Failed to start browser:", error)
    process.exit(1)
  }
}

// 启动
startBrowser()
