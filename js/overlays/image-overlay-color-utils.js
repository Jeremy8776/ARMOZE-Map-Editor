/**
 * Image Overlay Color Utils
 * Keeps SVG paint rewriting and import-time color inference separate from overlay state management.
 */
const ImageOverlayColorUtils = {
    getDefaultOverlayTintColor(image, options = {}) {
        const svgColor = options.sourceType === 'svg'
            ? this.extractSvgRepresentativeColor(options.svgMarkupOriginal)
            : null;
        if (svgColor) return svgColor;

        const rasterColor = this.extractRasterRepresentativeColor(image);
        return rasterColor || '#ffffff';
    },

    extractSvgRepresentativeColor(svgMarkup) {
        if (!svgMarkup) return null;

        try {
            const parser = new DOMParser();
            const documentNode = parser.parseFromString(svgMarkup, 'image/svg+xml');
            if (documentNode.querySelector('parsererror')) {
                return null;
            }

            const root = documentNode.documentElement;
            const rootColor = this.normalizeCssColorToHex(
                root?.getAttribute('color') || root?.style?.color || ''
            );
            if (rootColor) return rootColor;

            for (const element of documentNode.querySelectorAll('*')) {
                const elementColor = this.getFirstSvgElementColor(element);
                if (elementColor) return elementColor;
            }

            for (const styleElement of documentNode.querySelectorAll('style')) {
                const styleColor = this.extractColorFromStyleText(styleElement.textContent || '');
                if (styleColor) return styleColor;
            }
        } catch (error) {
            return null;
        }

        return null;
    },

    getFirstSvgElementColor(element) {
        if (!element) return null;

        const directAttributes = ['fill', 'stroke', 'stop-color', 'flood-color', 'color'];
        for (const attributeName of directAttributes) {
            const normalized = this.normalizeCssColorToHex(element.getAttribute(attributeName));
            if (normalized) return normalized;
        }

        return this.extractColorFromStyleText(element.getAttribute('style') || '');
    },

    extractColorFromStyleText(styleText) {
        if (!styleText) return null;

        const properties = ['fill', 'stroke', 'stop-color', 'flood-color', 'color'];
        for (const propertyName of properties) {
            const pattern = new RegExp(`${propertyName}\\s*:\\s*([^;}{]+)`, 'gi');
            let match = pattern.exec(styleText);
            while (match) {
                const normalized = this.normalizeCssColorToHex(match[1]);
                if (normalized) return normalized;
                match = pattern.exec(styleText);
            }
        }

        return null;
    },

    extractRasterRepresentativeColor(image) {
        if (!image) return null;

        try {
            const sourceWidth = image.naturalWidth || image.width || 1;
            const sourceHeight = image.naturalHeight || image.height || 1;
            const sampleWidth = Math.max(1, Math.min(48, sourceWidth));
            const sampleHeight = Math.max(1, Math.min(48, sourceHeight));
            const canvas = document.createElement('canvas');
            canvas.width = sampleWidth;
            canvas.height = sampleHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.clearRect(0, 0, sampleWidth, sampleHeight);
            ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);

            const pixels = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
            let totalWeight = 0;
            let red = 0;
            let green = 0;
            let blue = 0;

            for (let index = 0; index < pixels.length; index += 4) {
                const alpha = pixels[index + 3] / 255;
                if (alpha <= 0.08) continue;

                totalWeight += alpha;
                red += pixels[index] * alpha;
                green += pixels[index + 1] * alpha;
                blue += pixels[index + 2] * alpha;
            }

            if (!totalWeight) return null;

            return this.rgbToHex(
                Math.round(red / totalWeight),
                Math.round(green / totalWeight),
                Math.round(blue / totalWeight)
            );
        } catch (error) {
            return null;
        }
    },

    normalizeCssColorToHex(value) {
        const normalized = String(value || '').trim();
        if (!this.shouldRetintSvgPaint(normalized)) return null;

        const probe = document.createElement('span');
        probe.style.color = '';
        probe.style.color = normalized;
        const computed = probe.style.color;
        if (!computed) return null;

        const rgbMatch = computed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!rgbMatch) return null;

        return this.rgbToHex(
            parseInt(rgbMatch[1], 10),
            parseInt(rgbMatch[2], 10),
            parseInt(rgbMatch[3], 10)
        );
    },

    rgbToHex(r, g, b) {
        const toHex = (value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },

    getSvgMarkupForOverlay(overlay) {
        const originalMarkup = overlay?.svgMarkupOriginal || '';
        if (!originalMarkup) return '';
        if (!overlay.tintEnabled || !overlay.tintColor) return originalMarkup;

        try {
            const parser = new DOMParser();
            const documentNode = parser.parseFromString(originalMarkup, 'image/svg+xml');
            if (documentNode.querySelector('parsererror')) {
                return originalMarkup;
            }

            const root = documentNode.documentElement;
            this.ensureSvgIntrinsicSize(root, overlay);
            root.setAttribute('color', overlay.tintColor);
            root.style.color = overlay.tintColor;
            if (!root.getAttribute('preserveAspectRatio')) {
                root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }

            documentNode.querySelectorAll('style').forEach(styleElement => {
                const styleText = styleElement.textContent || '';
                let nextStyleText = this.replaceSvgStylePaint(styleText, 'fill', overlay.tintColor);
                nextStyleText = this.replaceSvgStylePaint(nextStyleText, 'stroke', overlay.tintColor);
                nextStyleText = this.replaceSvgStylePaint(nextStyleText, 'stop-color', overlay.tintColor);
                nextStyleText = this.replaceSvgStylePaint(nextStyleText, 'flood-color', overlay.tintColor);
                nextStyleText = this.replaceSvgStylePaint(nextStyleText, 'color', overlay.tintColor);
                styleElement.textContent = nextStyleText;
            });

            const fillDefaults = new Set(['path', 'circle', 'ellipse', 'polygon', 'rect', 'text', 'tspan']);
            const strokeDefaults = new Set(['line', 'polyline']);
            documentNode.querySelectorAll('*').forEach(element => {
                const tagName = element.tagName?.toLowerCase?.() || '';
                const fill = element.getAttribute('fill');
                const stroke = element.getAttribute('stroke');
                const stopColor = element.getAttribute('stop-color');
                const floodColor = element.getAttribute('flood-color');
                const style = element.getAttribute('style');

                if (fill && this.shouldRetintSvgPaint(fill)) {
                    element.setAttribute('fill', overlay.tintColor);
                }
                if (stroke && this.shouldRetintSvgPaint(stroke)) {
                    element.setAttribute('stroke', overlay.tintColor);
                }
                if (stopColor && this.shouldRetintSvgPaint(stopColor)) {
                    element.setAttribute('stop-color', overlay.tintColor);
                }
                if (floodColor && this.shouldRetintSvgPaint(floodColor)) {
                    element.setAttribute('flood-color', overlay.tintColor);
                }

                if (style) {
                    let nextStyle = this.replaceSvgStylePaint(style, 'fill', overlay.tintColor);
                    nextStyle = this.replaceSvgStylePaint(nextStyle, 'stroke', overlay.tintColor);
                    nextStyle = this.replaceSvgStylePaint(nextStyle, 'stop-color', overlay.tintColor);
                    nextStyle = this.replaceSvgStylePaint(nextStyle, 'flood-color', overlay.tintColor);
                    nextStyle = this.replaceSvgStylePaint(nextStyle, 'color', overlay.tintColor);
                    element.setAttribute('style', nextStyle);
                }

                if (!fill && !stroke && !style && fillDefaults.has(tagName)) {
                    element.setAttribute('fill', overlay.tintColor);
                }
                if (!fill && !stroke && !style && strokeDefaults.has(tagName)) {
                    element.setAttribute('stroke', overlay.tintColor);
                }
            });

            return new XMLSerializer().serializeToString(documentNode);
        } catch (error) {
            return originalMarkup;
        }
    },

    replaceSvgStylePaint(styleText, propertyName, tintColor) {
        const pattern = new RegExp(`${propertyName}\\s*:\\s*([^;]+)`, 'gi');
        return String(styleText || '').replace(pattern, (match, value) => {
            return this.shouldRetintSvgPaint(value) ? `${propertyName}:${tintColor}` : match;
        });
    },

    ensureSvgIntrinsicSize(root, overlay) {
        if (!root) return;

        const explicitWidth = this.parseSvgLength(root.getAttribute('width'));
        const explicitHeight = this.parseSvgLength(root.getAttribute('height'));
        if (explicitWidth > 0 && explicitHeight > 0) {
            return;
        }

        const viewBox = String(root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
        const viewBoxWidth = viewBox.length === 4 ? viewBox[2] : 0;
        const viewBoxHeight = viewBox.length === 4 ? viewBox[3] : 0;

        const fallbackWidth = overlay?.naturalWidth || overlay?.width || viewBoxWidth;
        const fallbackHeight = overlay?.naturalHeight || overlay?.height || viewBoxHeight;

        if (!explicitWidth && fallbackWidth > 0) {
            root.setAttribute('width', `${fallbackWidth}`);
        }
        if (!explicitHeight && fallbackHeight > 0) {
            root.setAttribute('height', `${fallbackHeight}`);
        }
    },

    parseSvgLength(value) {
        if (value === null || value === undefined || value === '') return 0;
        const normalized = String(value).trim();
        if (!normalized || normalized.includes('%')) return 0;
        const numeric = parseFloat(normalized);
        return Number.isFinite(numeric) ? numeric : 0;
    },

    shouldRetintSvgPaint(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized || normalized === 'none') return false;
        if (normalized.startsWith('url(')) return false;
        if (normalized === 'currentcolor') return false;
        return true;
    }
};

window.ImageOverlayColorUtils = ImageOverlayColorUtils;
