import { streamChatCompletion } from "../chat/api.js";
import {
  clearChatDraft,
  clearChatHistory,
  loadChatDraft,
  loadChatHistory,
  loadChatSettings,
  loadSystemPrompt,
  saveChatDraft,
  saveChatHistory,
  saveChatSettings,
  saveSystemPrompt
} from "../chat/storage.js";

function createMessage(role, content) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role,
    content
  };
}

function summarizeSystemPrompt(systemPrompt) {
  if (!systemPrompt.trim()) {
    return "No system prompt";
  }

  const preview = systemPrompt.trim().replace(/\s+/g, " ");
  return preview.length > 72 ? `${preview.slice(0, 72)}...` : preview;
}

function summarizeEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.host;
  } catch (error) {
    return endpoint || "Not set";
  }
}

function autoResizeTextarea(textarea) {
  textarea.style.height = "0px";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
}

function renderMessages(thread, history) {
  thread.innerHTML = "";

  if (!history.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "chat-empty";
    emptyState.textContent =
      "Your messages, the system prompt, connection settings, and the current draft are stored locally in this browser.";
    thread.append(emptyState);
    return;
  }

  history.forEach((message) => {
    const row = document.createElement("div");
    row.className = `message-row ${message.role}`;

    const bubble = document.createElement("article");
    bubble.className = "message-bubble";

    if (message.streaming) {
      bubble.classList.add("is-streaming");
    }

    const label = document.createElement("span");
    label.className = "message-label";
    label.textContent = message.role === "user" ? "You" : "Assistant";

    const content = document.createElement("p");
    content.className = "message-content";
    content.textContent = message.content || (message.streaming ? "Streaming..." : "");

    bubble.append(label, content);
    row.append(bubble);
    thread.append(row);
  });

  thread.scrollTop = thread.scrollHeight;
}

function updateSummary(elements, state) {
  elements.endpointSummary.textContent = summarizeEndpoint(state.settings.apiEndpoint);
  elements.modelSummary.textContent = state.settings.model || "Not set";
  elements.promptSummary.textContent = summarizeSystemPrompt(state.systemPrompt);
}

function setStatus(elements, message) {
  elements.status.textContent = message;
}

function persistHistory(state) {
  saveChatHistory(
    state.history.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content
    }))
  );
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }

  dialog.setAttribute("open", "open");
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }

  dialog.removeAttribute("open");
}

export function initializeChatInterface() {
  const elements = {
    thread: document.querySelector("[data-chat-thread]"),
    form: document.querySelector("[data-chat-form]"),
    input: document.querySelector("[data-chat-input]"),
    sendButton: document.querySelector("[data-chat-send-button]"),
    clearButton: document.querySelector("[data-chat-clear-button]"),
    systemButton: document.querySelector("[data-chat-system-button]"),
    settingsButton: document.querySelector("[data-chat-settings-button]"),
    status: document.querySelector("[data-chat-status]"),
    endpointSummary: document.querySelector("[data-chat-endpoint-summary]"),
    modelSummary: document.querySelector("[data-chat-model-summary]"),
    promptSummary: document.querySelector("[data-chat-prompt-summary]"),
    systemDialog: document.querySelector("[data-chat-system-dialog]"),
    systemForm: document.querySelector("[data-chat-system-form]"),
    systemInput: document.querySelector("[data-chat-system-input]"),
    systemCancel: document.querySelector("[data-chat-system-cancel]"),
    settingsDialog: document.querySelector("[data-chat-settings-dialog]"),
    settingsForm: document.querySelector("[data-chat-settings-form]"),
    settingsCancel: document.querySelector("[data-chat-settings-cancel]"),
    endpointInput: document.querySelector("[data-chat-endpoint-input]"),
    modelInput: document.querySelector("[data-chat-model-input]"),
    apiKeyInput: document.querySelector("[data-chat-api-key-input]")
  };

  if (!elements.thread || !elements.form || !elements.input) {
    return;
  }

  const state = {
    history: loadChatHistory(),
    isSending: false,
    settings: loadChatSettings(),
    systemPrompt: loadSystemPrompt()
  };

  elements.input.value = loadChatDraft();
  autoResizeTextarea(elements.input);
  renderMessages(elements.thread, state.history);
  updateSummary(elements, state);
  setStatus(elements, "Ready.");

  elements.input.addEventListener("input", () => {
    saveChatDraft(elements.input.value);
    autoResizeTextarea(elements.input);
  });

  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.form.requestSubmit();
    }
  });

  elements.clearButton.addEventListener("click", () => {
    if (!window.confirm("Clear this chat history?")) {
      return;
    }

    state.history = [];
    persistHistory(state);
    clearChatHistory();
    renderMessages(elements.thread, state.history);
    setStatus(elements, "Chat cleared.");
  });

  elements.systemButton.addEventListener("click", () => {
    elements.systemInput.value = state.systemPrompt;
    openDialog(elements.systemDialog);
  });

  elements.systemCancel.addEventListener("click", () => {
    closeDialog(elements.systemDialog);
  });

  elements.systemForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.systemPrompt = elements.systemInput.value;
    saveSystemPrompt(state.systemPrompt);
    updateSummary(elements, state);
    setStatus(elements, "System prompt updated.");
    closeDialog(elements.systemDialog);
  });

  elements.settingsButton.addEventListener("click", () => {
    elements.endpointInput.value = state.settings.apiEndpoint;
    elements.modelInput.value = state.settings.model;
    elements.apiKeyInput.value = state.settings.apiKey;
    openDialog(elements.settingsDialog);
  });

  elements.settingsCancel.addEventListener("click", () => {
    closeDialog(elements.settingsDialog);
  });

  elements.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();

    state.settings = {
      apiEndpoint: elements.endpointInput.value.trim(),
      model: elements.modelInput.value.trim(),
      apiKey: elements.apiKeyInput.value.trim()
    };

    saveChatSettings(state.settings);
    updateSummary(elements, state);
    setStatus(elements, "Connection settings updated.");
    closeDialog(elements.settingsDialog);
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.isSending) {
      return;
    }

    const messageText = elements.input.value.trim();
    if (!messageText) {
      return;
    }

    state.isSending = true;
    elements.sendButton.disabled = true;
    elements.input.disabled = true;

    const userMessage = createMessage("user", messageText);
    const assistantMessage = {
      ...createMessage("assistant", ""),
      streaming: true
    };

    const requestMessages = [...state.history, userMessage];
    state.history = [...requestMessages, assistantMessage];
    persistHistory(state);
    renderMessages(elements.thread, state.history);

    elements.input.value = "";
    clearChatDraft();
    autoResizeTextarea(elements.input);
    setStatus(elements, "Streaming response...");

    try {
      await streamChatCompletion({
        settings: state.settings,
        systemPrompt: state.systemPrompt,
        messages: requestMessages,
        onDelta(delta) {
          assistantMessage.content += delta;
          persistHistory(state);
          renderMessages(elements.thread, state.history);
        }
      });

      assistantMessage.streaming = false;
      if (!assistantMessage.content.trim()) {
        assistantMessage.content = "[No content returned]";
      }

      persistHistory(state);
      renderMessages(elements.thread, state.history);
      setStatus(elements, "Ready.");
    } catch (error) {
      assistantMessage.streaming = false;

      if (!assistantMessage.content.trim()) {
        state.history = requestMessages;
      }

      persistHistory(state);
      renderMessages(elements.thread, state.history);
      setStatus(elements, error.message);
    } finally {
      state.isSending = false;
      elements.sendButton.disabled = false;
      elements.input.disabled = false;
      elements.input.focus();
    }
  });
}
