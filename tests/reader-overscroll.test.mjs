import test from "node:test";
import assert from "node:assert/strict";
import {
  accumulateReaderOverscroll,
  isReaderAtEnd,
  isScrollableReader,
} from "../src/reader-overscroll.js";

test("reader hand-off is only available for overflowing text at its end", () => {
  assert.equal(isScrollableReader({ scrollHeight: 700, clientHeight: 500 }), true);
  assert.equal(isScrollableReader({ scrollHeight: 500, clientHeight: 500 }), false);
  assert.equal(isReaderAtEnd({ scrollTop: 197, clientHeight: 500, scrollHeight: 700 }), true);
  assert.equal(isReaderAtEnd({ scrollTop: 150, clientHeight: 500, scrollHeight: 700 }), false);
});

test("reader hand-off requires a deliberate extra pull", () => {
  const first = accumulateReaderOverscroll({ accumulated: 0, delta: 25, atEnd: true }, 64);
  assert.deepEqual(first, { accumulated: 25, shouldAdvance: false });
  const second = accumulateReaderOverscroll({ accumulated: first.accumulated, delta: 39, atEnd: true }, 64);
  assert.deepEqual(second, { accumulated: 64, shouldAdvance: true });
  assert.deepEqual(
    accumulateReaderOverscroll({ accumulated: 40, delta: 20, atEnd: false }, 64),
    { accumulated: 0, shouldAdvance: false },
  );
});
