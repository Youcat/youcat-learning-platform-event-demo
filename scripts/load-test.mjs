import { performance } from "node:perf_hooks";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInAnonymously,
} from "firebase/auth";
import {
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const userCount = positiveInteger(process.env.LOAD_USERS, 200);
const roomSize = positiveInteger(process.env.LOAD_ROOM_SIZE, 10);
const questions = (process.env.LOAD_QUESTIONS || "3,14,25,34,59")
  .split(",")
  .map(Number)
  .filter(Number.isInteger);
const heartsPerQuestion = positiveInteger(process.env.LOAD_HEARTS_PER_QUESTION, 2);
const projectId = process.env.GCLOUD_PROJECT || "demo-youcat-loadtest";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const timeoutMs = positiveInteger(process.env.LOAD_TIMEOUT_MS, 60_000);

if (userCount % roomSize !== 0) throw new Error("LOAD_USERS must be divisible by LOAD_ROOM_SIZE.");
if (!questions.length) throw new Error("LOAD_QUESTIONS must include at least one question number.");
if (heartsPerQuestion >= roomSize) throw new Error("LOAD_HEARTS_PER_QUESTION must be smaller than LOAD_ROOM_SIZE.");

const samples = {
  authentication: [],
  answerWrites: [],
  heartWrites: [],
  answerPropagation: [],
  heartPropagation: [],
};
const errors = [];
let snapshotCallbacks = 0;
const startedAt = performance.now();

console.log(`Starting ${userCount} users in ${userCount / roomSize} rooms.`);
console.log(`${questions.length} questions per user, ${heartsPerQuestion * questions.length} hearts per user.`);

const users = await Promise.all(Array.from({ length: userCount }, (_, index) => createUser(index)));
await runMeasured("authentication", () => Promise.all(users.map(authenticateUser)));

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
  console.log(`Question ${questionNumber}: complete.`);
}

await Promise.all(users.map((user) => deleteApp(user.app)));

const elapsedMs = performance.now() - startedAt;
const result = {
  scenario: {
    users: userCount,
    rooms: userCount / roomSize,
    roomSize,
    questionsPerUser: questions.length,
    heartsPerUser: heartsPerQuestion * questions.length,
    totalWrites: userCount * questions.length * (1 + heartsPerQuestion),
    maximumConcurrentListeners: userCount,
  },
  elapsedSeconds: round(elapsedMs / 1000),
  snapshotCallbacks,
  latencyMs: Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, summarize(values)])),
  errors,
};

console.log("\nLOAD_TEST_RESULT");
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;

async function createUser(index) {
  const app = initializeApp({
    apiKey: "demo-key",
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
  }, `load-user-${index}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [host, port] = firestoreHost.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  return {
    app,
    auth,
    db,
    index,
    roomCode: `LOAD-${String(Math.floor(index / roomSize) + 1).padStart(2, "0")}`,
  };
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

  const unsubscribe = onSnapshot(roomQuery, (snapshot) => {
    snapshotCallbacks += 1;
    if (!initialSeen) {
      initialSeen = true;
      initial.resolve();
    }
    if (snapshot.size === roomSize) answersReady.resolve();
    const heartCount = snapshot.docs.reduce((total, item) => total + (item.data().voters?.length || 0), 0);
    if (snapshot.size === roomSize && heartCount === roomSize * heartsPerQuestion) heartsReady.resolve();
  }, (error) => {
    recordError("listener", user.index, error, questionNumber);
    initial.reject(error);
    answersReady.reject(error);
    heartsReady.reject(error);
  });

  return {
    initial: initial.promise,
    answersReady: answersReady.promise,
    heartsReady: heartsReady.promise,
    unsubscribe,
  };
}

async function publishAnswer(user, questionNumber) {
  const start = performance.now();
  try {
    const answerRef = doc(user.db, "rooms", user.roomCode, "questions", String(questionNumber), "reflections", user.uid);
    await setDoc(answerRef, {
      authorUid: user.uid,
      name: `Load User ${String(user.index + 1).padStart(3, "0")}`,
      age: 24,
      text: `Load-test reflection for question ${questionNumber}.`,
      voters: [],
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
    const targetPosition = (position + offset + 1) % roomSize;
    const target = users[roomStart + targetPosition];
    const start = performance.now();
    try {
      const answerRef = doc(user.db, "rooms", user.roomCode, "questions", String(questionNumber), "reflections", target.uid);
      await updateDoc(answerRef, { voters: arrayUnion(user.uid) });
      samples.heartWrites.push(performance.now() - start);
    } catch (error) {
      recordError("heart", user.index, error, questionNumber);
      throw error;
    }
  });
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
