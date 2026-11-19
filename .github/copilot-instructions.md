# Dashboard-browser - Copilot Instructions

## Project context

- Electron desktop app for browsing webpages with notes.
- The current app version is defined in `package.json`; use full three-part semver.
- Key files: `main.js` (main process and `WebContentsView` lifecycle), `preload.js` (validated IPC bridge), `index.html` (renderer UI), and `scripts/fix-exe.js` (post-build Electron executable restoration).

## Before editing

Perform all file reads, edits, builds, backups, and temporary work within this project folder. Do not inspect, modify, or create files outside it.

For every code, script, or configuration change:

1. Create `old-versions/<current-version>/` before editing.
2. Copy `index.html`, `main.js`, `preload.js`, `scripts/`, `package.json`, `README.md`, and this instruction file into it.
3. Do not copy `node_modules/`, `dist/`, or `package-lock.json`.

When releasing a version:

1. Increment patch versions for fixes; increment minor versions for features or security changes.
2. Update the `package.json` version.
3. Add the version, date, and change summary to the `README.md` changelog.
4. Add the same version, date, and a short summary at the top of the `versionHistory` array in `index.html` (shown by the in-app "Version history" button).
5. Update these instructions when project guidance changes.

## Architecture constraints

- Use `WebContentsView`; do not reintroduce the deprecated `<webview>` tag or enable `webviewTag`.
- Preserve the `persist:card-{id}` session partition for each card.
- Keep renderer access to web content behind validated IPC handlers. Do not expose direct web-content access in the renderer.
- Keep `TOOLBAR_H` in `main.js` synchronized with the rendered `#detail-toolbar` height in `index.html` (currently 49px).
- Maintain validation and path-traversal protections in IPC handlers and preload APIs when changing or adding them.

## Dependencies and builds

- Add runtime dependencies with `npm install <package>` and development dependencies with `npm install --save-dev <package>`.
- Use `npm run dist` for a production build. It runs `npm run build` followed by the required `npm run fix-exe`.
- Never modify the built executable directly or use `rcedit`.
- Keep `build.win.signAndEditExecutable` set to `false` so Electron Builder preserves the original Electron executable.
- If `scripts/fix-exe.js` changes, run `npm run fix-exe` and confirm:
  ```powershell
  (Get-Item "dist\win-unpacked\Dashboard-browser.exe").VersionInfo.ProductName
  ```
  The result must be `Electron`.

## Build troubleshooting

| Problem | Resolution |
| --- | --- |
| Target PCs report a Windows access error | Run `npm run fix-exe`. |
| Build fails on a symbolic-link error | Remove `node_modules` and `package-lock.json`, then run `npm install`. |
| Executable metadata is incorrect | Ensure `npm run fix-exe` completed and the ProductName is `Electron`. |
| `electron-builder` rejects the version | Use full semver such as `2.6.7`. |

## Production build acceptance

After `npm run dist`, ensure `dist\win-unpacked\` includes:

- `Dashboard-browser.exe`
- `resources\app.asar`
- an executable whose ProductName is `Electron`

The executable is restored because `electron-builder` metadata edits can cause Windows SmartScreen problems on machines without Developer Mode. The application itself remains packaged in `app.asar`.
