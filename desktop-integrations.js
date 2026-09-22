const { buildGitHubIssueUrl } = require('./feedback-issue');

/**
 * Registers desktop integrations that sit outside the editor itself: update
 * checks, safe outbound release links, and credential-free feedback issues.
 * Keeping these together prevents main.js from becoming another application.
 */
function registerDesktopIntegrations({
    app,
    BrowserWindow,
    ipcMain,
    shell,
    net,
    packageMetadata,
    logger,
    getGitHubRepositoryPath,
    isSafeGitHubReleaseUrl
}) {
    let autoUpdater = null;
    try {
        ({ autoUpdater } = require('electron-updater'));
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.logger = console;
        autoUpdater.disableWebInstaller = false;
        autoUpdater.allowDowngrade = false;
    } catch (error) {
        console.warn('electron-updater not installed; falling back to manual update check.', error.message);
    }

    const sendToRenderer = (channel, payload) => {
        BrowserWindow.getAllWindows()[0]?.webContents.send(channel, payload);
    };

    const startManualGitHubCheck = () => {
        const repositoryPath = getGitHubRepositoryPath();
        const currentVersion = packageMetadata.version;
        const request = net.request(`https://api.github.com/repos/${repositoryPath}/releases/latest`);

        request.on('response', (response) => {
            let body = '';
            response.on('data', (chunk) => { body += chunk; });
            response.on('end', () => {
                try {
                    if (response.statusCode !== 200) return;
                    const data = JSON.parse(body);
                    const latestVersion = data.tag_name.replace('v', '');
                    if (!isNewerVersion(currentVersion, latestVersion)) return;
                    if (!isSafeGitHubReleaseUrl(data.html_url, repositoryPath)) return;

                    sendToRenderer('update-available', {
                        version: latestVersion,
                        url: data.html_url,
                        notes: data.body,
                        canAutoInstall: false
                    });
                } catch (error) {
                    console.error('Update check failed parse:', error);
                }
            });
        });

        request.on('error', (error) => {
            console.error('Update check error:', error);
        });
        request.end();
    };

    let currentCheckFellBack = false;
    let updateListenersWired = false;

    const wireAutoUpdaterListeners = () => {
        if (!autoUpdater || updateListenersWired) return;
        updateListenersWired = true;

        autoUpdater.on('update-available', (info) => {
            const repositoryPath = getGitHubRepositoryPath();
            sendToRenderer('update-available', {
                version: info.version,
                url: `https://github.com/${repositoryPath}/releases/tag/v${info.version}`,
                notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
                canAutoInstall: true
            });
        });

        autoUpdater.on('update-not-available', () => {});
        autoUpdater.on('download-progress', (progress) => {
            sendToRenderer('update-progress', {
                percent: Math.round(progress.percent || 0),
                bytesPerSecond: progress.bytesPerSecond,
                transferred: progress.transferred,
                total: progress.total
            });
        });
        autoUpdater.on('update-downloaded', (info) => {
            sendToRenderer('update-downloaded', { version: info.version });
        });
        autoUpdater.on('error', (error) => {
            console.error('autoUpdater error:', error);
            sendToRenderer('update-error', { message: error?.message || 'Update failed' });
            if (!currentCheckFellBack) {
                currentCheckFellBack = true;
                startManualGitHubCheck();
            }
        });
    };

    const startAutoUpdateCheck = () => {
        if (!autoUpdater) {
            startManualGitHubCheck();
            return;
        }

        wireAutoUpdaterListeners();
        currentCheckFellBack = false;
        const fallback = (reason) => {
            if (currentCheckFellBack) return;
            currentCheckFellBack = true;
            console.warn('electron-updater fallback:', reason);
            startManualGitHubCheck();
        };

        try {
            autoUpdater.checkForUpdates()
                .catch((error) => fallback(error?.message || 'checkForUpdates rejected'));
        } catch (error) {
            fallback(error?.message || 'checkForUpdates threw');
        }
    };

    const updateCheckIntervalMs = 30 * 60 * 1000;
    app.whenReady().then(() => {
        if (!app.isPackaged) return;
        setTimeout(startAutoUpdateCheck, 3000);
        setInterval(startAutoUpdateCheck, updateCheckIntervalMs);
    });

    ipcMain.handle('check-for-updates', async () => {
        if (!app.isPackaged) return { skipped: true, reason: 'dev build' };
        startAutoUpdateCheck();
        return { ok: true };
    });

    ipcMain.handle('submit-feedback', async (event, feedback) => {
        const url = buildGitHubIssueUrl({
            repositoryPath: getGitHubRepositoryPath(),
            feedback,
            environment: {
                version: app.getVersion(),
                platform: process.platform,
                arch: process.arch
            }
        });
        await shell.openExternal(url);
        logger.info('feedback', 'Opened prefilled GitHub issue', { type: feedback?.type || 'general' });
        return { ok: true };
    });

    ipcMain.handle('open-external', async (event, url) => {
        if (!isSafeGitHubReleaseUrl(url, getGitHubRepositoryPath())) {
            throw new Error('Blocked unsafe external URL.');
        }
        await shell.openExternal(url);
    });

    ipcMain.handle('start-update-download', async () => {
        if (!autoUpdater) throw new Error('Auto-updater unavailable in this build.');
        return autoUpdater.downloadUpdate();
    });

    ipcMain.handle('quit-and-install', () => {
        if (!autoUpdater) throw new Error('Auto-updater unavailable in this build.');
        autoUpdater.quitAndInstall(false, true);
    });
}

function isNewerVersion(current, latest) {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    for (let index = 0; index < Math.max(currentParts.length, latestParts.length); index++) {
        const currentPart = currentParts[index] || 0;
        const latestPart = latestParts[index] || 0;
        if (latestPart > currentPart) return true;
        if (latestPart < currentPart) return false;
    }
    return false;
}

module.exports = { registerDesktopIntegrations, isNewerVersion };
