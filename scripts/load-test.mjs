import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInAnonymously,
} from "firebase/auth";
import {
  arrayUnion,
  collection,
  collectionGroup,
  connectFirestoreEmulator,
  disableNetwork,
  doc,
  enableNetwork,
  getCountFromServer,
  getFirestore,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { GROUPS } from "../src/groups.js";

const userCount = positiveInteger(process.env.LOAD_USERS, 200);
const roomSize = positiveInteger(process.env.LOAD_ROOM_SIZE, 10);
const questions = (process.env.LOAD_QUESTIONS || "3,14,25,34,59,68,83,126,127,140")
  .split(",")
  .map(Number)
  .filter(Number.isInteger);
const heartsPerQuestion = positiveInteger(process.env.LOAD_HEARTS_PER_QUESTION, 3);
const productionTarget = process.env.LOAD_TARGET === "production";
const productionConfig = productionTarget ? readViteEnvironment() : null;
const projectId = productionConfig?.projectId || process.env.GCLOUD_PROJECT || "demo-youcat-loadtest";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const timeoutMs = positiveInteger(process.env.LOAD_TIMEOUT_MS, 60_000);
const delayedUsers = Math.min(userCount, Number(process.env.LOAD_DELAYED_USERS || 0));
const maximumDelayMs = Math.max(0, Number(process.env.LOAD_MAX_DELAY_MS || 0));
const recoveryDelayMs = Math.max(0, Number(process.env.LOAD_RECOVERY_DELAY_MS || 0));

if (userCount % roomSize !== 0) throw new Error("LOAD_USERS must be divisible by LOAD_ROOM_SIZE.");
if (!questions.length) throw new Error("LOAD_QUESTIONS must include at least one question number.");
if (heartsPerQuestion >= roomSize) throw new Error("LOAD_HEARTS_PER_QUESTION must be smaller than LOAD_ROOM_SIZE.");

const samples = {
  authentication: [],
  answerWrites: [],
  heartWrites: [],
  answerPropagation: [],
  heartPropagation: [],
  leaderboardWrites: [],
  leaderboardPropagation: [],
  challengeWrites: [],
  connectionRecovery: [],
};
const errors = [];
let snapshotCallbacks = 0;
const startedAt = performance.now();

console.log(`Starting ${userCount} users in ${userCount / roomSize} rooms.`);
console.log(`${questions.length} questions per user, ${heartsPerQuestion * questions.length} hearts per user.`);
console.log(`Target: ${productionTarget ? "production Firebase" : "local emulators"}.`);

const users = await Promise.all(Array.from({ length: userCount }, (_, index) => createUser(index)));
await runMeasured("authentication", () => Promise.all(users.map(authenticateUser)));

console.log(`Leaderboard: syncing ${userCount} participants across ${GROUPS.length} groups.`);
const leaderboardListeners = openLeaderboardViews(users[0]);
await withTimeout(leaderboardListeners.initial, "initial leaderboard views");
const leaderboardStart = performance.now();
await Promise.all(users.map(publishLeaderboard));
await withTimeout(leaderboardListeners.ready, "leaderboard propagation");
samples.leaderboardPropagation.push(performance.now() - leaderboardStart);
leaderboardListeners.unsubscribe();
console.log("Leaderboard: complete.");

if (recoveryDelayMs) await verifyConnectionRecovery(users[0]);

console.log("Challenges: reserving and completing independent per-challenge documents.");
await publishGroupChallenges();
console.log("Challenges: complete.");

for (const questionNumber of questions) {
  console.log(`Question ${questionNumber}: opening ${userCount} live feeds.`);
  const listeners = users.map((user) => openFeed(user, questionNumber));
  await withTimeout(Promise.all(listeners.map((listener) => listener.initial)), `initial feeds for question ${questionNumber}`);

  const answerStart = performance.now();
  await Promise.all(users.map((user) => publishAnswer(user, questionNumber)));
  await withTimeout(Promise.all(listeners.map((listener) => listener.answersReady)), `answer propagation for question ${questionNumber}`);
  samples.answerPropagation.push(performance.now() - answerStart);

  const heartStart = performance.now();
  await Promise.all(users.flatMap((user) => publishHearts(user, questionNumber)));
  await withTimeout(Promise.all(listeners.map((listener) => listener.heartsReady)), `heart propagation for question ${questionNumber}`);
  samples.heartPropagation.push(performance.now() - heartStart);

  listeners.forEach((listener) => listener.unsubscribe());
  await verifyGlobalOverview(users[0], questionNumber);
  console.log(`Question ${questionNumber}: complete.`);
}

await Promise.all(users.map(cleanUpUser));

const elapsedMs = performance.now() - startedAt;
const result = {
  scenario: {
    users: userCount,
    rooms: userCount / roomSize,
    roomSize,
    questionsPerUser: questions.length,
    heartsPerUser: heartsPerQuestion * questions.length,
    totalWrites: (
      userCount * questions.length * (1 + heartsPerQuestion)
      + userCount * 2
      + (userCount / roomSize) * questions.length * 10
    ),
    maximumConcurrentListeners: userCount,
  },
  elapsedSeconds: round(elapsedMs / 1000),
  snapshotCallbacks,
  latencyMs: Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, summarize(values)])),
  errors,
};

console.log("\nLOAD_TEST_RESULT");
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length ? 1 : 0);

async function createUser(index) {
  const app = initializeApp(productionConfig || {
    apiKey: "demo-key",
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
  }, `load-user-${index}`);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (!productionTarget) {
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    const [host, port] = firestoreHost.split(":");
    connectFirestoreEmulator(db, host, Number(port));
  }
  return {
    app,
    auth,
    db,
    index,
    roomCode: GROUPS[Math.floor(index / roomSize)].code,
  };
}

function openLeaderboardViews(user) {
  const initial = deferred();
  const ready = deferred();
  let initialSnapshots = 0;
  const readyGroups = new Set();
  const activeGroups = GROUPS.slice(0, userCount / roomSize);
  const unsubs = activeGroups.map((group) => {
    const memberQuery = query(
      collection(user.db, "leaderboardGroups", group.code, "members"),
      where("active", "==", true),
      limit(100),
    );
    return onSnapshot(memberQuery, (snapshot) => {
      snapshotCallbacks += 1;
      initialSnapshots += 1;
      if (initialSnapshots === activeGroups.length) initial.resolve();
      if (snapshot.size === roomSize) readyGroups.add(group.code);
      checkReady();
    }, ready.reject);
  });
  function checkReady() {
    if (readyGroups.size === activeGroups.length) ready.resolve();
  }
  return { initial: initial.promise, ready: ready.promise, unsubscribe: () => { unsubs.forEach((fn) => fn()); } };
}

async function publishLeaderboard(user) {
  const start = performance.now();
  const xp = 10 + (user.index % 20) * 5;
  try {
    const participantRef = doc(user.db, "leaderboardParticipants", user.uid);
    const memberRef = doc(user.db, "leaderboardGroups", user.roomCode, "members", user.uid);
    await Promise.all([
      setDoc(participantRef, {
        uid: user.uid,
        displayName: `Load User ${String(user.index + 1).padStart(3, "0")}`,
        currentGroup: user.roomCode,
        personalXp: xp,
        updatedAt: serverTimestamp(),
      }),
      setDoc(memberRef, {
        uid: user.uid,
        groupCode: user.roomCode,
        displayName: `Load User ${String(user.index + 1).padStart(3, "0")}`,
        personalXp: xp,
        groupXp: xp,
        questionXp: {},
        active: true,
        updatedAt: serverTimestamp(),
      }),
    ]);
    samples.leaderboardWrites.push(performance.now() - start);
  } catch (error) {
    recordError("leaderboard", user.index, error);
    throw error;
  }
}

async function publishGroupChallenges() {
  const activeGroupCount = userCount / roomSize;
  const operations = [];
  for (let groupIndex = 0; groupIndex < activeGroupCount; groupIndex += 1) {
    for (const questionNumber of questions) {
      for (let challengeIndex = 0; challengeIndex < 5; challengeIndex += 1) {
        const user = users[(groupIndex * roomSize) + ((questionNumber + challengeIndex) % roomSize)];
        const challengeId = `q${questionNumber}-${challengeIndex}`;
        operations.push((async () => {
          const start = performance.now();
          const challengeRef = doc(user.db, "missionGroups", user.roomCode, "challenges", challengeId);
          await setDoc(challengeRef, {
            challengeId,
            questionNumber: String(questionNumber),
            status: "reserved",
            reservedBy: user.uid,
            leaseUntil: Date.now() + 300_000,
            updatedAt: serverTimestamp(),
          });
          await runTransaction(user.db, async (transaction) => {
            const snapshot = await transaction.get(challengeRef);
            if (snapshot.data()?.reservedBy !== user.uid) throw new Error("reservation-lost");
            transaction.set(challengeRef, {
              ...snapshot.data(),
              status: "completed",
              completedBy: user.uid,
              correct: challengeIndex % 4 !== 0,
              xpAwarded: challengeIndex % 4 !== 0 ? 5 + challengeIndex : 0,
              completedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          samples.challengeWrites.push(performance.now() - start);
        })());
      }
    }
  }
  await withTimeout(Promise.all(operations), "independent challenge writes");
}

async function authenticateUser(user) {
  const start = performance.now();
  try {
    await setPersistence(user.auth, inMemoryPersistence);
    const credential = await signInAnonymously(user.auth);
    user.uid = credential.user.uid;
    samples.authentication.push(performance.now() - start);
  } catch (error) {
    recordError("authentication", user.index, error);
    throw error;
  }
}

function openFeed(user, questionNumber) {
  const roomRef = collection(user.db, "rooms", user.roomCode, "questions", String(questionNumber), "reflections");
  const roomQuery = query(roomRef, orderBy("createdAt", "desc"), limit(150));
  const initial = deferred();
  const answersReady = deferred();
  const heartsReady = deferred();
  let initialSeen = false;

  let answerCount = 0;
  let heartCount = 0;
  const check = () => {
    if (answerCount === roomSize) answersReady.resolve();
    if (answerCount === roomSize && heartCount === roomSize * heartsPerQuestion) heartsReady.resolve();
  };
  const unsubscribeAnswers = onSnapshot(roomQuery, (snapshot) => {
    snapshotCallbacks += 1;
    if (!initialSeen) {
      initialSeen = true;
      initial.resolve();
    }
    answerCount = snapshot.size;
    check();
  }, (error) => {
    recordError("listener", user.index, error, questionNumber);
    initial.reject(error);
    answersReady.reject(error);
    heartsReady.reject(error);
  });
  const voteQuery = query(collection(user.db, "heartVotes"), where("questionNumber", "==", String(questionNumber)), limit(userCount * heartsPerQuestion));
  const unsubscribeVotes = onSnapshot(voteQuery, (snapshot) => {
    snapshotCallbacks += 1;
    heartCount = snapshot.docs.filter((item) => item.data().roomCode === user.roomCode).length;
    check();
  }, (error) => {
    recordError("heart-listener", user.index, error, questionNumber);
    heartsReady.reject(error);
  });

  return {
    initial: initial.promise,
    answersReady: answersReady.promise,
    heartsReady: heartsReady.promise,
    unsubscribe: () => { unsubscribeAnswers(); unsubscribeVotes(); },
  };
}

async function publishAnswer(user, questionNumber) {
  await applyClientDelay(user, questionNumber);
  const start = performance.now();
  try {
    const answerRef = doc(user.db, "rooms", user.roomCode, "questions", String(questionNumber), "reflections", user.uid);
    await setDoc(answerRef, {
      authorUid: user.uid,
      name: `Load User ${String(user.index + 1).padStart(3, "0")}`,
      text: `Load-test reflection for question ${questionNumber}.`,
      voters: [],
      roomCode: user.roomCode,
      questionNumber: String(questionNumber),
      createdAt: serverTimestamp(),
    });
    samples.answerWrites.push(performance.now() - start);
  } catch (error) {
    recordError("answer", user.index, error, questionNumber);
    throw error;
  }
}

function publishHearts(user, questionNumber) {
  const roomStart = Math.floor(user.index / roomSize) * roomSize;
  const position = user.index % roomSize;
  return Array.from({ length: heartsPerQuestion }, async (_, offset) => {
    await applyClientDelay(user, questionNumber, offset + 1);
    const targetPosition = (position + offset + 1) % roomSize;
    const target = users[roomStart + targetPosition];
    const start = performance.now();
    try {
      const voteRef = doc(user.db, "heartVotes", `${user.uid}__${questionNumber}__${target.uid}`);
      await setDoc(voteRef, {
        authorUid: target.uid,
        voterUid: user.uid,
        reflectionId: target.uid,
        roomCode: user.roomCode,
        questionNumber: String(questionNumber),
        createdAt: serverTimestamp(),
      });
      samples.heartWrites.push(performance.now() - start);
    } catch (error) {
      recordError("heart", user.index, error, questionNumber);
      throw error;
    }
  });
}

async function verifyConnectionRecovery(user) {
  const start = performance.now();
  await disableNetwork(user.db);
  const queuedWrite = setDoc(doc(user.db, "missionParticipants", user.uid), {
    uid: user.uid,
    currentGroup: user.roomCode,
    active: true,
    connectionRecoveryTestedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  const recoveryTimer = setTimeout(() => { void enableNetwork(user.db); }, recoveryDelayMs);
  try {
    await withTimeout(queuedWrite, "delayed connection recovery");
    samples.connectionRecovery.push(performance.now() - start);
  } finally {
    clearTimeout(recoveryTimer);
    await enableNetwork(user.db);
  }
}

async function applyClientDelay(user, questionNumber, offset = 0) {
  if (!delayedUsers || user.index < userCount - delayedUsers || !maximumDelayMs) return;
  const delayRange = Math.max(250, maximumDelayMs);
  const delay = 250 + ((user.index + questionNumber + offset) * 137) % delayRange;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function cleanUpUser(user) {
  if (productionTarget && user.auth.currentUser) {
    try {
      await deleteUser(user.auth.currentUser);
    } catch (error) {
      recordError("auth-cleanup", user.index, error);
    }
  }
  await deleteApp(user.app);
}

function readViteEnvironment() {
  const values = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.trim()]));
  const config = {
    apiKey: values.VITE_FIREBASE_API_KEY,
    authDomain: values.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: values.VITE_FIREBASE_PROJECT_ID,
    storageBucket: values.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: values.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: values.VITE_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((value) => !value)) {
    throw new Error("Production load test requires complete Firebase values in .env.local.");
  }
  return config;
}

async function verifyGlobalOverview(user, questionNumber) {
  const globalReflections = collectionGroup(user.db, "reflections");
  const questionFilter = where("questionNumber", "==", String(questionNumber));
  const countSnapshot = await getCountFromServer(query(globalReflections, questionFilter));
  if (countSnapshot.data().count !== userCount) {
    throw new Error(`Global count for question ${questionNumber} was ${countSnapshot.data().count}, expected ${userCount}.`);
  }
  const overviewSnapshot = await getDocs(query(
    globalReflections,
    questionFilter,
    orderBy("createdAt", "desc"),
    limit(Math.min(50, userCount)),
  ));
  if (overviewSnapshot.size !== Math.min(50, userCount)) {
    throw new Error(`Global overview for question ${questionNumber} returned ${overviewSnapshot.size} answers.`);
  }
}

async function runMeasured(name, action) {
  const start = performance.now();
  await action();
  console.log(`${name}: ${round(performance.now() - start)} ms total.`);
}

function recordError(phase, userIndex, error, questionNumber) {
  errors.push({
    phase,
    user: userIndex + 1,
    questionNumber,
    code: error?.code,
    message: error?.message || String(error),
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function withTimeout(promise, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timed out waiting for ${label}.`)), timeoutMs);
  });
  return Promise.race([
    promise,
    timeout,
  ]).finally(() => clearTimeout(timeoutId));
}

function summarize(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    min: round(sorted[0]),
    median: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    max: round(sorted.at(-1)),
  };
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function positiveInteger(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Expected a positive integer, received ${value}.`);
  return parsed;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
