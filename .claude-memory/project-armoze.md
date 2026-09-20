---
name: ARMOZE Project Overview
description: Key architecture details for the ARMOZE Arma Reforger map overlay zone editor
type: project
originSessionId: e4f318f9-b508-40e5-ad61-cf25f54d61c4
---
Electron desktop app. UI is vanilla JS (no framework). Key files:
- `js/ui/ui-templates.js` — large HTML string templates (floating panel, modals) injected at load
- `js/ui/zone-properties-ui.js` — floating properties panel, accordion sections, profile save/delete
- `js/ui/zone-list-ui.js` — right sidebar zone list with hover actions
- `js/ui/tab-manager.js` — map tab bar (drag-reorder, inline rename)
- `css/floating-controls.css` — floating panel styles + inline-prompt-overlay
- `css/properties.css` — accordion, sliders, color pickers, recent-colors-group
- `css/zones.css` — zone panel (right sidebar), zone items

**Why:** Electron context blocks native prompt()/confirm()/alert(). All dialogs must use custom `showNamePrompt` / `showConfirm` / `showToast` methods on ZonePropertiesUI.

**How to apply:** Always use the custom dialog helpers for any user input or confirmation in this app.
