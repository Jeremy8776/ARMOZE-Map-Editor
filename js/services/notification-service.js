/**
 * Notification Service
 * Central home for toasts, update banners, and modal dialogs (alert/confirm/prompt).
 * All user-supplied text is rendered via textContent to avoid HTML injection
 * through profile names, filenames, version strings, etc.
 */
class NotificationService {
    constructor(app) {
        this.app = app;
        this.updateBanner = null;
    }

    showUpdateNotification(data) {
        if (this.updateBanner && document.body.contains(this.updateBanner)) {
            // Already showing — just refresh metadata in case.
            this.updateBanner._data = { ...this.updateBanner._data, ...data };
            return;
        }

        const banner = document.createElement('div');
        banner.className = 'update-banner';
        banner.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            background: rgba(18, 21, 26, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid var(--color-accent);
            padding: 15px; border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            z-index: 9999; display: flex; flex-direction: column; gap: 10px;
            min-width: 320px; animation: slideInUp 0.3s ease-out;
        `;
        banner._data = data || {};

        const head = document.createElement('div');
        head.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';

        const title = document.createElement('h3');
        title.style.cssText = 'margin:0; color:var(--color-accent); font-size: 14px;';
        title.textContent = `Update Available! v${data?.version || ''}`;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Dismiss update notification');
        closeBtn.style.cssText = 'background:none; border:none; color:#888; cursor:pointer; display:inline-flex; padding:4px;';
        closeBtn.appendChild(this._makeIcon('x', 14));

        head.appendChild(title);
        head.appendChild(closeBtn);

        const copy = document.createElement('p');
        copy.style.cssText = 'margin:0; font-size:12px; color:#ccc;';
        copy.textContent = data?.canAutoInstall
            ? 'Click below to download and install the new version.'
            : 'A new version of ARMOZE is available on GitHub.';

        // Progress bar (hidden until download starts)
        const progressWrap = document.createElement('div');
        progressWrap.style.cssText = 'display:none; flex-direction:column; gap:4px;';
        const progressBar = document.createElement('div');
        progressBar.style.cssText = 'height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;';
        const progressFill = document.createElement('div');
        progressFill.style.cssText = 'height:100%; width:0%; background:var(--color-accent); transition:width 0.2s ease;';
        progressBar.appendChild(progressFill);
        const progressLabel = document.createElement('span');
        progressLabel.style.cssText = 'font-size:11px; color:#aaa;';
        progressLabel.textContent = 'Downloading… 0%';
        progressWrap.append(progressBar, progressLabel);

        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'btn btn-primary btn-small';
        action.style.width = '100%';
        action.textContent = data?.canAutoInstall ? 'Download & Install' : 'Open Release Page';

        banner.append(head, copy, progressWrap, action);
        document.body.appendChild(banner);
        this.updateBanner = banner;

        // Refs the renderer can mutate via setUpdateProgress / setUpdateReady / setUpdateError
        banner._refs = { title, copy, progressWrap, progressFill, progressLabel, action };

        action.addEventListener('click', () => {
            const current = banner._data || {};
            // State: ready-to-install — relaunch
            if (current.state === 'ready') {
                window.electronAPI?.quitAndInstall?.().catch(() => {
                    this.showToast('Could not start installer.', 'error');
                });
                return;
            }
            // State: in-app download supported — kick off download
            if (current.canAutoInstall && window.electronAPI?.startUpdateDownload) {
                action.disabled = true;
                action.textContent = 'Starting…';
                window.electronAPI.startUpdateDownload().catch((err) => {
                    action.disabled = false;
                    action.textContent = 'Open Release Page';
                    banner._data.canAutoInstall = false;
                    copy.textContent = 'In-app update failed. Open the release page to grab it manually.';
                    this.showToast(err?.message || 'Update download failed.', 'error');
                });
                return;
            }
            // Fallback: open external GitHub release page
            if (window.electronAPI?.openExternal && current.url) {
                window.electronAPI.openExternal(current.url).catch(() => {
                    this.showToast('Could not open the update page.', 'error');
                });
            } else if (current.url) {
                window.open(current.url, '_blank');
            }
        });

        closeBtn.addEventListener('click', () => {
            banner.remove();
            this.updateBanner = null;
        });
    }

    setUpdateProgress(percent) {
        const banner = this.updateBanner;
        if (!banner?._refs) return;
        const { progressWrap, progressFill, progressLabel, action } = banner._refs;
        progressWrap.style.display = 'flex';
        const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
        progressFill.style.width = `${pct}%`;
        progressLabel.textContent = `Downloading… ${pct}%`;
        action.disabled = true;
        action.textContent = 'Downloading…';
        banner._data.state = 'downloading';
    }

    setUpdateReady() {
        const banner = this.updateBanner;
        if (!banner?._refs) return;
        const { copy, progressWrap, progressFill, progressLabel, action } = banner._refs;
        progressWrap.style.display = 'flex';
        progressFill.style.width = '100%';
        progressLabel.textContent = 'Download complete';
        copy.textContent = 'Update ready. Restart now to install.';
        action.disabled = false;
        action.textContent = 'Restart & Install';
        banner._data.state = 'ready';
    }

    setUpdateError(message) {
        const banner = this.updateBanner;
        if (!banner?._refs) return;
        const { copy, action } = banner._refs;
        copy.textContent = message || 'Update failed. Try the release page instead.';
        action.disabled = false;
        action.textContent = 'Open Release Page';
        banner._data.canAutoInstall = false;
        banner._data.state = 'error';
    }

    /**
     * Non-blocking toast at the bottom of the screen.
     * Replaces the console-only stub and the per-module copies.
     */
    showToast(message, type = 'info', durationMs = 2600) {
        const toast = document.createElement('div');
        const tint = type === 'error'
            ? '255, 77, 87'
            : type === 'success'
                ? '0, 255, 136'
                : '255, 255, 255';

        toast.className = `app-toast app-toast-${type}`;
        toast.style.cssText = `
            position: fixed; bottom: 24px; left: 50%;
            transform: translateX(-50%);
            background: rgba(20, 22, 28, 0.96);
            border: 1px solid rgba(${tint}, 0.35);
            border-radius: 12px; padding: 10px 18px;
            color: rgba(255,255,255,0.9);
            font-size: 13px; font-family: var(--font-primary);
            z-index: 9999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.45);
            pointer-events: none;
            animation: floatPanelIn 0.25s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), durationMs);
        return toast;
    }

    /**
     * Single-button notice modal. Resolves once the user dismisses it.
     * Used in place of window.alert() — Electron blocks the native dialog.
     */
    showAlert(message, options = {}) {
        return new Promise((resolve) => {
            const { title = 'Notice', okLabel = 'OK', tone = 'info' } = options;
            const { overlay, dialog } = this._buildDialogShell();
            dialog.appendChild(this._buildTitle(title));
            dialog.appendChild(this._buildMessage(message));

            const actions = document.createElement('div');
            actions.className = 'inline-prompt-actions';
            const ok = this._makeButton(okLabel, tone === 'danger' ? 'danger' : 'primary');
            actions.appendChild(ok);
            dialog.appendChild(actions);

            const close = () => { overlay.remove(); resolve(); };
            ok.addEventListener('click', close);
            this._wireDismissal(overlay, close);
            this._mountDialog(overlay);
            ok.focus();
        });
    }

    /**
     * Yes/no confirmation. Resolves true when the user confirms, false otherwise.
     * Used in place of window.confirm().
     */
    showConfirm(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Confirm',
                confirmLabel = 'Confirm',
                cancelLabel = 'Cancel',
                tone = 'primary'
            } = options;
            const { overlay, dialog } = this._buildDialogShell();
            dialog.appendChild(this._buildTitle(title));
            dialog.appendChild(this._buildMessage(message));

            const actions = document.createElement('div');
            actions.className = 'inline-prompt-actions';
            const cancel = this._makeButton(cancelLabel, 'ghost');
            const confirm = this._makeButton(confirmLabel, tone);
            actions.append(cancel, confirm);
            dialog.appendChild(actions);

            const finish = (value) => { overlay.remove(); resolve(value); };
            cancel.addEventListener('click', () => finish(false));
            confirm.addEventListener('click', () => finish(true));
            this._wireDismissal(overlay, () => finish(false));
            this._mountDialog(overlay);
            confirm.focus();
        });
    }

    /**
     * Text input modal. Resolves with the trimmed value, or null on cancel.
     * Used in place of window.prompt().
     */
    showPrompt(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = 'Input',
                defaultValue = '',
                placeholder = '',
                confirmLabel = 'Save',
                cancelLabel = 'Cancel'
            } = options;
            const { overlay, dialog } = this._buildDialogShell();
            dialog.appendChild(this._buildTitle(title));
            if (message) dialog.appendChild(this._buildMessage(message));

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'compact-input';
            input.value = defaultValue;
            input.placeholder = placeholder;
            dialog.appendChild(input);

            const actions = document.createElement('div');
            actions.className = 'inline-prompt-actions';
            const cancel = this._makeButton(cancelLabel, 'ghost');
            const confirm = this._makeButton(confirmLabel, 'primary');
            actions.append(cancel, confirm);
            dialog.appendChild(actions);

            const finish = (value) => { overlay.remove(); resolve(value); };
            cancel.addEventListener('click', () => finish(null));
            confirm.addEventListener('click', () => {
                const value = input.value.trim();
                finish(value || null);
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirm.click();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    finish(null);
                }
            });
            this._wireDismissal(overlay, () => finish(null));
            this._mountDialog(overlay);
            input.focus();
            input.select();
        });
    }

    _buildDialogShell() {
        const overlay = document.createElement('div');
        overlay.className = 'inline-prompt-overlay app-modal';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '9999';

        const dialog = document.createElement('div');
        dialog.className = 'inline-prompt';
        dialog.style.maxWidth = 'min(420px, calc(100vw - 32px))';
        overlay.appendChild(dialog);
        return { overlay, dialog };
    }

    _buildTitle(text) {
        const el = document.createElement('p');
        el.textContent = text;
        return el;
    }

    _buildMessage(text) {
        const el = document.createElement('div');
        el.style.cssText = 'color: rgba(255,255,255,0.85); font-size: 13px; line-height: 1.5;';
        el.textContent = text;
        return el;
    }

    _makeButton(label, tone = 'primary') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-chip';
        if (tone === 'primary') btn.classList.add('primary');
        if (tone === 'danger') {
            btn.classList.add('primary');
            btn.style.color = '#ff4757';
            btn.style.borderColor = 'rgba(255,71,87,0.4)';
        }
        btn.textContent = label;
        return btn;
    }

    _wireDismissal(overlay, onDismiss) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) onDismiss();
        });
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', keyHandler);
                onDismiss();
            }
        };
        document.addEventListener('keydown', keyHandler);
    }

    _mountDialog(overlay) {
        document.body.appendChild(overlay);
    }

    _makeIcon(name, size = 14) {
        if (name !== 'x') {
            const fallback = document.createElement('span');
            fallback.textContent = name;
            return fallback;
        }

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');

        const pathA = document.createElementNS(svgNS, 'path');
        pathA.setAttribute('d', 'M18 6 6 18');
        const pathB = document.createElementNS(svgNS, 'path');
        pathB.setAttribute('d', 'm6 6 12 12');
        svg.append(pathA, pathB);
        return svg;
    }
}

window.NotificationService = NotificationService;
