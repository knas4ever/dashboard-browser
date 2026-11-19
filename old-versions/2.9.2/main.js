const { app, BrowserWindow, WebContentsView, ipcMain, session } = require('electron')
const path = require('path')
const fs = require('fs')

// Keep the pre-rename data folder so existing notes and sessions are preserved
app.setPath('userData', path.join(app.getPath('appData'), 'webpage-notes-dashboard'))

let mainWin = null

// ── WebContentsView management ────────────────────────────────────────────────
// cardId -> { view: WebContentsView, ready: bool }
const cardViews = new Map()

// ── Validators ────────────────────────────────────────────────────────────────

function validateStoreName(name) {
  if (typeof name !== 'string') return false
  if (!/^[a-zA-Z0-9_\-.]+$/.test(name)) return false
  const full = path.resolve(app.getPath('userData'), name)
  return full.startsWith(app.getPath('userData') + path.sep)
}

function validateStorePrefix(prefix) {
  return typeof prefix === 'string' && /^[a-zA-Z0-9_\-.]*$/.test(prefix)
}

function validateUrl(url) {
  if (typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return ['http:', 'https:', 'file:'].includes(u.protocol)
  } catch { return false }
}

// ── Thumbnail helper ──────────────────────────────────────────────────────────

function toThumbnail(image, thumbW) {
  const size = image.getSize()
  if (!size.width || !size.height) return null
  const scale = thumbW / size.width
  const scaledH = Math.max(1, Math.round(size.height * scale))
  const dataUrl = image.resize({ width: thumbW, height: scaledH, quality: 'better' }).toDataURL()
  if (dataUrl.length < 1000) return null
  return dataUrl
}

// ── Toolbar height (must match #detail-toolbar height in index.html) ──────────
const TOOLBAR_H = 49
// ── Slideshow bar height (must match #ss-bar height in index.html) ────────────
const SS_BAR_H = 44

function getContentBounds() {
  if (!mainWin) return { x: 0, y: 0, width: 1280, height: 800 }
  const [w, h] = mainWin.getContentSize()
  return { x: 0, y: 0, width: w, height: h }
}

function viewBoundsForDetail() {
  const b = getContentBounds()
  return { x: b.x, y: b.y + TOOLBAR_H, width: b.width, height: b.height - TOOLBAR_H }
}

function viewBoundsFullscreen() {
  return getContentBounds()
}

function viewBoundsForSlideshow() {
  const b = getContentBounds()
  return { x: b.x, y: b.y + SS_BAR_H, width: b.width, height: b.height - SS_BAR_H }
}

// ── View lifecycle ────────────────────────────────────────────────────────────

function partitionForCard(cardId) {
  return `persist:card-${cardId}`
}

function ensureView(cardId, url) {
  if (cardViews.has(cardId)) return cardViews.get(cardId)

  // Apply header stripping for this card's partition
  const partition = partitionForCard(cardId)
  const ses = session.fromPartition(partition)
  ses.webRequest.onHeadersReceived((details, callback) => {
    const h = { ...details.responseHeaders }
    delete h['x-frame-options']; delete h['X-Frame-Options']
    delete h['content-security-policy']; delete h['Content-Security-Policy']
    callback({ responseHeaders: h })
  })

  const view = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition,                        // persist:card-{id} — survives restarts
      backgroundThrottling: false,
    }
  })

  const entry = { view, ready: false }
  cardViews.set(cardId, entry)

  view.webContents.on('did-stop-loading', () => { entry.ready = true })
  view.webContents.on('did-finish-load',  () => { entry.ready = true })

  // Start off-screen at full window size — keeps compositor rendering the page
  view.setBounds(offScreenBounds())
  mainWin.contentView.addChildView(view)

  view.webContents.loadURL(url)
  return entry
}

function destroyView(cardId) {
  const entry = cardViews.get(cardId)
  if (!entry) return
  try {
    mainWin.contentView.removeChildView(entry.view)
    entry.view.webContents.close()
  } catch(e) {}
  cardViews.delete(cardId)
}

function offScreenBounds() {
  const b = getContentBounds()
  return { x: -b.width - 100, y: -b.height - 100, width: b.width, height: b.height }
}

function showView(cardId, bounds) {
  cardViews.forEach((entry, id) => {
    if (id === cardId) {
      entry.view.setBounds(bounds)
    } else {
      entry.view.setBounds(offScreenBounds())
    }
  })
}

function hideAllViews() {
  const ob = offScreenBounds()
  cardViews.forEach(entry => {
    entry.view.setBounds(ob)
  })
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    titleBarStyle: 'hiddenInset', backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  })

  // On resize: update all views — visible one gets new bounds, off-screen ones get new off-screen bounds
  mainWin.on('resize', () => {
    const ob = offScreenBounds()
    cardViews.forEach(entry => {
      const b = entry.view.getBounds()
      if (b.x < 0 || b.y < 0) entry.view.setBounds(ob)
    })
  })

  mainWin.loadFile('index.html')
  mainWin.on('closed', () => { mainWin = null })
}

// ── IPC: view management ──────────────────────────────────────────────────────

ipcMain.handle('view-ensure', (event, { cardId, url }) => {
  if (!Number.isInteger(cardId) || cardId <= 0) return false
  if (!validateUrl(url)) return false
  ensureView(cardId, url)
  return true
})

ipcMain.handle('view-destroy', (event, { cardId }) => {
  if (!Number.isInteger(cardId) || cardId <= 0) return false
  destroyView(cardId)
  return true
})

ipcMain.handle('view-show-detail', (event, { cardId }) => {
  if (!cardViews.has(cardId)) return false
  showView(cardId, viewBoundsForDetail())
  return true
})

ipcMain.handle('view-show-fullscreen', (event, { cardId }) => {
  if (!cardViews.has(cardId)) return false
  showView(cardId, viewBoundsFullscreen())
  return true
})

ipcMain.handle('view-show-slideshow', (event, { cardId }) => {
  if (!cardViews.has(cardId)) return false
  showView(cardId, viewBoundsForSlideshow())
  return true
})

ipcMain.handle('view-hide-all', () => {
  hideAllViews()
  return true
})

ipcMain.handle('view-resize', (event, { cardId, mode }) => {
  if (!cardViews.has(cardId)) return false
  if (typeof mode !== 'string') return false
  const bounds = mode === 'fullscreen' ? viewBoundsFullscreen()
               : mode === 'slideshow'  ? viewBoundsForSlideshow()
               : viewBoundsForDetail()
  showView(cardId, bounds)
  return true
})

ipcMain.handle('view-go-back', (event, { cardId }) => {
  if (!Number.isInteger(cardId) || cardId <= 0) return false
  const entry = cardViews.get(cardId)
  if (!entry) return false
  if (entry.view.webContents.canGoBack()) entry.view.webContents.goBack()
  return true
})

ipcMain.handle('view-go-forward', (event, { cardId }) => {
  if (!Number.isInteger(cardId) || cardId <= 0) return false
  const entry = cardViews.get(cardId)
  if (!entry) return false
  if (entry.view.webContents.canGoForward()) entry.view.webContents.goForward()
  return true
})

ipcMain.handle('view-nav-state', (event, { cardId }) => {
  if (!Number.isInteger(cardId) || cardId <= 0) return { canGoBack: false, canGoForward: false, url: '' }
  const entry = cardViews.get(cardId)
  if (!entry) return { canGoBack: false, canGoForward: false, url: '' }
  return {
    canGoBack:    entry.view.webContents.canGoBack(),
    canGoForward: entry.view.webContents.canGoForward(),
    url:          entry.view.webContents.getURL()
  }
})

ipcMain.handle('view-reload', (event, { cardId }) => {
  if (!Number.isInteger(cardId) || cardId <= 0) return false
  const entry = cardViews.get(cardId)
  if (!entry) return false
  entry.ready = false
  entry.view.webContents.reload()
  return true
})

ipcMain.handle('view-navigate', (event, { cardId, url }) => {
  if (!validateUrl(url)) return false
  const entry = cardViews.get(cardId)
  if (!entry) return false
  entry.ready = false
  entry.view.webContents.loadURL(url)
  return true
})

ipcMain.handle('view-is-ready', (event, { cardId }) => {
  const entry = cardViews.get(cardId)
  return entry ? entry.ready : false
})

ipcMain.handle('view-get-scroll', async (event, { cardId }) => {
  const entry = cardViews.get(cardId)
  if (!entry) return null
  try {
    return await entry.view.webContents.executeJavaScript('({x:window.scrollX,y:window.scrollY})')
  } catch { return null }
})

ipcMain.handle('view-set-scroll', async (event, { cardId, x, y }) => {
  if (!Number.isInteger(cardId) || cardId <= 0) return false
  const entry = cardViews.get(cardId)
  if (!entry) return false
  const sx = Number.isFinite(+x) ? Math.floor(+x) : 0
  const sy = Number.isFinite(+y) ? Math.floor(+y) : 0
  try {
    await entry.view.webContents.executeJavaScript(`window.scrollTo(${sx},${sy})`)
    return true
  } catch { return false }
})

// ── Capture queue — serializes captures so only one view is on-screen at a time ──
let captureQueue = Promise.resolve()

ipcMain.handle('view-capture', async (event, { cardId, w, dpr }) => {
  const entry = cardViews.get(cardId)
  if (!entry) return null
  // Chain onto the queue so captures run one at a time
  const result = captureQueue.then(async () => {
    const b = entry.view.getBounds()
    const isOffScreen = b.x < 0 || b.y < 0
    try {
      // Temporarily move off-screen views on-screen so compositor renders them
      if (isOffScreen) entry.view.setBounds(viewBoundsForDetail())
      entry.view.webContents.invalidate()
      // Off-screen views need longer for compositor to paint; visible views need minimal delay
      await new Promise(r => setTimeout(r, isOffScreen ? 500 : 150))
      const image = await entry.view.webContents.capturePage()
      if (!image.getSize().width) return null
      return toThumbnail(image, Math.round(w * (dpr || 1)))
    } catch { return null }
    finally {
      // Always restore off-screen position regardless of success or error
      if (isOffScreen) entry.view.setBounds(offScreenBounds())
    }
  })
  captureQueue = result.then(() => {}, () => {})
  return result
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ── IPC: persistent file storage ──────────────────────────────────────────────

const STORE_QUOTA_BYTES = 500 * 1024 * 1024 // 500 MB total

async function getStoreSizeBytes() {
  try {
    const dir = app.getPath('userData')
    const files = await fs.promises.readdir(dir)
    const sizes = await Promise.all(files.map(f =>
      fs.promises.stat(path.join(dir, f)).then(s => s.size).catch(() => 0)
    ))
    return sizes.reduce((a, b) => a + b, 0)
  } catch { return 0 }
}

function dataPath(name) { return path.join(app.getPath('userData'), name) }

ipcMain.handle('store-read', (event, name) => {
  if (!validateStoreName(name)) return null
  try { const p = dataPath(name); if (!fs.existsSync(p)) return null; return fs.readFileSync(p, 'utf8') }
  catch(e) { return null }
})

ipcMain.handle('store-write', async (event, name, data) => {
  if (!validateStoreName(name)) return false
  const size = await getStoreSizeBytes()
  if (size > STORE_QUOTA_BYTES) return false
  try { fs.writeFileSync(dataPath(name), data, 'utf8'); return true } catch(e) { return false }
})

ipcMain.handle('store-delete', (event, name) => {
  if (!validateStoreName(name)) return false
  try { const p = dataPath(name); if (fs.existsSync(p)) fs.unlinkSync(p); return true } catch(e) { return false }
})

ipcMain.handle('store-list', (event, prefix) => {
  if (!validateStorePrefix(prefix)) return []
  try { return fs.readdirSync(app.getPath('userData')).filter(f => f.startsWith(prefix)) } catch(e) { return [] }
})
