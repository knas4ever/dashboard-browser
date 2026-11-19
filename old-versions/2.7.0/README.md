# Webpage Notes Dashboard

**Version 2.7.0** | A desktop app to browse webpages with notes, built with Electron.

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.7.0 | 2026-08-20 | **Security:** Updated Electron from 41.3.0 to 41.10.6, which bundles Node.js 24.18.1 and fixes CVE-2026-56846 and CVE-2026-56848; disabled Electron Builder executable editing to preserve the original Electron binary. |
| 2.6.7 | 2026-04-30 | **Security:** Removed duplicate `path`/`path2` require; added `cardId` integer validation to `view-go-back`, `view-go-forward`, `view-nav-state`, `view-reload`, `view-set-scroll`; hardened `view-set-scroll` scroll values with `Math.floor`+`isFinite`; added `mode` string validation to `viewResize` in preload; made `getStoreSizeBytes` async to avoid blocking main process |
| 2.6.6 | 2026-04-30 | **Fix:** `view-capture` uses `finally` to guarantee view moves back off-screen after capture |
| 2.5.5 | 2026-04-29 | **Fix:** `settleMs` now applied inside `view-capture` in main process after `setBounds`/`invalidate` — this is the correct place for it so the compositor fully paints before the screenshot is taken; `waitAndCapture` no longer delays, settle only applies to hidden views being shown for capture |
| 2.5.4 | 2026-04-29 | **Fix:** Each reload-mode card is now a fully independent job — reloads in parallel, polls ready, waits `settleMs`, captures, then hides its own view immediately; no more shared `Promise.allSettled` causing last card to stay visible |
| 2.5.3 | 2026-04-29 | **Fix:** Reload-mode cards now wait `settleMs` after page ready before capturing screenshot; Refresh All now calls `hideAllViews()` after all captures complete so the last card's view no longer stays visible over the dashboard |
| 2.5.2 | 2026-04-29 | **Fix:** Reload-mode cards now correctly re-poll `viewIsReady` after reload before capturing — previously `viewReady` was never reset back to `true` after a reload so `waitAndCapture` polled forever and never took a screenshot |
| 2.5.1 | 2026-04-29 | **Fix:** Refresh All now uses only `viewCapture` (never `captureURL`); slideshow bar (`#ss-bar`) now visible — `WebContentsView` offset by `SS_BAR_H` so toolbar is not obscured; slideshow displays already-running views, no reload |
| 2.5.0 | 2026-04-28 | **v2.5:** Migrated from deprecated `<webview>` tag to `WebContentsView` API; each card gets a named `persist:card-{id}` session partition so page state (logins, checkboxes, filters) survives app restarts; removed `#titlebar` "Dashboard" bar to reclaim vertical space; added ↺ refresh button in detail/fullscreen view |
| 2.4.1 | 2026-04-22 | **Security:** SHA256 checksum verification added to `fix-exe.js`; Electron version updated to v41 |
| 2.4.0 | 2026-04-22 | **Security hardening:** CSP added; path traversal protection on all store IPC handlers; URL validation blocking `javascript:`/`data:` URIs; webview partition scoped; `captureWindows` migrated to `Map`; trusted webview ID allowlist; sandbox enabled on all BrowserWindows; all card rendering migrated from `innerHTML` to DOM APIs; inline `onclick` attributes replaced with `addEventListener`; `localStorage` cache removed; `file://` URLs require confirmation; `platform` removed from preload API |
| 2.3 | 2026-04-17 | **Build fix:** Replaced `electron.exe` with original after build to bypass SmartScreen blocking on non-Developer PCs |
| 2.2 | - | Previous stable build |
| 2.1 | - | Previous build |
| 2.0 | - | Initial release |

## Known Issues & Fixes

| Issue | Cause | Solution |
|-------|-------|----------|
| "Windows cannot access the specified device, path, or file" error on target PCs without Developer Mode enabled | `rcedit-x64.exe` (used by electron-builder) modifies the Electron exe, causing Windows SmartScreen to block it | Build script downloads original Electron exe and replaces modified one via `npm run fix-exe` |
| Build fails with "Cannot create symbolic link" error | `winCodeSign` archive contains macOS symlinks that cannot be extracted without Developer Mode | `fix-exe.js` only extracts Windows binaries from the archive |
| Exe has wrong version info (shows app name instead of "Electron") | `rcedit` patches the exe metadata regardless of config | Original exe is restored post-build |
| Build fails with "Invalid version" error | `electron-builder` requires full semver (e.g. `2.5.0`), not shorthand (`2.5`) | Always use three-part version numbers in `package.json` |

## Build Instructions

### Prerequisites
- [Node.js](https://nodejs.org) v18 or later

### Build Steps
```bash
# 1. Install dependencies
npm install

# 2. Build portable app
npm run dist

# 3. Output location
#    dist/win-unpacked/
```

### Build Output
- **Location:** `dist/win-unpacked/`
- **Executable:** `dist/win-unpacked/Webpage Notes Dashboard.exe`
- **Distribution:** Copy the entire `win-unpacked` folder to target PCs

### Build Scripts

| Command | Description |
|---------|-------------|
| `npm run dist` | Full build: compiles app, downloads original Electron exe, replaces modified exe |
| `npm run build` | Compile only (without exe fix) |
| `npm run fix-exe` | Download and replace exe with original Electron binary |

## Run in Dev Mode

```bash
npm start
```

## How to Use

- **Add a page** — paste a URL and press Enter
- **Card previews** — real screenshots, fully rendered including JS and images
- **Refresh** — set auto-refresh interval in the toolbar, or click ↺ on any card
- **View full page** — click a card to open it in a full browser view
- **Refresh current page** — click ↺ in the detail toolbar to reload the active page
- **Notes** — type in the note field; saves automatically
- **Back** — click ← Back to return to the grid (refreshes that card's screenshot)
- **Page state** — logins, checkboxes, and filter selections are remembered across app restarts per card

## Technical Notes

### Session Persistence (v2.5)

Each card gets its own named Electron session partition (`persist:card-{id}`). Electron persists cookies, localStorage, IndexedDB, and cache for named partitions to disk in the app's userData folder. This means when the app restarts, each page loads in the same session it was last in — no re-login required, and any state the site saves to browser storage is intact.

### Why the Exe Fix is Necessary

`electron-builder` uses `rcedit-x64.exe` to modify the Electron exe metadata. This changes the exe binary, causing Windows SmartScreen to flag it as untrusted on PCs without Developer Mode. The workaround downloads the original unmodified Electron exe and replaces the modified one after building.

### Why Not Code Signing?

Code signing (Authenticode) would eliminate SmartScreen warnings permanently, but requires a certificate (~$200-400/year). For internal or personal use, the exe replacement workaround is sufficient.
