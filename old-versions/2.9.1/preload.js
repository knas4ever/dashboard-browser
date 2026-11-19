const { contextBridge, ipcRenderer } = require('electron')

// ── Argument validators ───────────────────────────────────────────────────────

function isPositiveInt(v)  { return Number.isInteger(v) && v > 0 }
function isPositiveNum(v)  { return typeof v === 'number' && v > 0 && isFinite(v) }
function isSafeName(v)     { return typeof v === 'string' && /^[a-zA-Z0-9_\-.]+$/.test(v) && v.length < 200 }
function isSafePrefix(v)   { return typeof v === 'string' && /^[a-zA-Z0-9_\-.]*$/.test(v) && v.length < 200 }
function isSafeString(v)   { return typeof v === 'string' && v.length <= 10_000_000 }
function isSafeUrl(v) {
  if (typeof v !== 'string') return false
  try { return ['http:', 'https:', 'file:'].includes(new URL(v).protocol) } catch { return false }
}

// ── Exposed API ───────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {

  // View management (replaces webview tag)
  viewEnsure:          (cardId, url)        => isPositiveInt(cardId) && isSafeUrl(url) ? ipcRenderer.invoke('view-ensure', { cardId, url }) : Promise.resolve(false),
  viewDestroy:         (cardId)             => isPositiveInt(cardId) ? ipcRenderer.invoke('view-destroy',          { cardId }) : Promise.resolve(false),
  viewShowDetail:      (cardId)             => isPositiveInt(cardId) ? ipcRenderer.invoke('view-show-detail',      { cardId }) : Promise.resolve(false),
  viewShowFullscreen:  (cardId)             => isPositiveInt(cardId) ? ipcRenderer.invoke('view-show-fullscreen',  { cardId }) : Promise.resolve(false),
  viewShowSlideshow:   (cardId)             => isPositiveInt(cardId) ? ipcRenderer.invoke('view-show-slideshow',   { cardId }) : Promise.resolve(false),
  viewHideAll:         ()                   => ipcRenderer.invoke('view-hide-all'),
  viewResize:          (cardId, mode)       => isPositiveInt(cardId) && typeof mode === 'string' ? ipcRenderer.invoke('view-resize', { cardId, mode }) : Promise.resolve(false),
  viewReload:          (cardId)             => isPositiveInt(cardId) ? ipcRenderer.invoke('view-reload',           { cardId }) : Promise.resolve(false),
  viewGoBack:          (cardId)             => isPositiveInt(cardId) ? ipcRenderer.invoke('view-go-back',          { cardId }) : Promise.resolve(false),
  viewGoForward:       (cardId)             => isPositiveInt(cardId) ? ipcRenderer.invoke('view-go-forward',       { cardId }) : Promise.resolve(false),
  viewNavState:        (cardId)             => isPositiveInt(cardId) ? ipcRenderer.invoke('view-nav-state',        { cardId }) : Promise.resolve({ canGoBack: false, canGoForward: false, url: '' }),
  viewNavigate:        (cardId, url)        => isPositiveInt(cardId) && isSafeUrl(url) ? ipcRenderer.invoke('view-navigate', { cardId, url }) : Promise.resolve(false),
  viewIsReady:         (cardId)             => isPositiveInt(cardId) ? ipcRenderer.invoke('view-is-ready',         { cardId }) : Promise.resolve(false),
  viewGetScroll:       (cardId)             => isPositiveInt(cardId) ? ipcRenderer.invoke('view-get-scroll',       { cardId }) : Promise.resolve(null),
  viewSetScroll:       (cardId, x, y)       => isPositiveInt(cardId) ? ipcRenderer.invoke('view-set-scroll',       { cardId, x, y }) : Promise.resolve(false),
  viewCapture:         (cardId, w, dpr)     => isPositiveInt(cardId) && isPositiveNum(w) && isPositiveNum(dpr) ? ipcRenderer.invoke('view-capture', { cardId, w, dpr }) : Promise.resolve(null),

  // File storage
  storeRead:   (name)       => isSafeName(name)                       ? ipcRenderer.invoke('store-read',   name)       : Promise.resolve(null),
  storeWrite:  (name, data) => isSafeName(name) && isSafeString(data) ? ipcRenderer.invoke('store-write',  name, data) : Promise.resolve(false),
  storeDelete: (name)       => isSafeName(name)                       ? ipcRenderer.invoke('store-delete', name)       : Promise.resolve(false),
  storeList:   (prefix)     => isSafePrefix(prefix)                   ? ipcRenderer.invoke('store-list',   prefix)     : Promise.resolve([]),
})
