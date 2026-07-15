let phaserRuntimePromise = null;
let preloadScheduled = false;

export function loadPhaserRuntime() {
  phaserRuntimePromise ||= import("phaser").then((module) => module.default || module);
  return phaserRuntimePromise;
}

export function preloadPhaserRuntimeAfterHome() {
  if (preloadScheduled) return;
  preloadScheduled = true;
  const warm = () => { void loadPhaserRuntime(); };
  if (typeof requestIdleCallback === "function") requestIdleCallback(warm, { timeout: 1500 });
  else setTimeout(warm, 0);
}
