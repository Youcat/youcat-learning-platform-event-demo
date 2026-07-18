import { reportConnectivityError, setPendingOperations, withNetworkDeadline } from "./connectivity.js";

const STORAGE_KEY = "youcat-assis-outbox-v1";
const handlers = new Map();
const listeners = new Set();
let flushing = null;
let retryTimer = null;

function readQueue() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

let queue = typeof localStorage === "undefined" ? [] : readQueue();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue)); } catch {}
  setPendingOperations(queue.length);
  listeners.forEach((listener) => listener(queue.map((item) => ({ ...item }))));
}

function nextDelay(attempts) {
  return Math.min(30_000, 1_000 * (2 ** Math.min(5, attempts)));
}

function scheduleRetry(delay = 2_000) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { void flushOutbox(); }, delay);
}

export function registerOutboxHandler(type, handler) {
  handlers.set(type, handler);
  void flushOutbox();
}

export function subscribeOutbox(listener) {
  listeners.add(listener);
  listener(queue.map((item) => ({ ...item })));
  return () => listeners.delete(listener);
}

export function pendingOutboxCount() {
  return queue.length;
}

export function enqueueOutbox(type, payload, { id = crypto.randomUUID() } = {}) {
  const existing = queue.find((item) => item.id === id);
  if (existing) {
    existing.payload = payload;
    existing.nextAttemptAt = 0;
    persist();
    void flushOutbox();
    return existing;
  }
  const item = { id, type, payload, attempts: 0, createdAt: Date.now(), nextAttemptAt: 0 };
  queue.push(item);
  persist();
  void flushOutbox();
  return item;
}

export function removeOutboxItem(id) {
  queue = queue.filter((item) => item.id !== id);
  persist();
}

export async function flushOutbox() {
  if (flushing || !queue.length || (typeof navigator !== "undefined" && !navigator.onLine)) return flushing;
  flushing = (async () => {
    for (const item of [...queue]) {
      if (item.nextAttemptAt > Date.now()) continue;
      const handler = handlers.get(item.type);
      if (!handler) continue;
      try {
        await withNetworkDeadline(handler(item.payload, item), 8_000);
        removeOutboxItem(item.id);
      } catch (error) {
        item.attempts += 1;
        item.lastError = String(error?.message || error);
        item.nextAttemptAt = Date.now() + nextDelay(item.attempts);
        reportConnectivityError(error);
        persist();
      }
    }
  })().finally(() => {
    flushing = null;
    if (queue.length) scheduleRetry(Math.max(1_000, Math.min(...queue.map((item) => Math.max(0, item.nextAttemptAt - Date.now())))));
  });
  return flushing;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flushOutbox(); });
  window.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void flushOutbox(); });
  setPendingOperations(queue.length);
}
