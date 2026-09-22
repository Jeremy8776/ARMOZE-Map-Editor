/**
 * Map Token Tooltip
 * Fixed-position, themed tooltip for compact map-card status tokens.
 * It lives outside the scrollable map list so card overflow cannot clip it.
 */
class MapTokenTooltip {
    constructor() {
        this.element = null;
        this.activeTarget = null;
        this.showTimer = null;
        this.hideTimer = null;
        this.reposition = () => this.positionActive();
    }

    static getPosition(anchor, tooltip, viewport, gap = 10, margin = 12) {
        const fitsRight = anchor.right + gap + tooltip.width <= viewport.width - margin;
        const placement = fitsRight ? 'right' : 'left';
        const unclampedLeft = fitsRight
            ? anchor.right + gap
            : anchor.left - tooltip.width - gap;
        const maxLeft = Math.max(margin, viewport.width - tooltip.width - margin);
        const maxTop = Math.max(margin, viewport.height - tooltip.height - margin);

        return {
            left: Math.round(Math.max(margin, Math.min(maxLeft, unclampedLeft))),
            top: Math.round(Math.max(margin, Math.min(maxTop, anchor.top))),
            placement
        };
    }

    attach(target, content) {
        if (!target) return;
        this.update(target, content);
        target.tabIndex = 0;

        target.addEventListener('mouseenter', () => this.scheduleShow(target));
        target.addEventListener('mouseleave', () => this.scheduleHide());
        target.addEventListener('focus', () => this.scheduleShow(target, 0));
        target.addEventListener('blur', () => this.scheduleHide(0));
        target.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.hide();
        });
    }

    update(target, content = {}) {
        if (!target) return;
        target.dataset.tooltipTitle = content.tooltipTitle || '';
        target.dataset.tooltipText = content.tooltip || '';
        target.dataset.tooltipTone = content.tooltipTone || 'neutral';
        target.setAttribute('aria-label', [content.tooltipTitle, content.tooltip].filter(Boolean).join('. '));

        if (this.activeTarget === target && this.element) {
            this.renderContent(target);
            this.positionActive();
        }
    }

    scheduleShow(target, delay = 120) {
        clearTimeout(this.hideTimer);
        clearTimeout(this.showTimer);
        this.showTimer = setTimeout(() => this.show(target), delay);
    }

    scheduleHide(delay = 70) {
        clearTimeout(this.showTimer);
        clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(() => this.hide(), delay);
    }

    show(target) {
        if (!target?.isConnected) return;
        const tooltip = this.ensureElement();
        this.activeTarget = target;
        this.renderContent(target);
        tooltip.hidden = false;
        tooltip.classList.remove('is-visible');
        this.positionActive();
        requestAnimationFrame(() => tooltip.classList.add('is-visible'));
        window.addEventListener('resize', this.reposition);
        window.addEventListener('scroll', this.reposition, true);
    }

    hide() {
        clearTimeout(this.showTimer);
        if (!this.element) return;
        this.element.classList.remove('is-visible');
        this.activeTarget = null;
        window.removeEventListener('resize', this.reposition);
        window.removeEventListener('scroll', this.reposition, true);
        setTimeout(() => {
            if (this.element && !this.element.classList.contains('is-visible')) {
                this.element.hidden = true;
            }
        }, 140);
    }

    ensureElement() {
        if (this.element) return this.element;

        const tooltip = document.createElement('div');
        tooltip.id = 'mapTokenTooltip';
        tooltip.className = 'map-token-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.hidden = true;

        const header = document.createElement('div');
        header.className = 'map-token-tooltip__header';
        const marker = document.createElement('span');
        marker.className = 'map-token-tooltip__marker';
        const title = document.createElement('span');
        title.className = 'map-token-tooltip__title';
        header.append(marker, title);

        const message = document.createElement('p');
        message.className = 'map-token-tooltip__message';
        tooltip.append(header, message);
        document.body.appendChild(tooltip);
        this.element = tooltip;
        return tooltip;
    }

    renderContent(target) {
        if (!this.element) return;
        this.element.dataset.tone = target.dataset.tooltipTone || 'neutral';
        this.element.querySelector('.map-token-tooltip__title').textContent = target.dataset.tooltipTitle || '';
        this.element.querySelector('.map-token-tooltip__message').textContent = target.dataset.tooltipText || '';
    }

    positionActive() {
        if (!this.element || !this.activeTarget?.isConnected || this.element.hidden) return;
        const anchor = this.activeTarget.getBoundingClientRect();
        const tooltip = {
            width: this.element.offsetWidth,
            height: this.element.offsetHeight
        };
        const position = MapTokenTooltip.getPosition(anchor, tooltip, {
            width: window.innerWidth,
            height: window.innerHeight
        });
        this.element.style.left = `${position.left}px`;
        this.element.style.top = `${position.top}px`;
        this.element.dataset.placement = position.placement;
        const arrowOffset = Math.max(14, Math.min(
            tooltip.height - 14,
            anchor.top + (anchor.height / 2) - position.top
        ));
        this.element.style.setProperty('--tooltip-arrow-offset', `${Math.round(arrowOffset)}px`);
    }
}

window.MapTokenTooltip = MapTokenTooltip;
