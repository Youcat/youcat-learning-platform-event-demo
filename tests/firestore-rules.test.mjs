import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

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

test("simultaneous declarations produce one immutable frozen winner", { skip: !emulatorAvailable }, async () => {
  const firstDb = environment.authenticatedContext("participant-f").firestore();
  const secondDb = environment.authenticatedContext("participant-g").firestore();
  const eventRef = doc(firstDb, "missionEvent/assis-2026-07-26");
  const standings = [
    { groupCode: "Assis-Sao-Jose", totalXp: 1300, targetXp: 1300, members: 10, participants: 10, averageXp: 130 },
    { groupCode: "Assis-Santa-Clara", totalXp: 1305, targetXp: 1300, members: 10, participants: 10, averageXp: 131 },
  ];
  const declare = (db, standing) => runTransaction(db, async (transaction) => {
    const ref = doc(db, "missionEvent/assis-2026-07-26");
    const snapshot = await transaction.get(ref);
    if (snapshot.data()?.winnerGroup) return snapshot.data().winnerGroup;
    transaction.set(ref, {
      winnerGroup: standing.groupCode,
      winnerXp: standing.totalXp,
      winnerTarget: standing.targetXp,
      winnerMemberCount: standing.members,
      finalStandings: standings,
      winnerDeclaredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return standing.groupCode;
  });
  await Promise.all([declare(firstDb, standings[0]), declare(secondDb, standings[1])]);
  const winnerSnapshot = await getDoc(eventRef);
  const winner = winnerSnapshot.data();
  assert.ok([standings[0].groupCode, standings[1].groupCode].includes(winner.winnerGroup));
  await assertSucceeds(updateDoc(eventRef, { resolved: { 14: 8 }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(eventRef, {
    winnerGroup: winner.winnerGroup === standings[0].groupCode ? standings[1].groupCode : standings[0].groupCode,
    winnerXp: 1400,
    updatedAt: serverTimestamp(),
  }));
});
