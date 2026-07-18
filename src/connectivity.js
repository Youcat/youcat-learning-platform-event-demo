const listeners = new Set();
const state = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  pending: 0,
  lastError: "",
};

function emit() {
  const snapshot = { ...state };
  listeners.forEach((listener) => listener(snapshot));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("youcat:connectivity", { detail: snapshot }));
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { state.online = true; state.lastError = ""; emit(); });
  window.addEventListener("offline", () => { state.online = false; emit(); });
}

export function connectivitySnapshot() {
  return { ...state };
}

export function subscribeConnectivity(listener) {
  listeners.add(listener);
  listener(connectivitySnapshot());
  return () => listeners.delete(listener);
}

export function setPendingOperations(count) {
  state.pending = Math.max(0, Number(count) || 0);
  emit();
}

export function reportConnectivityError(error) {
  state.lastError = String(error?.message || error || "network-error");
  emit();
}

export class NetworkDeadlineError extends Error {
  constructor(message = "network-deadline") {
    super(message);
    this.name = "NetworkDeadlineError";
  }
}

export function withNetworkDeadline(promise, timeoutMs = 5_000) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new NetworkDeadlineError()), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

