let phaserRuntimePromise = null;

export function loadPhaserRuntime() {
  phaserRuntimePromise ||= import("phaser").then((module) => module.default || module);
  return phaserRuntimePromise;
}
