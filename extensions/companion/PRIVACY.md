# GiveMeSpace Companion — Privacy Policy

_Last updated: 2026-04-28_

## What this extension does

GiveMeSpace Companion is a bridge that lets the **GiveMeSpace web app** (at `https://givemespace.ai` or your self-hosted instance) control browser tabs you have open — navigate, read page content, click elements, type into forms, and capture the visible tab as a screenshot. It is the in-browser alternative to the GiveMeSpace desktop application.

It does **one thing**: relay commands you initiate from the GiveMeSpace web app into the Chrome extension APIs that web pages can't access on their own.

## What we collect

**Nothing.** The extension does not have a server. We do not collect, transmit, store, or sell any of your data.

All command relay happens entirely on your device:

```
GiveMeSpace tab  ──postMessage──►  content.js  ──chrome.runtime──►  background.js
                                                                          │
                                                                          ▼
                                                                  Your other tabs
```

No network request originates from this extension. The only network requests you'll see are the ones the GiveMeSpace web app itself makes (those go to GiveMeSpace's servers per its own privacy policy at `https://givemespace.ai/privacy`).

## What permissions we request and why

| Permission | What it lets us do | When it's used |
|---|---|---|
| `activeTab` | Read and modify the currently active tab when the user explicitly invokes the extension. | Default. Always required. |
| `scripting` | Inject the read/click/type helper functions into pages. | Paired with `activeTab` or `<all_urls>`. |
| `tabs` | List, create, and close tabs you ask the agent to operate. | When you invoke commands like "open hacker news in a new tab." |
| `storage` | Remember the trusted GiveMeSpace origin (default: `givemespace.ai`). | One write at install time. |
| `<all_urls>` *(optional)* | Operate tabs you didn't explicitly activate. | **Only after you click "Grant access to all sites" in the popup.** Default state is NOT granted. You can revoke it any time via the same popup or `chrome://extensions/?id=…`. |

## What this extension does NOT do

- ❌ Read your browsing history
- ❌ Read your bookmarks
- ❌ Read saved passwords or autofill data
- ❌ Capture audio or webcam
- ❌ Modify network requests (we don't request `webRequest`)
- ❌ Use the Chrome DevTools debugger (we don't request `debugger`)
- ❌ Run code downloaded from a server (all code is shipped in the package; CWS-compliant)
- ❌ Fingerprint your device or report telemetry to anyone
- ❌ Sell, share, or transfer any of your data

## Open source

This extension's complete source code is published at <https://github.com/greenisi/givemespace/tree/main/extensions/companion>. You can audit every line.

## Contact

For privacy questions: open an issue at <https://github.com/greenisi/givemespace/issues> or email `privacy@givemespace.ai`.

## Changes

Material changes to this policy will bump the extension's version, ship in the changelog, and be reflected here. The `Last updated` date at top tracks when this file was last edited.
