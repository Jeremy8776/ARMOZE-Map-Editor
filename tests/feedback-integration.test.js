const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('main process registers a credential-free GitHub feedback integration', () => {
    const main = read('main.js');
    const integrations = read('desktop-integrations.js');

    assert.match(main, /registerDesktopIntegrations/);
    assert.match(integrations, /require\(['"]\.\/feedback-issue['"]\)/);
    assert.match(integrations, /ipcMain\.handle\(['"]submit-feedback['"]/);
    assert.match(integrations, /buildGitHubIssueUrl/);
    assert.match(integrations, /version:\s*app\.getVersion\(\)/);
    assert.match(integrations, /shell\.openExternal\(url\)/);
});

test('preload exposes structured feedback submission instead of a GitHub token', () => {
    const preload = read('preload.js');
    assert.match(preload, /submitFeedback:\s*\(feedback\)\s*=>\s*ipcRenderer\.invoke\(['"]submit-feedback['"],\s*feedback\)/);
    assert.doesNotMatch(preload, /GITHUB_TOKEN|Authorization:\s*Bearer/i);
});

test('feedback control and UI module are wired into the application', () => {
    const html = read('index.html');
    const app = read('js/app.js');
    const toolbar = read('js/ui/toolbar-ui.js');

    assert.match(html, /id="btnSendFeedback"/);
    assert.match(html, /js\/ui\/feedback-ui\.js/);
    assert.match(app, /new FeedbackUI\(this\)/);
    assert.match(app, /this\.feedbackUI\.init\(\)/);
    assert.match(toolbar, /btnSendFeedback/);
    assert.match(toolbar, /feedbackUI\.show\(\)/);
});
