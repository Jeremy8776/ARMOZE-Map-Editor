---
name: No native dialogs in Electron
description: Never use prompt()/confirm()/alert() — Electron throws an error; use custom inline overlays
type: feedback
originSessionId: e4f318f9-b508-40e5-ad61-cf25f54d61c4
---
Never use `prompt()`, `confirm()`, or `alert()` in this codebase.

**Why:** Electron explicitly blocks these and throws `Uncaught Error: prompt() is and will not be supported.`

**How to apply:** Use the custom helpers on ZonePropertiesUI: `showNamePrompt(label, default, callback)`, `showConfirm(message, callback)`, `showToast(message)`. For tab rename, use contenteditable inline editing instead of prompt().
