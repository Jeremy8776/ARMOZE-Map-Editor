/**
 * Notification Service
 * Handles UI notifications and application updates.
 */
class NotificationService {
    constructor(app) {
        this.app = app;
    }

    /**
     * Show a notification when a new application version is available
     * @param {Object} data - Update data containing version and url
     */
    showUpdateNotification(data) {
        const banner = document.createElement('div');
        banner.className = 'update-banner';
        banner.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(18, 21, 26, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid var(--color-accent);
            padding: 15px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-width: 300px;
            animation: slideInUp 0.3s ease-out;
        `;

        banner.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--color-accent); font-size: 14px;">Update Available! v${data.version}</h3>
                <button id="closeUpdate" style="background:none; border:none; color:#888; cursor:pointer; font-size: 18px;">&times;</button>
            </div>
            <p style="margin:0; font-size:12px; color:#ccc;">A new version of ARMOZE is available on GitHub.</p>
            <button id="btnGetUpdate" class="btn btn-primary btn-small" style="width:100%;">
                Download Now
            </button>
        `;

        document.body.appendChild(banner);

        document.getElementById('btnGetUpdate').onclick = () => {
            if (window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal(data.url);
            } else {
                window.open(data.url, '_blank');
            }
        };

        document.getElementById('closeUpdate').onclick = () => {
            banner.remove();
        };
    }

    /**
     * Display a simple toast message (generic helper)
     */
    showToast(message, type = 'info') {
        // Implementation for future toast system
        console.log(`[Notification] ${type}: ${message}`);
    }
}

window.NotificationService = NotificationService;
