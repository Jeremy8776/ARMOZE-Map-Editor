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
            min-width: 300px; animation: slideInUp 0.3s ease-out;
        `;

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
        copy.textContent = 'A new version of ARMOZE is available on GitHub.';

        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'btn btn-primary btn-small';
        action.style.width = '100%';
        action.textContent = 'Download Now';

        banner.append(head, copy, action);
        document.body.appendChild(banner);
        this.updateBanner = banner;

        action.addEventListener('click', () => {
            if (window.electronAPI?.openExternal) {
                window.electronAPI.openExternal(data.url).catch(() => {
                    this.showToast('Could not open the update page.', 'error');
                });
            } else {
                window.open(data.url, '_blank');
            }
        });

        closeBtn.addEventListener('click', () => {
            banner.remove();
            this.updateBanner = null;
        });
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
