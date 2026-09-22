/**
 * Themed Select
 * Replaces Chromium's native option popup with one ARMOZE listbox surface.
 * The original select remains the source of truth for forms and event handlers.
 */
class ThemedSelect {
    constructor() {
        this.controls = new Map();
        this.popup = null;
        this.active = null;
        this.focusedIndex = -1;
        this.typeahead = '';
        this.typeaheadTimer = null;
        this.closeTimer = null;
        this.observer = null;
    }

    static getNextEnabledIndex(options, currentIndex, direction) {
        if (!Array.isArray(options) || !options.length) return -1;
        const step = direction < 0 ? -1 : 1;
        let index = Number.isInteger(currentIndex) ? currentIndex : (step > 0 ? -1 : 0);
        for (let count = 0; count < options.length; count += 1) {
            index = (index + step + options.length) % options.length;
            if (!options[index]?.disabled) return index;
        }
        return -1;
    }

    static findTypeaheadIndex(options, query) {
        const needle = String(query || '').trim().toLowerCase();
        if (!needle || !Array.isArray(options)) return -1;
        return options.findIndex(option => !option.disabled && String(option.label || '').toLowerCase().startsWith(needle));
    }

    init() {
        this.buildPopup();
        this.enhanceAll(document);
        this.observeDocument();
        document.addEventListener('pointerdown', event => this.handleOutsidePointer(event), true);
        document.addEventListener('change', event => this.syncFromEvent(event), true);
        document.addEventListener('input', event => this.syncFromEvent(event), true);
        document.addEventListener('reset', () => setTimeout(() => this.syncAll(), 0), true);
        window.addEventListener('resize', () => this.positionPopup());
        window.addEventListener('scroll', () => this.positionPopup(), true);
    }

    buildPopup() {
        const popup = document.createElement('div');
        popup.id = 'themedSelectPopup';
        popup.className = 'themed-select__popup';
        popup.setAttribute('role', 'listbox');
        popup.hidden = true;
        popup.addEventListener('pointerdown', event => event.preventDefault());
        popup.addEventListener('click', event => {
            const option = event.target.closest?.('[data-option-index]');
            if (!option || option.getAttribute('aria-disabled') === 'true') return;
            this.selectIndex(Number(option.dataset.optionIndex));
        });
        popup.addEventListener('mousemove', event => {
            const option = event.target.closest?.('[data-option-index]');
            if (!option || option.getAttribute('aria-disabled') === 'true') return;
            this.setFocusedIndex(Number(option.dataset.optionIndex), false);
        });
        document.body.appendChild(popup);
        this.popup = popup;
    }

    observeDocument() {
        this.observer = new MutationObserver(mutations => {
            let shouldSync = false;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (!(node instanceof Element)) return;
                    if (node.matches?.('select')) this.enhance(node);
                    node.querySelectorAll?.('select').forEach(select => this.enhance(select));
                });
                if (mutation.target.closest?.('select, .themed-select')) shouldSync = true;
            });
            if (shouldSync) this.syncAll();
        });
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'hidden', 'label', 'selected', 'class']
        });
    }

    enhanceAll(root) {
        root.querySelectorAll?.('select').forEach(select => this.enhance(select));
    }

    enhance(select) {
        if (!select || select.dataset.themedSelect === 'true') return;
        if (select.multiple || select.size > 1 || select.classList.contains('ui-hidden-control')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'themed-select';
        if (select.classList.contains('compact-select')) wrapper.classList.add('themed-select--compact');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'themed-select__trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', this.popup.id);
        trigger.innerHTML = `
            <span class="themed-select__value"></span>
            <span class="themed-select__chevron" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </span>`;

        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        wrapper.appendChild(trigger);
        select.classList.add('themed-select__native');
        select.dataset.themedSelect = 'true';
        select.setAttribute('aria-hidden', 'true');
        select.tabIndex = -1;

        if (select.style.flex) wrapper.style.flex = select.style.flex;
        if (select.style.width) wrapper.style.width = select.style.width;
        if (select.style.minWidth) wrapper.style.minWidth = select.style.minWidth;
        if (select.style.maxWidth) wrapper.style.maxWidth = select.style.maxWidth;

        const control = {
            select,
            wrapper,
            trigger,
            value: trigger.querySelector('.themed-select__value')
        };
        this.controls.set(select, control);
        this.installValueObservers(control);
        this.bindTrigger(control);
        this.sync(control);
    }

    installValueObservers(control) {
        const select = control.select;
        const prototype = window.HTMLSelectElement?.prototype;
        if (!prototype) return;

        ['value', 'selectedIndex'].forEach(property => {
            const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
            if (!descriptor?.get || !descriptor?.set) return;
            try {
                Object.defineProperty(select, property, {
                    configurable: true,
                    get: () => descriptor.get.call(select),
                    set: value => {
                        descriptor.set.call(select, value);
                        queueMicrotask(() => this.sync(control));
                    }
                });
            } catch (error) {
                // Mutation and event syncing still cover browsers that reject overrides.
            }
        });
    }

    bindTrigger(control) {
        control.trigger.addEventListener('click', () => {
            if (control.select.disabled) return;
            if (this.active?.select === control.select) this.close();
            else this.open(control);
        });
        control.trigger.addEventListener('keydown', event => this.handleTriggerKeyDown(control, event));
        control.select.addEventListener('focus', () => control.trigger.focus({ preventScroll: true }));
    }

    handleTriggerKeyDown(control, event) {
        const options = this.getOptions(control.select);
        const isOpen = this.active?.select === control.select;

        if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            this.close({ focusTrigger: true });
            return;
        }
        if (event.key === 'Tab') {
            this.close();
            return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!isOpen) this.open(control);
            else if (this.focusedIndex >= 0) this.selectIndex(this.focusedIndex);
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) this.open(control);
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            this.setFocusedIndex(ThemedSelect.getNextEnabledIndex(options, this.focusedIndex, direction));
            return;
        }
        if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            if (!isOpen) this.open(control);
            const start = event.key === 'Home' ? options.length - 1 : 0;
            const direction = event.key === 'Home' ? 1 : -1;
            this.setFocusedIndex(ThemedSelect.getNextEnabledIndex(options, start, direction));
            return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            this.handleTypeahead(control, event.key);
        }
    }

    handleTypeahead(control, character) {
        clearTimeout(this.typeaheadTimer);
        this.typeahead += character.toLowerCase();
        this.typeaheadTimer = setTimeout(() => { this.typeahead = ''; }, 600);
        if (this.active?.select !== control.select) this.open(control);
        const index = ThemedSelect.findTypeaheadIndex(this.getOptions(control.select), this.typeahead);
        if (index >= 0) this.setFocusedIndex(index);
    }

    open(control) {
        if (this.active && this.active !== control) this.close({ immediate: true });
        clearTimeout(this.closeTimer);
        this.active = control;
        this.sync(control);
        this.renderOptions();
        control.wrapper.classList.add('is-open');
        control.trigger.setAttribute('aria-expanded', 'true');
        this.popup.hidden = false;
        this.popup.classList.remove('is-visible');
        this.positionPopup();
        this.setFocusedIndex(control.select.selectedIndex, false);
        requestAnimationFrame(() => this.popup.classList.add('is-visible'));
    }

    close({ focusTrigger = false, immediate = false } = {}) {
        if (!this.active) return;
        const control = this.active;
        this.active = null;
        control.wrapper.classList.remove('is-open');
        control.trigger.setAttribute('aria-expanded', 'false');
        control.trigger.removeAttribute('aria-activedescendant');
        this.popup.classList.remove('is-visible');
        clearTimeout(this.closeTimer);
        const finish = () => {
            if (!this.active) {
                this.popup.hidden = true;
                this.popup.replaceChildren();
            }
        };
        if (immediate) finish();
        else this.closeTimer = setTimeout(finish, 110);
        if (focusTrigger) control.trigger.focus({ preventScroll: true });
    }

    renderOptions() {
        if (!this.active) return;
        const fragment = document.createDocumentFragment();
        let previousGroup = null;

        this.getOptions(this.active.select).forEach(option => {
            if (option.group && option.group !== previousGroup) {
                const group = document.createElement('div');
                group.className = 'themed-select__group';
                group.textContent = option.group;
                fragment.appendChild(group);
                previousGroup = option.group;
            }

            const item = document.createElement('button');
            item.type = 'button';
            item.id = `themedSelectOption-${option.index}`;
            item.className = 'themed-select__option';
            item.dataset.optionIndex = option.index;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(option.selected));
            item.setAttribute('aria-disabled', String(option.disabled));
            item.textContent = option.label;
            item.disabled = option.disabled;
            if (option.selected) item.classList.add('is-selected');
            fragment.appendChild(item);
        });

        this.popup.replaceChildren(fragment);
    }

    getOptions(select) {
        return Array.from(select.options).map((option, index) => ({
            index,
            label: option.textContent.trim(),
            disabled: option.disabled || option.parentElement?.disabled === true,
            selected: index === select.selectedIndex,
            group: option.parentElement?.tagName === 'OPTGROUP' ? option.parentElement.label : null
        }));
    }

    selectIndex(index) {
        if (!this.active) return;
        const option = this.active.select.options[index];
        if (!option || option.disabled || option.parentElement?.disabled) return;
        this.active.select.selectedIndex = index;
        this.sync(this.active);
        this.active.select.dispatchEvent(new Event('input', { bubbles: true }));
        this.active.select.dispatchEvent(new Event('change', { bubbles: true }));
        this.close({ focusTrigger: true });
    }

    setFocusedIndex(index, scroll = true) {
        if (!this.active || index < 0) return;
        this.focusedIndex = index;
        this.popup.querySelectorAll('.themed-select__option.is-focused').forEach(item => item.classList.remove('is-focused'));
        const item = this.popup.querySelector(`[data-option-index="${index}"]`);
        if (!item) return;
        item.classList.add('is-focused');
        this.active.trigger.setAttribute('aria-activedescendant', item.id);
        if (scroll) item.scrollIntoView({ block: 'nearest' });
    }

    syncFromEvent(event) {
        if (event.target?.matches?.('select')) this.sync(this.controls.get(event.target));
    }

    syncAll() {
        this.controls.forEach(control => this.sync(control));
        if (this.active) {
            this.renderOptions();
            this.positionPopup();
        }
    }

    sync(control) {
        if (!control) return;
        const selected = control.select.selectedOptions?.[0] || control.select.options[control.select.selectedIndex];
        control.value.textContent = selected?.textContent?.trim() || 'Select an option';
        control.trigger.disabled = control.select.disabled;
        control.wrapper.classList.toggle('is-disabled', control.select.disabled);
        control.wrapper.hidden = control.select.hidden;
        const label = control.select.getAttribute('aria-label') || this.getAssociatedLabel(control.select);
        control.trigger.setAttribute('aria-label', label ? `${label}: ${control.value.textContent}` : control.value.textContent);
    }

    getAssociatedLabel(select) {
        if (!select.id) return '';
        const label = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
        return label?.textContent?.trim() || '';
    }

    handleOutsidePointer(event) {
        if (!this.active) return;
        if (this.popup.contains(event.target) || this.active.wrapper.contains(event.target)) return;
        this.close();
    }

    positionPopup() {
        if (!this.active || this.popup.hidden) return;
        const anchor = this.active.trigger.getBoundingClientRect();
        const margin = 10;
        const gap = 6;
        const width = Math.max(anchor.width, 180);
        this.popup.style.width = `${Math.round(width)}px`;
        const height = this.popup.offsetHeight;
        let left = anchor.left;
        let top = anchor.bottom + gap;

        if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
        if (top + height > window.innerHeight - margin) top = anchor.top - height - gap;
        left = Math.max(margin, left);
        top = Math.max(margin, top);
        this.popup.style.left = `${Math.round(left)}px`;
        this.popup.style.top = `${Math.round(top)}px`;
    }
}

window.ThemedSelect = ThemedSelect;
