/**
 * In-app feedback form. It sends structured text to the main process, which
 * opens a prefilled GitHub issue. The user reviews and posts it on GitHub.
 */
class FeedbackUI {
    constructor(app) {
        this.app = app;
        this.modal = null;
        this.form = null;
        this.submitButton = null;
        this.status = null;
    }

    init() {
        document.body.insertAdjacentHTML('beforeend', FeedbackUI.buildMarkup());
        this.modal = document.getElementById('feedbackModal');
        this.form = document.getElementById('feedbackForm');
        this.submitButton = document.getElementById('btnSubmitFeedback');
        this.status = document.getElementById('feedbackStatus');

        document.getElementById('btnCloseFeedback')?.addEventListener('click', () => this.hide());
        document.getElementById('btnCancelFeedback')?.addEventListener('click', () => this.hide());
        document.getElementById('btnOpenFeedbackLogs')?.addEventListener('click', () => this.openLogsFolder());
        this.form?.addEventListener('submit', (event) => this.handleSubmit(event));
        this.modal?.addEventListener('click', (event) => {
            if (event.target === this.modal) this.hide();
        });
    }

    static buildMarkup() {
        return `
            <div class="modal-overlay" id="feedbackModal" role="dialog" aria-modal="true" aria-labelledby="feedbackTitle">
                <div class="modal feedback-modal">
                    <div class="modal-header">
                        <h2 id="feedbackTitle"><i data-lucide="message-square-warning"></i> Send Feedback</h2>
                        <button type="button" class="modal-close" id="btnCloseFeedback" aria-label="Close feedback form">&times;</button>
                    </div>
                    <form id="feedbackForm">
                        <div class="modal-body feedback-form">
                            <p class="modal-hint">This opens a prefilled issue in your browser. Review it, sign in to GitHub if needed, then click Submit new issue.</p>

                            <label class="feedback-field">
                                <span>Type</span>
                                <select id="feedbackType">
                                    <option value="bug">Bug</option>
                                    <option value="feature">Feature request</option>
                                    <option value="map">Map or calibration data</option>
                                    <option value="general">General feedback</option>
                                </select>
                            </label>

                            <label class="feedback-field">
                                <span>Summary</span>
                                <input id="feedbackSummary" type="text" maxlength="120" placeholder="What should we know?" required>
                            </label>

                            <label class="feedback-field">
                                <span>Description</span>
                                <textarea id="feedbackDescription" rows="5" maxlength="3500" placeholder="What happened, or what would improve ARMOZE?" required></textarea>
                            </label>

                            <label class="feedback-field">
                                <span>Steps to reproduce <small>optional</small></span>
                                <textarea id="feedbackSteps" rows="4" maxlength="1800" placeholder="1. Load a map&#10;2. Draw a zone&#10;3. ..."></textarea>
                            </label>

                            <div class="feedback-context">
                                <i data-lucide="shield-check"></i>
                                <p>ARMOZE adds the app version, operating system, and current map filename. It does not send projects, map files, credentials, or logs.</p>
                            </div>
                            <button type="button" class="btn btn-secondary btn-small feedback-logs-button" id="btnOpenFeedbackLogs">
                                <i data-lucide="folder-open"></i> Open logs folder
                            </button>
                            <p class="feedback-status" id="feedbackStatus" role="alert" aria-live="polite"></p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-reset" id="btnCancelFeedback">Cancel</button>
                            <button type="submit" class="btn btn-primary" id="btnSubmitFeedback">
                                <i data-lucide="github"></i> Open GitHub issue
                            </button>
                        </div>
                    </form>
                </div>
            </div>`;
    }

    show() {
        if (!this.modal) return;
        this.setStatus('');
        this.modal.classList.add('visible');
        document.getElementById('feedbackSummary')?.focus();
        window.LucideIconUtils?.hydrate(this.modal);
    }

    hide() {
        this.modal?.classList.remove('visible');
        this.setSubmitting(false);
        this.setStatus('');
    }

    getPayload() {
        return {
            type: document.getElementById('feedbackType')?.value || 'general',
            title: document.getElementById('feedbackSummary')?.value || '',
            description: document.getElementById('feedbackDescription')?.value || '',
            steps: document.getElementById('feedbackSteps')?.value || '',
            mapName: this.app.tabManager?.getActiveTab()?.name || ''
        };
    }

    async handleSubmit(event) {
        event.preventDefault();
        if (!this.form?.reportValidity()) return;
        if (!window.electronAPI?.submitFeedback) {
            this.setStatus('Feedback submission is only available in the desktop app.', true);
            return;
        }

        this.setSubmitting(true);
        this.setStatus('Opening GitHub...');
        try {
            await window.electronAPI.submitFeedback(this.getPayload());
            this.form.reset();
            this.hide();
            this.app.notificationService?.showToast('GitHub opened. Review the issue, then submit it.', 'success', 4000);
        } catch (error) {
            this.setStatus(error?.message || 'Could not open GitHub.', true);
            this.setSubmitting(false);
        }
    }

    async openLogsFolder() {
        try {
            await window.electronAPI?.openLogsFolder?.();
        } catch (error) {
            this.setStatus(error?.message || 'Could not open the logs folder.', true);
        }
    }

    setSubmitting(submitting) {
        if (!this.submitButton) return;
        this.submitButton.disabled = submitting;
        this.submitButton.innerHTML = submitting
            ? '<i data-lucide="loader-circle"></i> Opening...'
            : '<i data-lucide="github"></i> Open GitHub issue';
        window.LucideIconUtils?.hydrate(this.submitButton);
    }

    setStatus(message, isError = false) {
        if (!this.status) return;
        this.status.textContent = message;
        this.status.classList.toggle('is-error', isError);
    }
}

window.FeedbackUI = FeedbackUI;
