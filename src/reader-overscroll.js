export const READER_OVERSCROLL_THRESHOLD = 64;

export function isScrollableReader({ scrollHeight = 0, clientHeight = 0 } = {}) {
  return scrollHeight > clientHeight + 4;
}

export function isReaderAtEnd({ scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = {}, tolerance = 3) {
  return scrollTop + clientHeight >= scrollHeight - tolerance;
}

export function accumulateReaderOverscroll({ accumulated = 0, delta = 0, atEnd = false } = {}, threshold = READER_OVERSCROLL_THRESHOLD) {
  if (!atEnd || delta <= 0) return { accumulated: 0, shouldAdvance: false };
  const next = Math.min(threshold, accumulated + delta);
  return { accumulated: next, shouldAdvance: next >= threshold };
}

export function bindReaderOverscroll(scroller, { onAdvance, threshold = READER_OVERSCROLL_THRESHOLD } = {}) {
  if (!scroller || typeof onAdvance !== "function") return () => {};

  const refreshContainment = () => scroller.classList.toggle("has-reader-overscroll", isScrollableReader(scroller));
  refreshContainment();

  let accumulated = 0;
  let touchX = 0;
  let touchY = 0;
  let touchActive = false;
  let shouldAdvanceOnTouchEnd = false;
  let resetTimer = null;
  let cooldownUntil = 0;

  const reset = () => {
    accumulated = 0;
    shouldAdvanceOnTouchEnd = false;
    scroller.closest?.(".reader-panel")?.classList.remove("is-pulling-forward");
  };
  const scheduleReset = () => {
    clearTimeout(resetTimer);
    resetTimer = setTimeout(reset, 220);
  };
  const advance = () => {
    if (Date.now() < cooldownUntil) return;
    cooldownUntil = Date.now() + 800;
    reset();
    onAdvance();
  };
  const addPull = (delta) => {
    const result = accumulateReaderOverscroll({
      accumulated,
      delta,
      atEnd: isReaderAtEnd(scroller),
    }, threshold);
    accumulated = result.accumulated;
    scroller.closest?.(".reader-panel")?.classList.toggle("is-pulling-forward", accumulated > 0);
    return result.shouldAdvance;
  };

  const onWheel = (event) => {
    refreshContainment();
    if (!isScrollableReader(scroller) || event.deltaY <= 0 || !isReaderAtEnd(scroller)) {
      reset();
      return;
    }
    event.preventDefault();
    if (addPull(event.deltaY)) advance();
    else scheduleReset();
  };
  const onTouchStart = (event) => {
    refreshContainment();
    const touch = event.touches?.[0];
    if (!touch) return;
    reset();
    touchActive = true;
    touchX = touch.clientX;
    touchY = touch.clientY;
  };
  const onTouchMove = (event) => {
    if (!touchActive || !isScrollableReader(scroller)) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    const deltaY = touchY - touch.clientY;
    const deltaX = Math.abs(touchX - touch.clientX);
    touchY = touch.clientY;
    if (deltaY <= 0 || deltaX > Math.abs(deltaY) * 1.25 || !isReaderAtEnd(scroller)) {
      if (deltaY < 0) reset();
      return;
    }
    if (event.cancelable) event.preventDefault();
    shouldAdvanceOnTouchEnd = addPull(deltaY) || shouldAdvanceOnTouchEnd;
  };
  const onTouchEnd = () => {
    touchActive = false;
    if (shouldAdvanceOnTouchEnd) advance();
    else reset();
  };

  scroller.addEventListener("wheel", onWheel, { passive: false });
  scroller.addEventListener("touchstart", onTouchStart, { passive: true });
  scroller.addEventListener("touchmove", onTouchMove, { passive: false });
  scroller.addEventListener("touchend", onTouchEnd, { passive: true });
  scroller.addEventListener("touchcancel", onTouchEnd, { passive: true });

  return () => {
    clearTimeout(resetTimer);
    scroller.removeEventListener("wheel", onWheel);
    scroller.removeEventListener("touchstart", onTouchStart);
    scroller.removeEventListener("touchmove", onTouchMove);
    scroller.removeEventListener("touchend", onTouchEnd);
    scroller.removeEventListener("touchcancel", onTouchEnd);
    scroller.classList.remove("has-reader-overscroll");
    reset();
  };
}
