/**
 * Small guard around Lucide's browser helper.
 * Lucide createIcons() expects an icon registry object, not a NodeList.
 */
class LucideIconUtils {
    static getRawPlaceholders(scope = document) {
        if (!scope?.querySelectorAll) return [];
        return Array.from(scope.querySelectorAll('i[data-lucide]'))
            .filter(node => String(node.tagName || '').toLowerCase() === 'i');
    }

    static hydrate(scope = document, lucideApi = window.lucide) {
        if (!lucideApi?.createIcons) return false;
        if (!this.getRawPlaceholders(scope).length) return false;

        const svgScope = typeof document !== 'undefined' ? document : scope;
        const hydratedSvgs = svgScope?.querySelectorAll
            ? Array.from(svgScope.querySelectorAll('svg[data-lucide]'))
            : [];

        const protectedSvgs = hydratedSvgs
            .filter(svg => svg?.setAttribute && svg?.removeAttribute && svg?.getAttribute)
            .map(svg => ({
                svg,
                name: svg.getAttribute('data-lucide') || ''
            }));

        protectedSvgs.forEach(({ svg, name }) => {
            svg.setAttribute('data-lucide-rendered-name', name);
            svg.removeAttribute('data-lucide');
        });

        try {
            const options = { nameAttr: 'data-lucide' };
            if (lucideApi.icons && typeof lucideApi.icons === 'object') {
                options.icons = lucideApi.icons;
            }
            lucideApi.createIcons(options);
        } finally {
            protectedSvgs.forEach(({ svg }) => {
                const name = svg.getAttribute('data-lucide-rendered-name');
                svg.removeAttribute('data-lucide-rendered-name');
                if (name) svg.setAttribute('data-lucide', name);
            });
        }

        return true;
    }
}

window.LucideIconUtils = LucideIconUtils;
