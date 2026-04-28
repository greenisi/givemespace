// GiveMeSpace Companion — service worker (MV3).
//
// Routes commands sent from the GiveMeSpace web app (via content.js bridge)
// into Chrome extension APIs that the page itself cannot touch:
//   - navigate the active tab
//   - read the page's DOM / accessibility tree
//   - click / type via injected scripts
//   - capture a screenshot of the visible tab
//   - list / create / close tabs
//
// Wire format (all messages are JSON-serializable, no functions):
//   request : { type: "gms.cmd", id: "<uuid>", cmd: "<name>", args: { ... } }
//   reply   : { type: "gms.result", id: "<uuid>", ok: true, result: ... }
//             { type: "gms.result", id: "<uuid>", ok: false, error: "..." }

const VERSION = chrome.runtime.getManifest().version;

const HANDLERS = {
  ping: async () => ({ ok: true, version: VERSION }),

  list_tabs: async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.map((t) => ({
      id: t.id,
      windowId: t.windowId,
      title: t.title,
      url: t.url,
      active: t.active,
      pinned: t.pinned,
      audible: t.audible
    }));
  },

  active_tab: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  },

  navigate: async ({ url, tabId } = {}) => {
    if (!url || typeof url !== "string") {
      throw new Error("navigate: 'url' is required");
    }
    const targetId = tabId ?? (await getActiveTabId());
    await chrome.tabs.update(targetId, { url });
    return { tabId: targetId };
  },

  create_tab: async ({ url, active = true } = {}) => {
    const tab = await chrome.tabs.create({ url: url || "chrome://newtab/", active });
    return { tabId: tab.id, windowId: tab.windowId };
  },

  close_tab: async ({ tabId } = {}) => {
    if (typeof tabId !== "number") {
      throw new Error("close_tab: numeric 'tabId' is required");
    }
    await chrome.tabs.remove(tabId);
    return { closed: tabId };
  },

  // Read the visible text content + a flat list of interactive elements
  // (links/buttons/inputs) from the active tab. Cheaper than a full a11y
  // tree; sufficient for most agent tasks.
  read_page: async ({ tabId, max_chars = 25000 } = {}) => {
    const targetId = tabId ?? (await getActiveTabId());
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: targetId },
      func: readPageInPage,
      args: [max_chars]
    });
    return result;
  },

  // Click an element by stable ref returned from read_page.
  click: async ({ tabId, ref } = {}) => {
    if (!ref) throw new Error("click: 'ref' from read_page is required");
    const targetId = tabId ?? (await getActiveTabId());
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: targetId },
      func: clickRefInPage,
      args: [ref]
    });
    return result;
  },

  // Set the value of an input/textarea by ref, then dispatch input/change.
  type: async ({ tabId, ref, value } = {}) => {
    if (!ref) throw new Error("type: 'ref' from read_page is required");
    if (typeof value !== "string") throw new Error("type: 'value' string is required");
    const targetId = tabId ?? (await getActiveTabId());
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: targetId },
      func: typeRefInPage,
      args: [ref, value]
    });
    return result;
  },

  screenshot: async ({ format = "jpeg", quality = 80 } = {}) => {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format, quality });
    return { dataUrl };
  },

  // Open URL in a Chrome *popup* window — a separate, chromeless, resizable
  // window that feels like a sub-window of GiveMeSpace rather than another
  // tab in the user's main browser. captureVisibleTab works on the popup
  // window we own, so we can take a live screenshot for inline preview.
  create_popup_window: async ({
    url,
    width = 1280,
    height = 800,
    focused = false
  } = {}) => {
    if (!url || typeof url !== "string") {
      throw new Error("create_popup_window: 'url' is required");
    }
    const win = await chrome.windows.create({
      url,
      type: "popup",
      width,
      height,
      focused
    });
    return {
      windowId: win.id,
      tabId: win.tabs?.[0]?.id || null
    };
  },

  // Screenshot a specific window (the popup we created above). Tab inside
  // the window must be the foreground tab of THAT window — for popup
  // windows that always holds.
  screenshot_window: async ({ windowId, format = "jpeg", quality = 60 } = {}) => {
    if (typeof windowId !== "number") {
      throw new Error("screenshot_window: numeric 'windowId' is required");
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format, quality });
    return { dataUrl };
  },

  focus_window: async ({ windowId } = {}) => {
    if (typeof windowId !== "number") {
      throw new Error("focus_window: numeric 'windowId' is required");
    }
    await chrome.windows.update(windowId, { focused: true, drawAttention: true });
    return { focused: windowId };
  },

  close_window: async ({ windowId } = {}) => {
    if (typeof windowId !== "number") {
      throw new Error("close_window: numeric 'windowId' is required");
    }
    await chrome.windows.remove(windowId);
    return { closed: windowId };
  }
};

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab in current window.");
  return tab.id;
}

// These functions are injected via chrome.scripting.executeScript into the
// target page's main world — they CANNOT close over module-scoped variables.

function readPageInPage(maxChars) {
  // Tag interactive elements with stable refs we hand back to the caller.
  const ELS = document.querySelectorAll(
    "a[href], button, input, textarea, select, [role='button'], [role='link']"
  );
  const interactive = [];
  ELS.forEach((el, i) => {
    const ref = `ref_${i}`;
    el.dataset.gmsRef = ref;
    const rect = el.getBoundingClientRect();
    interactive.push({
      ref,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || null,
      text: (el.innerText || el.value || el.placeholder || "").trim().slice(0, 120),
      href: el.getAttribute("href") || null,
      visible:
        rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
    });
  });
  const text = (document.body?.innerText || "").slice(0, maxChars);
  return {
    title: document.title,
    url: location.href,
    text,
    interactive
  };
}

function clickRefInPage(ref) {
  const el = document.querySelector(`[data-gms-ref="${ref}"]`);
  if (!el) return { ok: false, error: `ref ${ref} not found` };
  el.scrollIntoView({ block: "center", inline: "center" });
  el.click();
  return { ok: true, ref };
}

function typeRefInPage(ref, value) {
  const el = document.querySelector(`[data-gms-ref="${ref}"]`);
  if (!el) return { ok: false, error: `ref ${ref} not found` };
  el.focus();
  if ("value" in el) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    el.textContent = value;
  }
  return { ok: true, ref };
}

// Listen for commands forwarded from the content script.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "gms.cmd") return false;
  const handler = HANDLERS[msg.cmd];
  (async () => {
    try {
      if (!handler) throw new Error(`Unknown command: ${msg.cmd}`);
      const result = await handler(msg.args || {});
      sendResponse({ type: "gms.result", id: msg.id, ok: true, result });
    } catch (error) {
      sendResponse({
        type: "gms.result",
        id: msg.id,
        ok: false,
        error: String(error?.message || error)
      });
    }
  })();
  return true; // async response
});

// Keep the service worker alive briefly when commands are coming in.
chrome.runtime.onInstalled.addListener(() => {
  console.log(`[GiveMeSpace Companion] installed v${VERSION}`);
});
