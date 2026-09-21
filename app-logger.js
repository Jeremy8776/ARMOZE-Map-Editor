const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

const SENSITIVE_KEY = /(password|passwd|token|secret|authorization|cookie|credential|api[_-]?key)/i;
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+)@/gi;
const BEARER_TOKEN = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi;

function sanitizeString(value) {
    return value
        .replace(URL_CREDENTIALS, '$1[REDACTED]@')
        .replace(BEARER_TOKEN, '$1[REDACTED]');
}

function sanitizeValue(value, seen = new WeakSet(), depth = 0) {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: sanitizeString(value.message || ''),
            stack: sanitizeString(value.stack || ''),
            ...(value.code !== undefined ? { code: sanitizeValue(value.code, seen, depth + 1) } : {})
        };
    }

    if (typeof value === 'string') return sanitizeString(value);
    if (value === null || typeof value !== 'object') return value;
    if (depth >= 6) return '[MAX_DEPTH]';
    if (seen.has(value)) return '[CIRCULAR]';

    seen.add(value);
    if (Array.isArray(value)) {
        return value.slice(0, 100).map((entry) => sanitizeValue(entry, seen, depth + 1));
    }

    const result = {};
    for (const [key, entry] of Object.entries(value).slice(0, 100)) {
        result[key] = SENSITIVE_KEY.test(key)
            ? '[REDACTED]'
            : sanitizeValue(entry, seen, depth + 1);
    }
    return result;
}

function normalizeMessage(message) {
    if (typeof message === 'string') return sanitizeString(message);
    return sanitizeString(util.format(message));
}

function createAppLogger({
    logDir,
    fileName = 'main.log',
    maxBytes = 5 * 1024 * 1024
}) {
    if (!logDir) throw new Error('A log directory is required.');

    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, fileName);
    const archivePath = path.join(logDir, fileName.replace(/\.log$/i, '') + '.1.log');

    function rotateIfNeeded(nextEntryBytes) {
        const currentSize = fs.statSync(logPath, { throwIfNoEntry: false })?.size || 0;
        if (currentSize === 0 || currentSize + nextEntryBytes <= maxBytes) return;

        fs.rmSync(archivePath, { force: true });
        fs.renameSync(logPath, archivePath);
    }

    function write(level, scope, message, details) {
        const timestamp = new Date().toISOString();
        const safeLevel = String(level || 'INFO').toUpperCase();
        const safeScope = normalizeMessage(scope || 'app');
        const safeMessage = normalizeMessage(message || '');
        let suffix = '';

        if (details !== undefined) {
            try {
                suffix = ` ${JSON.stringify(sanitizeValue(details))}`;
            } catch {
                suffix = ' "[UNSERIALIZABLE_DETAILS]"';
            }
        }

        const entry = `${timestamp} [${safeLevel}] [${safeScope}] ${safeMessage}${suffix}\n`;
        rotateIfNeeded(Buffer.byteLength(entry));
        fs.appendFileSync(logPath, entry, 'utf8');
    }

    return {
        debug: (scope, message, details) => write('DEBUG', scope, message, details),
        info: (scope, message, details) => write('INFO', scope, message, details),
        warn: (scope, message, details) => write('WARN', scope, message, details),
        error: (scope, message, details) => write('ERROR', scope, message, details),
        getPath: () => logPath,
        getDirectory: () => logDir
    };
}

function createNoopLogger() {
    return {
        debug() {},
        info() {},
        warn() {},
        error() {},
        getPath: () => '',
        getDirectory: () => ''
    };
}

function installConsoleCapture(logger) {
    const originals = {};
    for (const level of ['warn', 'error']) {
        originals[level] = console[level].bind(console);
        console[level] = (...args) => {
            const message = util.format(...args);
            logger[level]('console', message);
            originals[level](...args);
        };
    }

    return () => {
        for (const [level, original] of Object.entries(originals)) {
            console[level] = original;
        }
    };
}

module.exports = {
    createAppLogger,
    createNoopLogger,
    installConsoleCapture,
    sanitizeValue
};
