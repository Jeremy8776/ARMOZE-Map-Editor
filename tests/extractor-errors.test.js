const test = require('node:test');
const assert = require('node:assert/strict');

// The service attaches itself to window when loaded in the renderer; in tests
// we provide a stub before loading the script.
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
require('../js/services/map-extractor-service.js');

const Service = global.window.MapExtractorService;

test('exit code 2 with no PAK match explains the search problem', () => {
    const msg = Service.explainExtractorError('Failed to run extraction: Error invoking remote method: Exit code 2 | No PAK entry matched');
    assert.match(msg, /No file matching your search/i);
    assert.doesNotMatch(msg, /Exit code/);
});

test('exit code 3 explains conversion and save failures', () => {
    assert.match(Service.explainExtractorError('Failed to run extraction: Exit code 3'), /could not be converted or saved/i);
});

test('exit code 4 suggests a different output format', () => {
    assert.match(Service.explainExtractorError('Exit code 4'), /different output format/i);
});

test('the packaged-build spawn failure code is explained', () => {
    const msg = Service.explainExtractorError('Failed to run extraction: Exit code 4294770688');
    assert.match(msg, /could not be started/i);
});

test('input validation errors are translated', () => {
    assert.match(Service.explainExtractorError('Error: Scan directory does not exist.'), /scan directory does not exist/i);
    assert.match(Service.explainExtractorError('A search term is required.'), /resource path/i);
    assert.match(Service.explainExtractorError('A filter extension is required.'), /extension/i);
});

test('unrecognised errors fall back to the raw message', () => {
    assert.equal(Service.explainExtractorError('Exit code 5'), null);
    assert.equal(Service.explainExtractorError(''), null);
    assert.equal(Service.explainExtractorError(undefined), null);
});

test('executeExtraction rethrows with the friendly message', async () => {
    const service = new Service({ notificationService: null });
    let captured = null;
    global.window.electronAPI = {
        executeExtractor: async () => { throw new Error('Exit code 2 | No PAK entry matched'); }
    };

    try {
        await service.executeExtraction('map', 'png', 'Search', '');
    } catch (err) {
        captured = err.message;
    }

    global.window.electronAPI = undefined;
    assert.match(captured, /No file matching your search/i);
    assert.doesNotMatch(captured, /Exit code 2/);
});