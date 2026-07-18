import test from "node:test";
import assert from "node:assert/strict";
import { GROUPS, groupDisplayName } from "../src/groups.js";

test("group display names omit the internal Assis prefix", () => {
  assert.equal(groupDisplayName("Assis-Sao-Jose"), "Sao-Jose");
  assert.equal(groupDisplayName(GROUPS.find((group) => group.code === "Assis-Santa-Clara")), "Santa-Clara");
  assert.equal(GROUPS.every((group) => !groupDisplayName(group).startsWith("Assis-")), true);
});
