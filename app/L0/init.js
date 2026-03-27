const SHELL_STORAGE_KEY = "agent-one.shell.active-app";

const APPS = {
  chat: {
    id: "chat",
    path: "/pages/chat.html",
    title: "Chat",
    subtitle: "OpenAI-compatible streaming chat with local persistence."
  },
  tests: {
    id: "tests",
    path: "/pages/tests.html",
    title: "Test Suite",
    subtitle: "Proxy, asset, image, and download verification playground."
  }
};

function getAppFromHash() {
  const hashValue = window.location.hash.replace(/^#/, "");
  return APPS[hashValue] || null;
}

function getStoredApp() {
  const storedValue = window.localStorage.getItem(SHELL_STORAGE_KEY);
  return APPS[storedValue] || null;
}

function getInitialApp() {
  return getAppFromHash() || getStoredApp() || APPS.chat;
}

function updateShellChrome(app) {
  const buttons = document.querySelectorAll("[data-shell-app]");

  buttons.forEach((button) => {
    const isActive = button.getAttribute("data-shell-app") === app.id;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  document.title = `Agent One · ${app.title}`;
}

function navigateToApp(app) {
  const frame = document.querySelector("[data-shell-frame]");
  if (!frame) {
    return;
  }

  if (frame.getAttribute("src") !== app.path) {
    frame.setAttribute("src", app.path);
  }

  window.localStorage.setItem(SHELL_STORAGE_KEY, app.id);

  if (window.location.hash !== `#${app.id}`) {
    window.location.hash = app.id;
  }

  updateShellChrome(app);
}

function initializeShellNavigation() {
  const buttons = document.querySelectorAll("[data-shell-app]");
  const initialApp = getInitialApp();

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const appId = button.getAttribute("data-shell-app");
      const app = APPS[appId];

      if (!app) {
        return;
      }

      navigateToApp(app);
    });
  });

  window.addEventListener("hashchange", () => {
    const app = getAppFromHash() || APPS.chat;
    navigateToApp(app);
  });

  navigateToApp(initialApp);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeShellNavigation, { once: true });
} else {
  initializeShellNavigation();
}
