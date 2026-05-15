/**
 * Pure layout rules for the properties inspector.
 */
class InspectorLayoutService {
    static MIN_SIDE_SIZE = 280;
    static MAX_SIDE_SIZE = 560;

    static normalizePinnedEdge(edge) {
        return edge === 'left' || edge === 'right' ? edge : null;
    }

    static getModeForEdge(edge) {
        return this.normalizePinnedEdge(edge) ? 'side-panel' : 'floating';
    }

    static clampSize(edge, size) {
        const numericSize = Number.isFinite(size) ? size : this.getDefaultSize(edge);
        if (!this.normalizePinnedEdge(edge)) return this.getDefaultSize(null);
        return Math.max(this.MIN_SIDE_SIZE, Math.min(numericSize, this.MAX_SIDE_SIZE));
    }

    static getDefaultSize(edge) {
        return 392;
    }

    static getDefaultFloatingSize() {
        return { width: 392, height: 420 };
    }

    static shouldReserveInset({ edge, hidden = false, collapsed = false } = {}) {
        return !!this.normalizePinnedEdge(edge) && !hidden && !collapsed;
    }

    static getInsetForEdge(edge, size) {
        const inset = { top: 0, right: 0, bottom: 0, left: 0 };
        const pinnedEdge = this.normalizePinnedEdge(edge);
        if (!pinnedEdge) return inset;

        inset[pinnedEdge] = this.clampSize(pinnedEdge, size);
        return inset;
    }

    static getFloatingRestoreRect(edge, rect, viewport) {
        const floatingSize = this.getDefaultFloatingSize();
        const viewportWidth = viewport?.width || 1024;
        const viewportHeight = viewport?.height || 768;
        const width = Math.min(floatingSize.width, Math.max(300, viewportWidth - 32));
        const height = Math.min(floatingSize.height, Math.max(240, viewportHeight - 96));
        const sourceCenterX = (rect?.left || 0) + (rect?.width || width) / 2;
        const sourceCenterY = (rect?.top || 0) + (rect?.height || height) / 2;
        const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
        let left = sourceCenterX - width / 2;
        let top = sourceCenterY - height / 2;

        if (edge === 'left') left = (rect?.left || 0) + (rect?.width || this.getDefaultSize('left')) + 16;
        if (edge === 'right') left = (rect?.left || viewportWidth) - width - 16;

        return {
            left: Math.round(clamp(left, 8, Math.max(8, viewportWidth - width - 8))),
            top: Math.round(clamp(top, 64, Math.max(64, viewportHeight - height - 8))),
            width: Math.round(width),
            height: Math.round(height)
        };
    }

    static getAccordionStates(keys, targetKey, openKey) {
        return (keys || []).reduce((states, key) => {
            states[key] = key === targetKey && key !== openKey;
            return states;
        }, {});
    }
}

window.InspectorLayoutService = InspectorLayoutService;
