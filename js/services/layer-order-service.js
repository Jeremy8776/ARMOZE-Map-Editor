/**
 * Maintains one Photoshop-style layer stack across zone and image overlay data.
 * Larger layerOrder values are rendered above smaller values.
 */
class LayerOrderService {
    constructor(zoneManager, imageOverlayManager, renderCallback = () => {}) {
        this.zoneManager = zoneManager;
        this.imageOverlayManager = imageOverlayManager;
        this.requestRender = renderCallback;
    }

    getLegacyLayers() {
        const zones = (this.zoneManager?.getZones?.() || []).map(item => ({
            kind: 'zone',
            id: item.id,
            item
        }));
        const overlays = (this.imageOverlayManager?.getOverlays?.() || []).map(item => ({
            kind: 'overlay',
            id: item.id,
            item
        }));
        return [...zones, ...overlays];
    }

    hasFiniteOrder(layer) {
        return Number.isFinite(layer?.item?.layerOrder);
    }

    ensureLayerOrders(options = {}) {
        const legacyLayers = this.getLegacyLayers();
        if (!legacyLayers.length) return false;

        const seenOrders = new Set();
        const needsNormalization = legacyLayers.some(layer => {
            if (!this.hasFiniteOrder(layer)) return true;
            if (seenOrders.has(layer.item.layerOrder)) return true;
            seenOrders.add(layer.item.layerOrder);
            return false;
        });
        if (!needsNormalization) return false;

        const orderedLayers = legacyLayers
            .map((layer, legacyIndex) => ({ ...layer, legacyIndex }))
            .sort((a, b) => {
                const aHasOrder = this.hasFiniteOrder(a);
                const bHasOrder = this.hasFiniteOrder(b);
                if (aHasOrder && bHasOrder && a.item.layerOrder !== b.item.layerOrder) {
                    return a.item.layerOrder - b.item.layerOrder;
                }
                if (aHasOrder !== bHasOrder) {
                    return aHasOrder ? -1 : 1;
                }
                return a.legacyIndex - b.legacyIndex;
            });

        let changed = false;
        orderedLayers.forEach((layer, index) => {
            if (layer.item.layerOrder !== index) {
                layer.item.layerOrder = index;
                changed = true;
            }
        });

        if (changed && options.persist) {
            this.persist();
        }
        return changed;
    }

    getLayers(options = {}) {
        this.ensureLayerOrders();
        const order = options.order || 'top-first';
        const layers = this.getLegacyLayers().sort((a, b) => {
            const orderDelta = (a.item.layerOrder || 0) - (b.item.layerOrder || 0);
            if (orderDelta !== 0) return orderDelta;
            return a.id.localeCompare(b.id);
        });

        return order === 'top-first' ? layers.reverse() : layers;
    }

    getLayer(kind, id) {
        return this.getLegacyLayers().find(layer => layer.kind === kind && layer.id === id) || null;
    }

    moveLayer(kind, id, direction, options = {}) {
        if (direction !== 'up' && direction !== 'down') return false;

        this.ensureLayerOrders({ persist: true });
        const layers = this.getLayers({ order: 'top-first' });
        const currentIndex = layers.findIndex(layer => layer.kind === kind && layer.id === id);
        if (currentIndex === -1) return false;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= layers.length) return false;

        const currentLayer = layers[currentIndex];
        const targetLayer = layers[targetIndex];
        const currentOrder = currentLayer.item.layerOrder;
        currentLayer.item.layerOrder = targetLayer.item.layerOrder;
        targetLayer.item.layerOrder = currentOrder;

        if (options.persist !== false) {
            this.persist();
        }
        if (options.render !== false) {
            this.requestRender();
        }
        return true;
    }

    moveLayerToTopIndex(kind, id, targetIndex, options = {}) {
        this.ensureLayerOrders({ persist: true });
        const layers = this.getLayers({ order: 'top-first' });
        const currentIndex = layers.findIndex(layer => layer.kind === kind && layer.id === id);
        if (currentIndex === -1) return false;

        const boundedTargetIndex = Math.max(0, Math.min(targetIndex, layers.length - 1));
        if (boundedTargetIndex === currentIndex) return false;

        const [movedLayer] = layers.splice(currentIndex, 1);
        layers.splice(boundedTargetIndex, 0, movedLayer);

        const bottomFirst = [...layers].reverse();
        bottomFirst.forEach((layer, index) => {
            layer.item.layerOrder = index;
        });

        if (options.persist !== false) {
            this.persist();
        }
        if (options.render !== false) {
            this.requestRender();
        }
        return true;
    }

    placeLayerOnTop(kind, id, options = {}) {
        this.ensureLayerOrders({ persist: options.persist !== false });
        const layer = this.getLayer(kind, id);
        if (!layer) return false;

        const maxOrder = this.getLegacyLayers().reduce((max, candidate) => {
            if (candidate.kind === kind && candidate.id === id) return max;
            return Math.max(max, Number.isFinite(candidate.item.layerOrder) ? candidate.item.layerOrder : -1);
        }, -1);

        if (layer.item.layerOrder <= maxOrder) {
            layer.item.layerOrder = maxOrder + 1;
            if (options.persist !== false) {
                this.persist();
            }
            if (options.render !== false) {
                this.requestRender();
            }
        }
        return true;
    }

    persist() {
        this.zoneManager?.saveToStorage?.();
        this.imageOverlayManager?.saveToStorage?.();
    }
}

window.LayerOrderService = LayerOrderService;
