# GiveMeSpace Companion

A small Chrome extension that lets the GiveMeSpace web app drive your active browser tab — navigate, read the DOM, click, type, screenshot — without you needing the desktop app.

## What it does

The web app at [givemespace.ai](https://givemespace.ai) (or `http://127.0.0.1:3000` in dev) cannot, on its own, control sites in other tabs because of normal browser security: same‑origin policy, X‑Frame‑Options, etc. The Companion bridges that gap. It runs only on the GiveMeSpace tab; it talks to other tabs via the official `chrome.tabs` and `chrome.scripting` APIs that are only available to extensions.

Companion is the **free tier** alternative to the Electron desktop app. Same agent, your real browser session, no install of a heavyweight binary.

## Permissions, in plain English

The MV3 manifest asks for:

| Permission | Why |
|---|---|
| `activeTab` | The agent only operates on tabs you've explicitly activated. No background access to all your tabs. |
| `scripting` | To inject the small reader/clicker functions into pages (paired with `activeTab`). |
| `tabs` | To list/create/close tabs when you ask the agent to. |
| `storage` | To remember which web app origin to trust. |

We do **not** request `<all_urls>`, `debugger`, or `webRequest`. The Companion can't read your bookmarks, history, passwords, or anything in tabs you haven't activated.

## Install (developer / unpacked)

While we're pre-Chrome-Web-Store, install it manually:

1. Clone the repo and find this folder: `extensions/companion/` inside [greenisi/givemespace](https://github.com/greenisi/givemespace).
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `extensions/companion/` folder.
5. Pin the extension from the puzzle-piece icon for easy access.
6. Open `https://givemespace.ai` (or `http://127.0.0.1:3000` for self-hosting). The agent's chat composer will show "Companion connected ✓" once everything is wired up.

## Install (Chrome Web Store)

Coming soon. Ticket: `Phase 4.5 W2 — submit Companion to Chrome Web Store`.

## How it talks to the web app

The bridge is `window.postMessage`-based, no extension‑ID lookup needed.

```
┌──────────────┐    window.postMessage    ┌────────────┐    chrome.runtime.sendMessage    ┌──────────────┐
│ givemespace.ai│ ─────── gms.cmd ──────► │ content.js │ ──────────── gms.cmd ───────────► │ background.js│
│  (web app)   │ ◄──── gms.result ─────── │ (in page)  │ ◄────────── result ────────────── │ (service wrk)│
└──────────────┘                         └────────────┘                                   └──────────────┘
                                                                                                  │
                                                                                                  │ chrome.tabs / chrome.scripting
                                                                                                  ▼
                                                                                          ┌─────────────────┐
                                                                                          │ User's other tabs│
                                                                                          └─────────────────┘
```

The web-app side wrapper lives at:

```
app/L0/_all/mod/_core/web_browsing/companion-bridge.js
```

and exposes a small RPC surface:

```js
import { companionAvailable, companion } from "/mod/_core/web_browsing/companion-bridge.js";

if (await companionAvailable) {
  await companion.navigate("https://news.ycombinator.com");
  const page = await companion.readPage();
  // page.text, page.interactive[{ref, tag, text, href, ...}]
  await companion.click(page.interactive.find(i => i.text.includes("login")).ref);
}
```

## Commands available today

| Command | Args | Returns |
|---|---|---|
| `ping` | — | `{ ok, version }` |
| `list_tabs` | — | array of `{ id, windowId, title, url, active, … }` |
| `active_tab` | — | one tab object |
| `navigate` | `{ url, tabId? }` | `{ tabId }` |
| `create_tab` | `{ url, active? }` | `{ tabId, windowId }` |
| `close_tab` | `{ tabId }` | `{ closed }` |
| `read_page` | `{ tabId?, max_chars? }` | `{ title, url, text, interactive: [{ ref, tag, text, href, … }] }` |
| `click` | `{ ref, tabId? }` | `{ ok, ref }` |
| `type` | `{ ref, value, tabId? }` | `{ ok, ref }` |
| `screenshot` | `{ format?, quality? }` | `{ dataUrl }` |

## Roadmap

- W2: full integration with the in-app `web_browsing` module — replaces the "Embedded browser only works in native desktop apps" message with a working browser surface when Companion is detected.
- W3: Chrome Web Store submission, signed releases, auto-update.
- W4: Firefox port (WebExtensions, mostly compatible).

## Source

Apache-style structure inside the GiveMeSpace MIT-licensed repo. PRs welcome at [greenisi/givemespace](https://github.com/greenisi/givemespace).
