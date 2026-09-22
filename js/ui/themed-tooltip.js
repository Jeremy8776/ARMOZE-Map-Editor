/**
 * Themed Tooltip
 * Converts native title attributes into a restrained ARMOZE tooltip so browser
 * bubbles never break the visual language of toolbar and compact controls.
 */
class ThemedTooltip {
    constructor() {
        this.tooltip = null;
        this.activeElement = null;
        this.showTimer = null;
        this.hideTimer = null;
        this.observer = null;
    }

    init() {
        this.build();
        this.enhanceAll(document);
        this.observeDocument();
        document.addEventListener('pointerover', event => this.handlePointerOver(event), true);
        document.addEventListener('pointerout', event => this.handlePointerOut(event), true);
        document.addEventListener('focusin', event => this.handleFocusIn(event), true);
        document.addEventListener('focusout', event => this.handleFocusOut(event), true);
        document.addEventListener('pointerdown', () => this.hide(true), true);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.hide(true);
        }, true);
        window.addEventListener('resize', () => this.position());
        window.addEventListener('scroll', () => this.position(), true);
    }

    build() {
        const tooltip = document.createElement('div');
        tooltip.id = 'themedTooltip';
        tooltip.className = 'themed-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.hidden = true;
        document.body.appendChild(tooltip);
        this.tooltip = tooltip;
    }

    observeDocument() {
        this.observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes') {
                    this.enhance(mutation.target);
                    return;
                }
                mutation.addedNodes.forEach(node => {
                    if (!(node instanceof Element)) return;
                    this.enhance(node);
                    this.enhanceAll(node);
                });
            });
        });
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['title']
        });
    }

    enhanceAll(root) {
        root.querySelectorAll?.('[title]').forEach(element => this.enhance(element));
    }

    enhance(element) {
        if (!(element instanceof Element)) return;
        const title = element.getAttribute('title');
        if (!title?.trim()) return;
        element.dataset.themedTooltip = title.trim();
        element.removeAttribute('title');

        const isIconControl = element.matches('button, [role="button"]') && !element.textContent.trim();
        if (isIconControl && !element.hasAttribute('aria-label')) {
            element.setAttribute('aria-label', title.trim());
        }
    }

    handlePointerOver(event) {
        const element = event.target.closest?.('[data-themed-tooltip]');
        if (!element || element.contains(event.relatedTarget)) return;
        this.scheduleShow(element, 360);
    }

    handlePointerOut(event) {
        const element = event.target.closest?.('[data-themed-tooltip]');
        if (!element || element.contains(event.relatedTarget)) return;
        clearTimeout(this.showTimer);
        if (this.activeElement === element) this.scheduleHide();
    }

    handleFocusIn(event) {
        const element = event.target.closest?.('[data-themed-tooltip]');
        if (element) this.scheduleShow(element, 120);
    }

    handleFocusOut(event) {
        if (this.activeElement?.contains(event.target)) this.scheduleHide();
    }

    scheduleShow(element, delay) {
        clearTimeout(this.showTimer);
        clearTimeout(this.hideTimer);
        if (this.activeElement && this.activeElement !== element) this.hide(true);
        this.showTimer = setTimeout(() => this.show(element), delay);
    }

    scheduleHide() {
        clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(() => this.hide(), 80);
    }

    show(element) {
        if (!element?.isConnected || !element.dataset.themedTooltip) return;
        this.activeElement = element;
        this.tooltip.textContent = element.dataset.themedTooltip;
        this.tooltip.hidden = false;
        this.tooltip.classList.remove('is-visible', 'is-below');
        if (!element.hasAttribute('aria-describedby')) {
            element.setAttribute('aria-describedby', this.tooltip.id);
            element.dataset.themedTooltipDescribed = 'true';
        }
        this.position();
        requestAnimationFrame(() => this.tooltip.classList.add('is-visible'));
    }

    hide(immediate = false) {
        clearTimeout(this.showTimer);
        clearTimeout(this.hideTimer);
        const element = this.activeElement;
        this.activeElement = null;
        if (element?.dataset.themedTooltipDescribed === 'true') {
            element.removeAttribute('aria-describedby');
            delete element.dataset.themedTooltipDescribed;
        }
        if (!this.tooltip || this.tooltip.hidden) return;
        this.tooltip.classList.remove('is-visible');
        const finish = () => {
            if (!this.activeElement) this.tooltip.hidden = true;
        };
        if (immediate) finish();
        else this.hideTimer = setTimeout(finish, 90);
    }

    position() {
        if (!this.activeElement || this.tooltip.hidden) return;
        const anchor = this.activeElement.getBoundingClientRect();
        const width = this.tooltip.offsetWidth;
        const height = this.tooltip.offsetHeight;
        const margin = 8;
        const gap = 8;
        let left = anchor.left + (anchor.width - width) / 2;
        let top = anchor.top - height - gap;
        let below = false;

        if (top < margin) {
            top = anchor.bottom + gap;
            below = true;
        }
        left = Math.max(margin, Math.min(window.innerWidth - width - margin, left));
        top = Math.max(margin, Math.min(window.innerHeight - height - margin, top));
        this.tooltip.style.left = `${Math.round(left)}px`;
        this.tooltip.style.top = `${Math.round(top)}px`;
        this.tooltip.classList.toggle('is-below', below);
    }
}

window.ThemedTooltip = ThemedTooltip;
