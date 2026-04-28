# Chrome Web Store Submission Checklist

The GiveMeSpace Companion is built specifically to pass CWS review on first submission. This file is the pre-submission checklist; tick everything before clicking "Submit for review."

## What CWS reviewers flag (and how we avoid each)

| Red flag | Our defense |
|---|---|
| `host_permissions: ["<all_urls>"]` | We use `optional_host_permissions` instead. User grants explicitly via popup button. |
| Broad description like "browser automation" | Description names a single purpose: "Lets your authorized GiveMeSpace tab control your active browser." |
| Code obfuscation, minification, eval | Source ships unminified. No `eval`, no `new Function`, no `chrome.scripting.executeScript` with string code (only with declared functions). |
| Remote code execution / loading scripts from a server | We don't. All injected functions are declared in `background.js`. |
| `webRequest` permission | Not requested. We don't intercept network. |
| `debugger` permission | Not requested. We don't use CDP. |
| Hidden background activity | The service worker only fires in response to `chrome.runtime.onMessage` from our content script. No `chrome.alarms`, no periodic polling. |
| Content scripts on `<all_urls>` | Content script matches restricted to `givemespace.ai` + `localhost:3000` only. |
| `externally_connectable` accepting arbitrary origins | Set to `{ matches: [] }` — deny all external runtime messaging. |
| No privacy policy | `extensions/companion/PRIVACY.md` shipped + linked from popup. |
| Permissions request without user gesture | All `chrome.permissions.request` calls happen inside a popup button click handler (verified user gesture). |

## Pre-submission steps

- [ ] Bump `version` in `manifest.json` (semver: `0.x.0` for new features, `0.x.y` for fixes).
- [ ] Run `node --check` on every JS file (`background.js`, `content.js`, `popup.js`).
- [ ] Validate `manifest.json` parses (`node -e "JSON.parse(require('fs').readFileSync('extensions/companion/manifest.json','utf8'))"`).
- [ ] Load unpacked in a fresh Chrome profile to confirm install warnings are minimal.
- [ ] Click through every UI path in the popup (grant, revoke, GiveMeSpace tab open / closed).
- [ ] Smoke test the bridge from a GiveMeSpace tab: `companion.ping()`, `companion.activeTab()`, `companion.readPage()`, `companion.screenshot()`.
- [ ] Confirm screenshots load < 1 MB at default JPEG quality (CWS reviewers note this).
- [ ] Update `CHANGELOG.md` (TODO when CHANGELOG exists).
- [ ] Update `PRIVACY.md` `Last updated` date if anything in the data-handling story changed.

## Packaging

```bash
cd extensions/companion
zip -r ../givemespace-companion-v$(node -e "console.log(require('./manifest.json').version)").zip . \
  -x "*.DS_Store" -x ".git*" -x "node_modules/*"
```

Output goes to `extensions/givemespace-companion-vX.Y.Z.zip` — that's what you upload.

## Listing copy

**Single-purpose description** (CWS field, max 132 chars):
> Lets your authorized GiveMeSpace tab control your active browser to automate routine workflows you've initiated.

**Detailed description** (longer):

> GiveMeSpace Companion is the in-browser companion to the GiveMeSpace AI workspace at givemespace.ai. When the workspace agent needs to navigate, read, click, type, or screenshot a page, the Companion relays that request to your browser via standard Chrome extension APIs.
>
> The extension installs with **zero broad permissions**. Browser-wide access is gated behind an explicit "Grant access to all sites" button in the extension popup that you can click — or revoke — at any time.
>
> Open source: github.com/greenisi/givemespace
> Privacy policy: github.com/greenisi/givemespace/blob/main/extensions/companion/PRIVACY.md

**Category:** Productivity → Workflow & Planning

**Justifications** (CWS now requires per-permission justifications):

- `activeTab`: "Required so the user can invoke the agent on the tab they're currently viewing without granting broader access."
- `scripting`: "Required to inject the small declared helper functions that read DOM structure and execute click/type actions on behalf of the user-initiated agent command."
- `tabs`: "Required to list, open, switch, and close tabs as part of the multi-step workflows the user initiates from the GiveMeSpace web app."
- `storage`: "Used once at install to remember the trusted GiveMeSpace origin (default givemespace.ai)."
- `<all_urls>` (optional): "Optional — only requested via popup button when the user wants the agent to operate tabs across multiple sites. Default-off, fully reversible."

**Single-purpose statement:**

> The GiveMeSpace Companion has one purpose: relay user-initiated commands from the GiveMeSpace web app at givemespace.ai into the user's browser tabs.

## Privacy practices form (CWS questionnaire)

Answer all sections "We do not collect …":

- Personally identifiable information: **No**
- Health information: **No**
- Financial and payment information: **No**
- Authentication information: **No**
- Personal communications: **No**
- Location: **No**
- Web history: **No**
- User activity: **No**
- Website content: **Yes — read in transit only, never stored or transmitted off-device**
- Other: **No**

Then certify:
- ✅ I do not sell or transfer user data to third parties
- ✅ I do not use or transfer user data for purposes unrelated to single purpose
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes

## Post-submission

- Initial review: typically 1–7 business days for first-time devs, < 24h for established ones.
- Watch the developer dashboard for "Pending review" → "Published".
- If rejected, the email cites the policy section. Most common failure modes for our shape: "Disclose data practices clearly" (fix in PRIVACY.md), "Single purpose" (fix in description). Both are quick re-submits.
