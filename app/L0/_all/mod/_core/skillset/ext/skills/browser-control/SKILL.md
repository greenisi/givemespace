---
name: Browser Control
description: Control floating browser windows through space.browser
---

Use this skill when the task needs to open, inspect, navigate, or close `_core/web_browsing` windows from JavaScript.

scope
- This skill is for the frontend runtime only.
- It describes `space.browser`, which controls floating browser windows with ids like `browser-1`.
- `space.browser` is window-local. It only controls browser windows in the current app tab or desktop window.

runtime notes
- In the packaged native app, bridge-backed requests such as `ping`, raw `dom`, semantic-markdown `content`, and navigation commands work through the injected browser runtime, including after full guest-page navigations.
- In ordinary browser sessions, agent-facing `space.browser` functions are guarded and return a warning object instead of attempting native-app-only browser actions.
- After opening a new window or navigating to a new page, call `await browser.sync()` before a bridge request when you need the injected runtime to be ready first.

warning shape
- In unsupported runtime, guarded calls return an object like:
- `{ available: false, code: "browser_native_app_only", requirement: "native_app_only", runtime: "browser", warning: "Browser functionality is currently only implemented in native apps.", message: "Browser functionality is currently only implemented in native apps." }`

namespace
- `space.browser.open(urlOrOptions?)` -> browser handle for the new window
- `space.browser.create(urlOrOptions?)` -> same as `open(...)`
- `space.browser.get(id)` -> browser handle or `null`
- `space.browser.current()` -> handle for the frontmost browser window or `null`
- `space.browser.ids()` -> `string[]`
- `space.browser.list()` -> snapshot objects for all open windows
- `space.browser.count()` -> number of open windows
- `space.browser.has(id)` -> boolean
- `space.browser.state(id)` -> one snapshot object or `null`
- `space.browser.close(id)` -> closes one window
- `space.browser.closeAll()` -> closes all windows and returns the number closed
- `space.browser.focus(id, options?)` -> handle or `null`
- `space.browser.navigate(id, url)` -> navigates one window
- `space.browser.reload(id)` -> reloads one window
- `space.browser.back(id)` -> history back for one window
- `space.browser.forward(id)` -> history forward for one window
- `space.browser.send(id, type, payload?, options?)` -> sends one bridge request by id
- `space.browser.sync(id, options?)` -> refreshes bridge state and returns whether a live bridge response succeeded

handle
- `handle.id`
- `handle.state` -> current snapshot
- `handle.window` -> live store-backed window object
- `handle.bridge` -> resolved bridge object or `null`
- `handle.focus(options?)`
- `handle.navigate(url)`
- `handle.reload()`
- `handle.back()`
- `handle.forward()`
- `handle.close()`
- `handle.sync(options?)`
- `handle.send(type, payload?, options?)`

bridge request types
- `ping` with any payload -> returns the exact string `received:<payload>`
- `dom` with no payload -> returns `{ document: "<serialized html>" }`
- `dom` with `{ selectors: ["title", "main", "a[href]"] }` -> returns an object keyed by the original selectors with concatenated `outerHTML` matches
- `content` with no payload -> returns `{ document: "<semantic markdown>" }`
- `content` with `{ selectors: ["title", "main", "a[href]"] }` -> returns an object keyed by the original selectors with semantic markdown converted from the same collected HTML snapshot
- `navigation_state_get` -> returns `{ canGoBack, canGoForward, title, url }`
- `location_navigate` with `{ url }`
- `history_back`
- `history_forward`
- `location_reload`

guidance
- Prefer `const browser = space.browser.get("browser-1")` or `space.browser.current()` when you already know the target window.
- Prefer `const browser = space.browser.open("https://example.com")` when the task needs a fresh browser window; `open(...)` returns the handle directly, so use `browser.id` if you need the generated id.
- Use `browser.state` or `space.browser.list()` for inspection instead of reaching into Alpine stores directly.
- Use `browser.send(...)` for injected page actions such as `dom` or `ping`.
- Use `browser.navigate(...)`, `browser.reload()`, `browser.back()`, and `browser.forward()` for host-side control instead of manually editing iframe or webview elements.

examples
Opening a new browser window and checking its state
_____javascript
const browser = space.browser.open("https://example.com");
await browser.sync();
return browser.state;

Using the current frontmost browser window
_____javascript
const browser = space.browser.current();
if (!browser) {
  throw new Error("No browser window is open.");
}
await browser.sync();
return await browser.send("navigation_state_get");

Fetching selected DOM from a browser window
_____javascript
const browser = space.browser.get("browser-1");
if (!browser) {
  throw new Error("browser-1 is not open.");
}
await browser.sync();
return await browser.send("dom", {
  selectors: ["title", "main", "a[href]"]
});

Fetching semantic content from the main article region
_____javascript
const browser = space.browser.get("browser-1");
if (!browser) {
  throw new Error("browser-1 is not open.");
}
await browser.sync();
return await browser.send("content", {
  selectors: ["main", "article"]
});

Opening a local placeholder browser and smoke-testing the bridge
_____javascript
const browser = space.browser.open();
await browser.sync();
return await browser.send("ping", "hello");

Closing every open browser window
_____javascript
return {
  closed: space.browser.closeAll()
};
