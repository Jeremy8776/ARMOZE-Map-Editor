const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const packageMetadata = require('../package.json');
const { getBundledToolsDir } = require('../extractor-runtime');

test('packaged extractor tools are copied outside app.asar and resolved from resources', () => {
    const extraResources = packageMetadata.build?.extraResources || [];
    assert.ok(
        extraResources.some((entry) => entry?.from === 'tools' && entry?.to === 'tools'),
        'electron-builder must copy tools to resources/tools'
    );

    assert.equal(
        getBundledToolsDir({
            isPackaged: true,
            resourcesPath: 'C:\\Program Files\\ARMOZE\\resources',
            appDir: 'C:\\Program Files\\ARMOZE\\resources\\app.asar'
        }),
        path.join('C:\\Program Files\\ARMOZE\\resources', 'tools')
    );
});

test('development extractor tools resolve from the application directory', () => {
    assert.equal(
        getBundledToolsDir({
            isPackaged: false,
            resourcesPath: 'E:\\project\\node_modules\\electron\\dist\\resources',
            appDir: 'E:\\project'
        }),
        path.join('E:\\project', 'tools')
    );
});
