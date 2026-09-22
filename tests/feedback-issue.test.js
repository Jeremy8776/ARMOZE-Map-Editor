const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGitHubIssueUrl } = require('../feedback-issue');

test('buildGitHubIssueUrl creates a prefilled bug issue with environment details', () => {
    const url = new URL(buildGitHubIssueUrl({
        repositoryPath: 'Jeremy8776/ARMOZE-Map-Editor',
        feedback: {
            type: 'bug',
            title: 'Grid vanishes after zooming',
            description: 'The 100 m grid disappears after zooming back out.',
            steps: '1. Load Belleau\n2. Zoom in\n3. Zoom out',
            mapName: 'C:\\Users\\player\\Maps\\Belleau.png'
        },
        environment: { version: '1.6.38', platform: 'win32', arch: 'x64' }
    }));

    assert.equal(url.origin, 'https://github.com');
    assert.equal(url.pathname, '/Jeremy8776/ARMOZE-Map-Editor/issues/new');
    assert.equal(url.searchParams.get('title'), '[Bug] Grid vanishes after zooming');
    assert.equal(url.searchParams.get('labels'), 'bug');

    const body = url.searchParams.get('body');
    assert.match(body, /## Description\nThe 100 m grid disappears/);
    assert.match(body, /## Steps to reproduce\n1\. Load Belleau/);
    assert.match(body, /ARMOZE version: 1\.6\.38/);
    assert.match(body, /Platform: win32 x64/);
    assert.match(body, /Map: Belleau\.png/);
    assert.doesNotMatch(body, /Users\\player/);
});

test('issue title is forced onto one line before it reaches GitHub', () => {
    const url = new URL(buildGitHubIssueUrl({
        repositoryPath: 'Jeremy8776/ARMOZE-Map-Editor',
        feedback: {
            type: 'bug',
            title: 'Crash on export\n\n## injected heading',
            description: 'Exporting the current project closes the app.'
        },
        environment: {}
    }));

    assert.equal(url.searchParams.get('title'), '[Bug] Crash on export ## injected heading');
    assert.doesNotMatch(url.searchParams.get('title'), /[\r\n]/);
});
