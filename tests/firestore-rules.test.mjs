import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

let environment;
const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

before(async () => {
  if (!emulatorAvailable) return;
  environment = await initializeTestEnvironment({
    projectId: "youcat-reflection-rules-test",
    firestore: { rules: await fs.readFile(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});

after(async () => {
  await environment?.cleanup();
});

function reflection(overrides = {}) {
  return {
    authorUid: "participant-a",
    name: "Maria",
    text: "Uma reflexão válida para o teste.",
    voters: [],
    roomCode: "Assis-Sao-Jose",
    questionNumber: "14",
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

test("a participant can create an owned reflection without an age", { skip: !emulatorAvailable }, async () => {
  const db = environment.authenticatedContext("participant-a").firestore();
  await assertSucceeds(setDoc(
    doc(db, "rooms/Assis-Sao-Jose/questions/14/reflections/participant-a"),
    reflection(),
  ));
});

test("legacy reflections may still contain a valid age", { skip: !emulatorAvailable }, async () => {
  const db = environment.authenticatedContext("participant-b").firestore();
  await assertSucceeds(setDoc(
    doc(db, "rooms/Assis-Sao-Jose/questions/14/reflections/participant-b"),
    reflection({ authorUid: "participant-b", age: 22 }),
  ));
});

test("ownership and content constraints are enforced", { skip: !emulatorAvailable }, async () => {
  const db = environment.authenticatedContext("participant-c").firestore();
  await assertFails(setDoc(
    doc(db, "rooms/Assis-Sao-Jose/questions/14/reflections/someone-else"),
    reflection({ authorUid: "participant-c" }),
  ));
  await assertFails(setDoc(
    doc(db, "rooms/Assis-Sao-Jose/questions/14/reflections/participant-c"),
    reflection({ authorUid: "participant-c", text: "" }),
  ));
  assert.ok(true);
});

test("a participant can reserve and complete an independent group challenge", { skip: !emulatorAvailable }, async () => {
  const db = environment.authenticatedContext("participant-d").firestore();
  const challengeRef = doc(db, "missionGroups/Assis-Sao-Jose/challenges/q14-quiz");
  await assertSucceeds(setDoc(challengeRef, {
    challengeId: "q14-quiz",
    questionNumber: "14",
    status: "reserved",
    reservedBy: "participant-d",
    leaseUntil: Date.now() + 60_000,
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(setDoc(challengeRef, {
    challengeId: "q14-quiz",
    questionNumber: "14",
    status: "completed",
    completedBy: "participant-d",
    correct: true,
    xpAwarded: 10,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
});

test("heart votes are immutable and owned by the voter", { skip: !emulatorAvailable }, async () => {
  const db = environment.authenticatedContext("participant-e").firestore();
  const voteRef = doc(db, "heartVotes/participant-e__14__participant-a");
  const vote = {
    authorUid: "participant-a",
    voterUid: "participant-e",
    reflectionId: "participant-a",
    roomCode: "Assis-Sao-Jose",
    questionNumber: "14",
    createdAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(voteRef, vote));
  await assertFails(setDoc(voteRef, { ...vote, authorUid: "participant-b" }));
});
