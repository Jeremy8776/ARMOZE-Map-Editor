const path = require('path');

/**
 * Resolve extractor executables from a real filesystem directory.
 * Packaged Electron app contents live in app.asar, which external
 * PowerShell processes cannot read as a normal directory.
 */
function getBundledToolsDir({ isPackaged, resourcesPath, appDir }) {
    return isPackaged
        ? path.join(resourcesPath, 'tools')
        : path.join(appDir, 'tools');
}

module.exports = { getBundledToolsDir };
