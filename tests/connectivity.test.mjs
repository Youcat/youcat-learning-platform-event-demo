import test from "node:test";
import assert from "node:assert/strict";
import { NetworkDeadlineError, withNetworkDeadline } from "../src/connectivity.js";

test("network deadlines return fast without cancelling a later operation", async () => {
  let completed = false;
  const operation = new Promise((resolve) => setTimeout(() => { completed = true; resolve("saved"); }, 30));
  await assert.rejects(withNetworkDeadline(operation, 5), NetworkDeadlineError);
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(completed, true);
});

test("network deadlines preserve fast successful results", async () => {
  assert.equal(await withNetworkDeadline(Promise.resolve("saved"), 50), "saved");
});
