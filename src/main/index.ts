/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  App,
  app,
  BrowserWindow,
  DownloadItem,
  Menu,
  Notification,
  session,
  shell,
  Tray,
  net,
  ipcMain
} from 'electron'
import path, { join } from 'node:path'
import { existsSync } from 'node:fs'
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

function openDownloadedFile(item: DownloadItem, filePath: string) {
  const mime = item.getMimeType()
  if (mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('video/')) {
    shell.openPath(filePath)
  } else {
    shell.showItemInFolder(filePath)
  }
}

async function createWindow() {
  // if (!app.requestSingleInstanceLock()) {
  //   console.log('Application instance is already running. Quitting....')
  //   app.quit()
  // }

  // load config file if exists
  const appConfig = new AppConfig(app)
  config = await appConfig.getConfig()

  Menu.setApplicationMenu(null)

  const appPartition = 'persist:whatsapp'

  const mainWindow = new BrowserWindow({
    width: winBounds.width,
    height: winBounds.height,
    show: true,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      partition: appPartition
    }
  })

  ipcMain.on('retry-load', () => {
    mainWindow.loadURL(WHATSAPP_WEB_URL, {
      userAgent: WHATSAPP_USER_AGENT
    })
  })

  const winSession = session.fromPartition(appPartition)

  winSession.on('will-download', (e, item) => {
    const fileName = item.getFilename()
    const savePath = path.join(app.getPath('downloads'), fileName)

    if (existsSync(savePath)) {
      e.preventDefault()
      openDownloadedFile(item, savePath)
    } else {
      item.setSavePath(savePath)
      item.once('done', (_e, state) => {
        if (state === 'completed') {
          new Notification({
            title: `Download completed`,
            body: `${fileName}`
          }).show()
          openDownloadedFile(item, savePath)
        }
      })
    }
  })

  if (net.isOnline()) {
    mainWindow.loadURL(WHATSAPP_WEB_URL, {
      userAgent: WHATSAPP_USER_AGENT
    })
  }
  //  else {
  //   if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  //     mainWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/offline.html`)
  //   } else {
  //     mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/offline.html`))
  //   }
  // }

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

  setupTray(app, mainWindow)

  mainWindow.on('show', () => {
    setupTrayContextMenu(app, mainWindow, tray)
  })

  mainWindow.on('hide', () => {
    setupTrayContextMenu(app, mainWindow, tray)
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
    console.log(favicons.length)
    if (favicons.length > 0) {
      const newFaviconUrl = favicons[favicons.length - 1]
      if (newFaviconUrl && newFaviconUrl) {
        const unreadCount = getUnreadCountFromFavicon(newFaviconUrl)
        if (unreadCount && unreadCount != '0') {
          const trayNativeImg = await getTrayFavicon(unreadCount)
          tray.setImage(trayNativeImg)
        } else {
          const trayIcon = await getDefaultTrayIcon()
          tray.setImage(trayIcon)
        }
      }
    }
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  return mainWindow
}

function setupTrayContextMenu(app: App, mainWindow: BrowserWindow, tray: Tray) {
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

async function setupTray(app: App, mainWindow: BrowserWindow) {
  const trayIcon = await getDefaultTrayIcon()
  tray = new Tray(trayIcon)
  setupTrayContextMenu(app, mainWindow, tray)
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
