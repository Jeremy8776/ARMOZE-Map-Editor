const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('main process persists lifecycle, renderer, and extractor diagnostics', () => {
    const source = readProjectFile('main.js');

    assert.match(source, /createAppLogger/);
    assert.match(source, /app\.getPath\('userData'\).*['"]logs['"]/s);
    assert.match(source, /process\.on\('uncaughtException'/);
    assert.match(source, /process\.on\('unhandledRejection'/);
    assert.match(source, /ipcMain\.on\('renderer-log'/);
    assert.match(source, /ipcMain\.handle\('open-logs-folder'/);
    assert.match(source, /logger\.info\('extractor',\s*'Extraction requested'/);
    assert.match(source, /logger\.error\('extractor',\s*'Extractor process failed'/);
    assert.match(source, /logger\.info\('extractor',\s*'Extractor process exited'/);
});

test('preload forwards renderer failures and exposes the logs folder', () => {
    const source = readProjectFile('preload.js');

    assert.match(source, /window\.addEventListener\('error'/);
    assert.match(source, /window\.addEventListener\('unhandledrejection'/);
    assert.match(source, /ipcRenderer\.send\('renderer-log'/);
    assert.match(source, /openLogsFolder:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('open-logs-folder'\)/);
});

test('extractor error state offers an open logs action', () => {
    const viewSource = readProjectFile('js/ui/map-extractor-view.js');
    const uiSource = readProjectFile('js/ui/map-extractor-ui.js');

    assert.match(viewSource, /id="btnOpenExtractorLogs"/);
    assert.match(uiSource, /btnOpenExtractorLogs/);
    assert.match(uiSource, /openLogsFolder/);
    assert.match(uiSource, /logsButton\.style\.display\s*=\s*'flex'/);
});
