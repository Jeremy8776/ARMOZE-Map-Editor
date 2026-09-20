/**
 * Exact Workbench coordinate editor for drawn zones.
 * Keeps world-space X/Z entry separate from canvas-space zone storage.
 */
class ZoneCoordinateEditor {
    constructor(propertiesUI) {
        this.ui = propertiesUI;
        this.section = null;
        this.fields = null;
        this.summary = null;
        this.zone = null;
    }

    init() {
        this.section = document.getElementById('coordinateAccordion');
        this.fields = document.getElementById('coordinateEditorFields');
        this.summary = document.getElementById('coordinateSummary');
        const form = document.getElementById('coordinateEditorForm');
        form?.addEventListener('submit', (event) => {
            event.preventDefault();
            this.apply();
        });
    }

    render(zone) {
        if (!this.section || !this.fields) return;
        const supported = zone && !zone.sourceType && this.isSupportedShape(zone);
        this.section.hidden = !supported;
        this.zone = supported ? zone : null;
        if (!supported) return;

        const world = this.ui.app.coordinateSystem.transformZone(zone);
        this.fields.innerHTML = this.getFieldsHtml(world);
        if (this.summary) this.summary.textContent = this.getSummary(world);
    }

    isSupportedShape(zone) {
        return ['circle', 'rectangle', 'line'].includes(zone.shape) || Array.isArray(zone.points);
    }

    getFieldsHtml(zone) {
        if (zone.shape === 'circle') {
            return this.fieldGrid([
                ['Center X (east)', 'centerX', zone.cx],
                ['Center Z (north)', 'centerZ', zone.cy],
                ['Radius (m)', 'radius', zone.radius, 0.001]
            ]);
        }
        if (zone.shape === 'rectangle') {
            return this.fieldGrid([
                ['Minimum X (east)', 'minX', zone.x],
                ['Minimum Z (north)', 'minZ', zone.y],
                ['Width X (m)', 'width', zone.width, 0.001],
                ['Depth Z (m)', 'depth', zone.height, 0.001]
            ]);
        }
        if (zone.shape === 'line') {
            return this.fieldGrid([
                ['Start X (east)', 'startX', zone.x1],
                ['Start Z (north)', 'startZ', zone.y1],
                ['End X (east)', 'endX', zone.x2],
                ['End Z (north)', 'endZ', zone.y2]
            ]);
        }
        return `<div class="coordinate-point-list">${zone.points.map((point, index) => `
            <div class="coordinate-point-row">
                <span>P${index + 1}</span>
                ${this.numberInput(`point-${index}-x`, point.x, 'X')}
                ${this.numberInput(`point-${index}-z`, point.y, 'Z')}
            </div>
        `).join('')}</div>`;
    }

    fieldGrid(fields) {
        return `<div class="coordinate-field-grid">${fields.map(([label, name, value, min]) => `
            <label class="coordinate-field">
                <span>${label}</span>
                ${this.numberInput(name, value, label, min)}
            </label>
        `).join('')}</div>`;
    }

    numberInput(name, value, label, min = null) {
        const minAttribute = min === null ? '' : ` min="${min}"`;
        return `<input type="number" inputmode="decimal" step="any"${minAttribute} name="${name}" value="${this.formatNumber(value)}" aria-label="${label}">`;
    }

    formatNumber(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '';
        return String(Math.round(number * 1e9) / 1e9);
    }

    getSummary(zone) {
        if (zone.shape === 'circle') {
            return `X ${this.formatNumber(zone.cx)} · Z ${this.formatNumber(zone.cy)} · R ${this.formatNumber(zone.radius)} m`;
        }
        if (zone.shape === 'rectangle') {
            return `X ${this.formatNumber(zone.x)} · Z ${this.formatNumber(zone.y)}`;
        }
        if (zone.shape === 'line') {
            return `X/Z endpoints`;
        }
        return `${zone.points.length} exact vertices`;
    }

    readValues() {
        const values = {};
        this.fields.querySelectorAll('input[name]').forEach(input => {
            values[input.name] = Number(input.value);
        });

        if (this.zone?.points) {
            values.points = this.zone.points.map((point, index) => ({
                x: values[`point-${index}-x`],
                z: values[`point-${index}-z`]
            }));
        }
        return values;
    }

    apply() {
        if (!this.zone) return;
        try {
            const updates = ZoneCoordinateEditor.getMapUpdates(
                this.zone.shape,
                this.readValues(),
                this.ui.app.coordinateSystem
            );
            this.ui.app.historyManager.saveHistory();
            const updated = this.ui.app.zoneManager.updateZone(this.zone.id, updates);
            this.ui.showZoneProperties(updated, true);
            this.ui.app.notificationService?.showToast('Exact Workbench coordinates applied.', 'success');
        } catch (error) {
            this.ui.app.notificationService?.showToast(error.message, 'error');
        }
    }

    static getMapUpdates(shape, values, coordinateSystem) {
        if (!coordinateSystem) throw new Error('Coordinate system is unavailable.');
        const requireFinite = (names) => names.forEach(name => {
            if (!Number.isFinite(values[name])) throw new Error('Enter a valid number for every coordinate.');
        });

        if (shape === 'circle') {
            requireFinite(['centerX', 'centerZ', 'radius']);
            if (values.radius <= 0) throw new Error('Radius must be greater than zero.');
            const center = coordinateSystem.worldToMap({ x: values.centerX, z: values.centerZ });
            return {
                cx: center.x,
                cy: center.y,
                radius: coordinateSystem.worldLengthToMap(values.radius)
            };
        }

        if (shape === 'rectangle') {
            requireFinite(['minX', 'minZ', 'width', 'depth']);
            if (values.width <= 0 || values.depth <= 0) {
                throw new Error('Rectangle width and depth must be greater than zero.');
            }
            const topLeft = coordinateSystem.worldToMap({
                x: values.minX,
                z: values.minZ + values.depth
            });
            return {
                x: topLeft.x,
                y: topLeft.y,
                width: coordinateSystem.worldLengthToMap(values.width),
                height: coordinateSystem.worldLengthToMap(values.depth)
            };
        }

        if (shape === 'line') {
            requireFinite(['startX', 'startZ', 'endX', 'endZ']);
            const start = coordinateSystem.worldToMap({ x: values.startX, z: values.startZ });
            const end = coordinateSystem.worldToMap({ x: values.endX, z: values.endZ });
            return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
        }

        if (Array.isArray(values.points) && values.points.length) {
            const points = values.points.map(point => {
                if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) {
                    throw new Error('Enter a valid X and Z for every vertex.');
                }
                return coordinateSystem.worldToMap(point);
            });
            return { points };
        }

        throw new Error('This zone shape does not support exact coordinate entry.');
    }
}

window.ZoneCoordinateEditor = ZoneCoordinateEditor;
