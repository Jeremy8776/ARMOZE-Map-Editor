const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createAppLogger } = require('../app-logger');

function createTempLogDir() {
    const baseDir = process.env.TMPDIR || os.tmpdir();
    return fs.mkdtempSync(path.join(baseDir, 'armoze-logger-'));
}

test('app logger writes structured entries and redacts secrets', () => {
    const logDir = createTempLogDir();
    const logger = createAppLogger({ logDir, maxBytes: 1024 * 1024 });

    logger.info('extractor', 'Extraction started', {
        action: 'Search',
        token: 'top-secret-token',
        endpoint: 'https://user:password@example.com/archive'
    });

    const output = fs.readFileSync(logger.getPath(), 'utf8');
    assert.match(output, /\[INFO\] \[extractor\] Extraction started/);
    assert.match(output, /"action":"Search"/);
    assert.match(output, /"token":"\[REDACTED\]"/);
    assert.doesNotMatch(output, /top-secret-token/);
    assert.doesNotMatch(output, /user:password@/);
});

test('app logger records errors with their stack and code', () => {
    const logDir = createTempLogDir();
    const logger = createAppLogger({ logDir });
    const error = new Error('Extractor failed');
    error.code = 'EXTRACTOR_FAILURE';

    logger.error('extractor', 'Child process error', error);

    const output = fs.readFileSync(logger.getPath(), 'utf8');
    assert.match(output, /Extractor failed/);
    assert.match(output, /EXTRACTOR_FAILURE/);
    assert.match(output, /"stack":/);
});

test('app logger rotates an oversized active log', () => {
    const logDir = createTempLogDir();
    const logger = createAppLogger({ logDir, maxBytes: 180 });

    logger.info('test', 'First entry', { payload: 'a'.repeat(120) });
    logger.info('test', 'Second entry', { payload: 'b'.repeat(120) });

    assert.equal(fs.existsSync(path.join(logDir, 'main.1.log')), true);
    const activeLog = fs.readFileSync(path.join(logDir, 'main.log'), 'utf8');
    assert.match(activeLog, /Second entry/);
});
