const FEEDBACK_TYPES = Object.freeze({
    bug: { prefix: 'Bug', label: 'bug' },
    feature: { prefix: 'Feature', label: 'enhancement' },
    map: { prefix: 'Map data', label: 'enhancement' },
    general: { prefix: 'Feedback', label: '' }
});

function cleanText(value, maxLength) {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, maxLength);
}

function cleanMapName(value) {
    const cleaned = cleanText(value, 260);
    return cleaned ? cleaned.split(/[\\/]/).pop() : '';
}

function cleanSingleLine(value, maxLength) {
    return cleanText(value, maxLength).replace(/\s+/g, ' ');
}

function assertRepositoryPath(repositoryPath) {
    const cleaned = cleanText(repositoryPath, 200);
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleaned)) {
        throw new Error('Invalid GitHub repository path.');
    }
    return cleaned;
}

function normalizeFeedback(feedback = {}) {
    const type = FEEDBACK_TYPES[feedback.type] ? feedback.type : 'general';
    const title = cleanSingleLine(feedback.title, 120);
    const description = cleanText(feedback.description, 3500);
    const steps = cleanText(feedback.steps, 1800);
    const mapName = cleanMapName(feedback.mapName);

    if (!title) throw new Error('Add a short summary before sending feedback.');
    if (!description) throw new Error('Describe the feedback before sending it.');

    return { type, title, description, steps, mapName };
}

function buildIssueBody(feedback, environment = {}) {
    const lines = [
        '## Description',
        feedback.description
    ];

    if (feedback.steps) {
        lines.push('', '## Steps to reproduce', feedback.steps);
    }

    if (feedback.mapName) {
        lines.push('', '## Context', `- Map: ${feedback.mapName}`);
    }

    const version = cleanText(environment.version, 40) || 'unknown';
    const platform = cleanText(environment.platform, 40) || 'unknown';
    const arch = cleanText(environment.arch, 40);
    lines.push(
        '',
        '## Environment',
        `- ARMOZE version: ${version}`,
        `- Platform: ${platform}${arch ? ` ${arch}` : ''}`,
        '',
        '> Submitted from the in-app feedback form. The user reviews this report on GitHub before posting it.'
    );

    return lines.join('\n');
}

function buildGitHubIssueUrl({ repositoryPath, feedback, environment } = {}) {
    const repository = assertRepositoryPath(repositoryPath);
    const normalized = normalizeFeedback(feedback);
    const type = FEEDBACK_TYPES[normalized.type];
    const url = new URL(`https://github.com/${repository}/issues/new`);

    url.searchParams.set('title', `[${type.prefix}] ${normalized.title}`);
    url.searchParams.set('body', buildIssueBody(normalized, environment));
    if (type.label) url.searchParams.set('labels', type.label);

    return url.toString();
}

module.exports = {
    FEEDBACK_TYPES,
    buildGitHubIssueUrl,
    normalizeFeedback
};
