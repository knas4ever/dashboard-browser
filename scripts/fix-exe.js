const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const projectRoot = path.join(__dirname, '..');
const electronZip = path.join(projectRoot, 'electron.zip');
const unpackedDir = path.join(projectRoot, 'dist', 'win-unpacked');
const targetExe = path.join(unpackedDir, 'Dashboard-browser.exe');

// Read Electron version dynamically from the installed package — no manual updates needed
const ELECTRON_VERSION = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'node_modules', 'electron', 'package.json'), 'utf8')
).version;
const ELECTRON_FILENAME = `electron-v${ELECTRON_VERSION}-win32-x64.zip`;
const ELECTRON_URL = `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${ELECTRON_FILENAME}`;
const SHASUMS_URL = `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/SHASUMS256.txt`;

if (!fs.existsSync(unpackedDir)) {
    console.log('No dist folder found');
    return;
}

if (fs.existsSync(targetExe)) {
    const version = execSync(`powershell -Command "(Get-Item '${targetExe}').VersionInfo.ProductName"`, { encoding: 'utf8' }).trim();
    if (version === 'Electron') {
        console.log('Exe already original');
        return;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fetchText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'node' } }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchText(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function sha256File(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function verifySha256(filePath) {
    console.log('Fetching SHASUMS256.txt...');
    const shaText = await fetchText(SHASUMS_URL);
    const line = shaText.split('\n').find(l => l.includes(ELECTRON_FILENAME));
    if (!line) throw new Error(`No checksum entry found for ${ELECTRON_FILENAME}`);
    const expected = line.trim().split(/\s+/)[0].toLowerCase();
    console.log(`Expected SHA256: ${expected}`);
    const actual = sha256File(filePath).toLowerCase();
    console.log(`Actual   SHA256: ${actual}`);
    if (actual !== expected) {
        fs.unlinkSync(filePath); // delete bad file so next run re-downloads
        throw new Error(`SHA256 mismatch — download may be corrupt or tampered. Aborting.`);
    }
    console.log('✓ SHA256 verified');
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
    console.log(`Electron version: ${ELECTRON_VERSION}`);

    // If a cached zip exists but is for a different version, delete it
    if (fs.existsSync(electronZip)) {
        const cachedName = path.basename(electronZip);
        // The zip is always named 'electron.zip' so check size heuristic isn't reliable;
        // instead always re-verify checksum on cached file — verifySha256 will delete it if wrong
        console.log('Found cached electron.zip, verifying...');
        try {
            await verifySha256(electronZip);
        } catch (err) {
            console.log('Cached zip failed verification, re-downloading...');
            // verifySha256 already deleted the file on mismatch
        }
    }

    if (!fs.existsSync(electronZip)) {
        console.log(`Downloading original Electron v${ELECTRON_VERSION}...`);
        execSync(
            `powershell -Command "Invoke-WebRequest -Uri '${ELECTRON_URL}' -OutFile '${electronZip}'"`,
            { stdio: 'inherit' }
        );
        await verifySha256(electronZip);
    }

    console.log('Extracting original Electron exe...');
    const tempDir = path.join(projectRoot, 'temp-extract');
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
    fs.mkdirSync(tempDir);

    const sevenZip = path.join(projectRoot, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
    execSync(`"${sevenZip}" x -y -o"${tempDir}" "${electronZip}" electron.exe`, { stdio: 'inherit' });

    fs.copyFileSync(path.join(tempDir, 'electron.exe'), targetExe);
    fs.rmSync(tempDir, { recursive: true });

    console.log('Original exe restored');
})().catch(err => {
    console.error('fix-exe failed:', err.message);
    process.exit(1);
});
