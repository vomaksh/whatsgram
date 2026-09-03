/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { app, BrowserWindow, ipcMain, IpcMainEvent, Menu, shell, Tray, WebContents } from 'electron'
import path, { join } from 'node:path'
import {
  APP_NAME,
  WHATSAPP_FONT_FAMILY,
  WHATSAPP_FONT_FAMILY_MONO,
  WHATSAPP_USER_AGENT,
  WHATSAPP_WEB_URL
} from './constants'
import { AppConfig, AppConfigType } from './config'
import { debounce, getDefaultTrayIcon, getTrayFavicon, getUnreadCountFromFavicon } from './utils'
import icon from '../../resources/icon.png?asset'

app.setPath('userData', path.join(app.getPath('home'), '.config', APP_NAME))

let config: AppConfigType = {}
let tray: Tray
let isQuitting = false
const winBounds = {
  width: 1099,
  height: 800
}
const WHATSAPP_LOAD_TIMEOUT_MS = 10_000
const WHATSAPP_RETRY_DELAY_MS = 3_000

function injectCSS(mainWindow: BrowserWindow, config: AppConfigType) {
  mainWindow.webContents.insertCSS(`
    :root {
      --font-family-monospace: ${config.fontFamilyMono ? config.fontFamilyMono + ',' : ''}${WHATSAPP_FONT_FAMILY_MONO}
    }
    body {
      font-family: ${config.fontFamily ? config.fontFamily + ',' : ''}${WHATSAPP_FONT_FAMILY}
    }
    .xdounpk {
      font-family: ${config.fontFamily ? config.fontFamily + ',' : ''}${WHATSAPP_FONT_FAMILY}
    }
  `)
}

async function loadLocalPage(browserWindow: BrowserWindow, fileName: string) {
  if (!app.isPackaged) {
    await browserWindow.loadFile(join(app.getAppPath(), 'src/renderer', fileName))
    return
  }

  await browserWindow.loadFile(join(__dirname, '../renderer', fileName))
}

async function createLoadingWindow() {
  const loadingWindow = new BrowserWindow({
    width: 352,
    height: 500,
    show: false,
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#12181c',
    title: APP_NAME,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  await loadLocalPage(loadingWindow, 'loading.html')
  loadingWindow.show()
  return loadingWindow
}

async function loadWhatsApp(mainWindow: BrowserWindow) {
  let timeoutId: NodeJS.Timeout | undefined

  try {
    const loadTimeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.stop()
        }
        reject(new Error(`WhatsApp Web did not load within ${WHATSAPP_LOAD_TIMEOUT_MS} ms.`))
      }, WHATSAPP_LOAD_TIMEOUT_MS)
    })

    await Promise.race([
      mainWindow.loadURL(WHATSAPP_WEB_URL, {
        userAgent: WHATSAPP_USER_AGENT
      }),
      loadTimeout
    ])

    return true
  } catch (error) {
    console.error('Could not load WhatsApp Web.', error)
    return false
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function waitForRetry(ms: number, sender: WebContents) {
  return new Promise<void>((resolve) => {
    function finishWaiting() {
      clearTimeout(timeoutId)
      ipcMain.removeListener('retry-load', handleRetry)
      resolve()
    }

    const handleRetry = (event: IpcMainEvent) => {
      if (event.sender === sender) {
        finishWaiting()
      }
    }

    const timeoutId = setTimeout(finishWaiting, ms)
    ipcMain.on('retry-load', handleRetry)
  })
}

async function createWindow() {
  if (!app.requestSingleInstanceLock()) {
    console.log('Application instance is already running. Quitting....')
    app.quit()
    return
  }

  const appConfig = new AppConfig()
  config = await appConfig.getConfig()

  Menu.setApplicationMenu(null)

  const mainWindow = new BrowserWindow({
    width: winBounds.width,
    height: winBounds.height,
    show: false,
    backgroundColor: '#12181c',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      sandbox: false
    }
  })

  let isLoadingWhatsApp = false

  async function startWhatsAppLoad() {
    if (isLoadingWhatsApp || mainWindow.isDestroyed()) {
      return
    }

    isLoadingWhatsApp = true
    let loadingWindow: BrowserWindow | undefined

    try {
      loadingWindow = await createLoadingWindow()
      mainWindow.hide()
    } catch (error) {
      console.error('Could not load the loading page.', error)
      mainWindow.show()
    }

    let didLoad = false

    try {
      while (!didLoad && !mainWindow.isDestroyed()) {
        didLoad = await loadWhatsApp(mainWindow)

        if (!didLoad && !mainWindow.isDestroyed()) {
          if (loadingWindow && !loadingWindow.isDestroyed()) {
            loadingWindow.webContents.send('connection-status', 'offline')
            await waitForRetry(WHATSAPP_RETRY_DELAY_MS, loadingWindow.webContents)
          } else {
            await new Promise<void>((resolve) => setTimeout(resolve, WHATSAPP_RETRY_DELAY_MS))
          }
        }
      }
    } finally {
      if (didLoad && !mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
      }
      if (loadingWindow && !loadingWindow.isDestroyed()) {
        loadingWindow.close()
      }
      isLoadingWhatsApp = false
    }
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(WHATSAPP_WEB_URL)) {
      return { action: 'allow' }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('dom-ready', () => injectCSS(mainWindow, config))
  mainWindow.webContents.on('did-finish-load', () => injectCSS(mainWindow, config))

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({
      mode: 'bottom'
    })
  }

  await setupTray(mainWindow)

  mainWindow.on('show', () => {
    setupTrayContextMenu(mainWindow, tray)
  })

  mainWindow.on('hide', () => {
    setupTrayContextMenu(mainWindow, tray)
  })

  function saveBounds() {
    const bounds = mainWindow.getBounds()
    winBounds.width = bounds.width
    winBounds.height = bounds.height
  }

  const debounced = debounce(saveBounds, 1000)
  mainWindow.on('move', debounced)
  mainWindow.on('resize', debounced)
  mainWindow.on('close', saveBounds)

  mainWindow.webContents.on('page-favicon-updated', async (_ev, favicons) => {
    if (favicons.length > 0) {
      const newFaviconUrl = favicons[favicons.length - 1]
      const unreadCount = getUnreadCountFromFavicon(newFaviconUrl)
      if (unreadCount && unreadCount != '0') {
        const trayNativeImg = await getTrayFavicon(unreadCount)
        tray.setImage(trayNativeImg)
      } else {
        const trayIcon = await getDefaultTrayIcon()
        tray.setImage(trayIcon)
      }
    }
  })

  mainWindow.on('close', (e) => {
    if (!app.isPackaged) {
      isQuitting = true
      app.quit()
    }
    if (!isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  void startWhatsAppLoad()

  return mainWindow
}

function setupTrayContextMenu(mainWindow: BrowserWindow, tray: Tray) {
  const windowVisible = mainWindow.isVisible()
  const contextMenu = Menu.buildFromTemplate([
    {
      label: windowVisible ? 'Hide' : 'Show',
      click: () => (windowVisible ? mainWindow.hide() : mainWindow.show())
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)
}

async function setupTray(mainWindow: BrowserWindow) {
  const trayIcon = await getDefaultTrayIcon()
  tray = new Tray(trayIcon)
  setupTrayContextMenu(mainWindow, tray)
  tray.setToolTip('WhatsApp')
  tray.on('click', function () {
    if (mainWindow.isVisible()) mainWindow.hide()
    else mainWindow.show()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async function () {
  const mainWindow = await createWindow()

  app.on('second-instance', function () {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Do nothing
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
