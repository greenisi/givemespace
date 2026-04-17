import { decryptSharePayload, ensureWebCrypto } from "/pages/res/share-crypto.js";

const CLOUD_SHARE_ROUTE_PATTERN = /^\/share\/space\/([A-Za-z0-9]{8})$/u;

function getTokenFromLocation(locationLike = window.location) {
  const match = String(locationLike.pathname || "").match(CLOUD_SHARE_ROUTE_PATTERN);
  return match ? match[1] : "";
}

function setStatus(message, tone = "") {
  const statusElement = document.getElementById("share-status");

  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.className = tone ? "share-status " + tone : "share-status";
}

async function readJson(pathname) {
  const response = await fetch(pathname, {
    method: "GET"
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

async function readShareArchive(token) {
  const response = await fetch("/api/cloud_share_download?token=" + encodeURIComponent(token), {
    method: "GET"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed.");
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function cloneShareArchive(token, payloadBytes) {
  const response = await fetch("/api/cloud_share_clone?token=" + encodeURIComponent(token), {
    method: "POST",
    headers: {
      "Content-Type": "application/zip"
    },
    body: payloadBytes
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function togglePasswordPrompt(visible) {
  const prompt = document.getElementById("share-password-prompt");

  if (!prompt) {
    return;
  }

  prompt.hidden = !visible;
}

async function openSharedSpace({ token, encryption = null, password = "" }) {
  setStatus("Preparing shared space...");
  const shareBytes = await readShareArchive(token);
  let archiveBytes = shareBytes;

  if (encryption?.encrypted === true) {
    try {
      archiveBytes = await decryptSharePayload(shareBytes, encryption, password);
    } catch {
      throw new Error("Incorrect password or corrupted share.");
    }
  }

  setStatus("Creating guest space...");
  const cloneResult = await cloneShareArchive(token, archiveBytes);
  setStatus("Opening shared space...", "ok");
  window.location.replace(String(cloneResult.redirectUrl || "/"));
}

async function init() {
  const token = getTokenFromLocation();
  const passwordForm = document.getElementById("share-password-form");
  const passwordInput = document.getElementById("share-password-input");
  const passwordSubmit = document.getElementById("share-password-submit");
  const backdropRoot = document.querySelector("[data-space-backdrop]");

  window.SpaceBackdrop?.install?.(backdropRoot, {
    canvas: document.body,
    motionQuery: window.matchMedia("(prefers-reduced-motion: reduce)")
  });

  if (!token) {
    setStatus("Cloud share not found.", "error");
    return;
  }

  let shareInfo;

  try {
    shareInfo = await readJson("/api/cloud_share_info?token=" + encodeURIComponent(token));
  } catch (error) {
    setStatus(error.message || "Cloud share not found.", "error");
    return;
  }

  const encryption =
    shareInfo.encrypted === true && shareInfo.encryption && typeof shareInfo.encryption === "object"
      ? {
          ...shareInfo.encryption,
          encrypted: true
        }
      : null;

  if (shareInfo.encrypted === true) {
    try {
      ensureWebCrypto();
    } catch (error) {
      setStatus(error.message || "Password-protected cloud shares are not supported in this browser.", "error");
      return;
    }

    togglePasswordPrompt(true);
    setStatus("Enter the share password.");
    passwordInput?.focus();
    passwordForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = String(passwordInput?.value || "");

      if (!password) {
        setStatus("Enter the share password.", "error");
        passwordInput?.focus();
        return;
      }

      if (passwordSubmit) {
        passwordSubmit.disabled = true;
      }

      try {
        await openSharedSpace({
          encryption,
          password,
          token
        });
      } catch (error) {
        setStatus(error.message || "Could not open the shared space.", "error");
        if (passwordSubmit) {
          passwordSubmit.disabled = false;
        }
        passwordInput?.select();
      }
    });
    return;
  }

  try {
    await openSharedSpace({ token });
  } catch (error) {
    setStatus(error.message || "Could not open the shared space.", "error");
  }
}

void init();
