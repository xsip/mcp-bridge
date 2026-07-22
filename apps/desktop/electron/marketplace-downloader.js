const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const unzipper = require('unzipper');

const SETTINGS_FILE = 'mcp-bridge-marketplace-settings.json';
const MANIFEST_FILE = 'mcp-bridge-downloaded-mcps.json';

function noop() {
  /* no progress callback provided */
}

/** Replaces anything that isn't safe in a filename/folder name with "-". */
function sanitizeForPath(value) {
  return value.replace(/[^a-zA-Z0-9-_.]/g, '-');
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

/**
 * Owns everything filesystem-related for the marketplace feature — the
 * download directory setting, downloading a version's zip with progress,
 * unzipping it, deleting the zip afterwards, and the small manifest of
 * what's been installed (used later for a "Downloaded MCPs" / update-check
 * tab). Lives in the Electron main process since none of this is possible
 * from the sandboxed renderer — see preload.js / marketplace-fs.service.ts.
 */
class MarketplaceDownloader {
  constructor(onProgress) {
    this.onProgress = onProgress || noop;
    this.settingsPath = path.join(app.getPath('userData'), SETTINGS_FILE);
    this.manifestPath = path.join(app.getPath('userData'), MANIFEST_FILE);
  }

  getSettings() {
    return readJson(this.settingsPath, { downloadDirectory: null });
  }

  /** Opens a native directory picker and persists the chosen path. Returns null if the user cancelled. */
  async pickDownloadDirectory(mainWindow) {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const downloadDirectory = result.filePaths[0];
    writeJson(this.settingsPath, { downloadDirectory });
    return downloadDirectory;
  }

  /**
   * Returns the manifest, first dropping any entry whose `installPath` no
   * longer exists on disk (e.g. the user deleted the folder by hand outside
   * the app) and persisting that prune — so "installed" always reflects
   * what's actually there, not just what we once wrote.
   */
  listDownloadedMcps() {
    const manifest = readJson(this.manifestPath, []);
    const stillInstalled = manifest.filter((entry) => fs.existsSync(entry.installPath));
    if (stillInstalled.length !== manifest.length) {
      writeJson(this.manifestPath, stillInstalled);
    }
    return stillInstalled;
  }

  /**
   * Downloads the zip at `downloadUrl` (a single-use marketplace download
   * link — see `MarketplaceService.consumeDownloadToken` on the backend),
   * unzips it into `<downloadDirectory>/<itemName>-<version>`, deletes the
   * zip, and records `{ itemId, publisher, version, installPath }` in the
   * manifest. Reports `{ itemId, phase: 'download' | 'unpacking', progress }`
   * (0-100, or -1 if indeterminate) via `onProgress` as it goes.
   */
  async downloadAndInstall({ downloadUrl, accessToken, itemId, itemName, publisher, version }) {
    const { downloadDirectory } = this.getSettings();
    if (!downloadDirectory) {
      throw new Error('No download directory configured — set one in Settings first.');
    }

    const folderName = sanitizeForPath(`${itemName}-${version}`);
    const targetDir = path.join(downloadDirectory, folderName);
    const zipPath = path.join(downloadDirectory, `${folderName}.zip`);

    try {
      await this.download(downloadUrl, accessToken, zipPath, itemId);
      await this.unzip(zipPath, targetDir, itemId);
      fs.unlinkSync(zipPath);
      this.recordInstall({ itemId, itemName, publisher, version, installPath: targetDir });
      this.onProgress({ itemId, phase: 'done', progress: 100 });
      return { installPath: targetDir };
    } catch (error) {
      this.onProgress({ itemId, phase: 'error', progress: 0, message: error instanceof Error ? error.message : String(error) });
      // Best-effort cleanup of a partial download — don't leave a broken zip behind.
      fs.rm(zipPath, { force: true }, () => undefined);
      throw error;
    }
  }

  async download(downloadUrl, accessToken, zipPath, itemId) {
    const response = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed (HTTP ${response.status})`);
    }

    const total = Number(response.headers.get('content-length')) || 0;
    let received = 0;

    const source = Readable.fromWeb(response.body);
    source.on('data', (chunk) => {
      received += chunk.length;
      const progress = total > 0 ? Math.round((received / total) * 100) : -1;
      this.onProgress({ itemId, phase: 'download', progress });
    });

    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    await pipeline(source, fs.createWriteStream(zipPath));
    this.onProgress({ itemId, phase: 'download', progress: 100 });
  }

  async unzip(zipPath, targetDir, itemId) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });

    const directory = await unzipper.Open.file(zipPath);
    const total = directory.files.length || 1;

    for (let i = 0; i < directory.files.length; i++) {
      const entry = directory.files[i];
      const destPath = path.join(targetDir, entry.path);

      if (entry.type === 'Directory') {
        fs.mkdirSync(destPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        await pipeline(entry.stream(), fs.createWriteStream(destPath));
      }

      this.onProgress({ itemId, phase: 'unpacking', progress: Math.round(((i + 1) / total) * 100) });
    }
  }

  recordInstall({ itemId, itemName, publisher, version, installPath }) {
    const manifest = this.listDownloadedMcps().filter((entry) => entry.itemId !== itemId);
    manifest.push({ itemId, itemName, publisher, version, installPath, downloadedAt: new Date().toISOString() });
    writeJson(this.manifestPath, manifest);
  }

  /** Deletes an installed item's folder from disk and drops its manifest entry. No-op if it isn't installed. */
  uninstall(itemId) {
    const manifest = this.listDownloadedMcps();
    const entry = manifest.find((candidate) => candidate.itemId === itemId);
    if (!entry) return;

    fs.rmSync(entry.installPath, { recursive: true, force: true });
    writeJson(this.manifestPath, manifest.filter((candidate) => candidate.itemId !== itemId));
  }
}

module.exports = { MarketplaceDownloader };
