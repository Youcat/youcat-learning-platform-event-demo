import {
  calculateReflectionBoardEligibility,
  isResolvedReflectionStatus,
} from "./reflections.js";
import {
  aggregateGroupStandings,
  isStandingWinnerEligible,
} from "./event-winner.js";

const env = import.meta.env || {};
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const configured = env.VITE_FORCE_LOCAL_PREVIEW !== "true" && Object.values(config).every(Boolean);
let servicesPromise = null;
let sessionPromise = null;
let auth = null;
let currentUid = null;
const localMissionGroups = new Map();
const localMissionParticipants = new Map();
const localMissionListeners = new Map();
const localMissionEvent = { activeCount: 0, resolved: {}, resolvedByGroup: {}, unlocked: {} };
const localEventListeners = new Set();
const localHeartAllocations = new Map();
const reconciledReflectionUsers = new Set();
const MISSION_LEASE_MS = 5 * 60 * 1000;

function refreshReflectionBoardEligibility(event, summaries) {
  const result = calculateReflectionBoardEligibility(summaries, event.unlocked || {});
  event.resolved = result.resolved;
  event.eligibleParticipantCount = result.eligibleParticipantCount;
  event.unlocked = result.unlocked;
}

async function getServices() {
  if (!configured) return null;
  if (!servicesPromise) {
    servicesPromise = Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]).then(([appModule, authModule, firestoreModule]) => {
      const app = appModule.initializeApp(config);
      auth = authModule.getAuth(app);
      let db;
      try {
        db = firestoreModule.initializeFirestore(app, {
          localCache: firestoreModule.persistentLocalCache({
            tabManager: firestoreModule.persistentMultipleTabManager(),
          }),
        });
      } catch (error) {
        console.warn("Persistent Firestore cache is unavailable; using the memory cache.", error);
        db = firestoreModule.getFirestore(app);
      }
      if (env.VITE_USE_FIREBASE_EMULATORS === "true") {
        authModule.connectAuthEmulator(auth, `http://${env.VITE_AUTH_EMULATOR_HOST || "127.0.0.1"}:${env.VITE_AUTH_EMULATOR_PORT || "9099"}`, { disableWarnings: true });
        firestoreModule.connectFirestoreEmulator(
          db,
          env.VITE_FIRESTORE_EMULATOR_HOST || "127.0.0.1",
          Number(env.VITE_FIRESTORE_EMULATOR_PORT || 8080),
        );
      }
      return {
        auth,
        db,
        ...authModule,
        ...firestoreModule,
      };
    });
  }
  return servicesPromise;
}

export function isFirebaseConfigured() {
  return configured;
}

export async function ensureParticipantSession() {
  if (!configured) {
    currentUid ||= crypto.randomUUID();
    return currentUid;
  }

  if (!sessionPromise) {
    sessionPromise = (async () => {
      const services = await getServices();
      await services.setPersistence(services.auth, services.browserLocalPersistence);
      const credential = services.auth.currentUser
        ? { user: services.auth.currentUser }
        : await services.signInAnonymously(services.auth);
      currentUid = credential.user.uid;
      return currentUid;
    })().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

export async function resetParticipantSession() {
  if (!configured) {
    currentUid = crypto.randomUUID();
    return currentUid;
  }
  const services = await getServices();
  await services.signOut(services.auth);
  currentUid = null;
  sessionPromise = null;
  return ensureParticipantSession();
}

export async function syncLeaderboard({ profile, totalXp, groupXp, questionXp = {}, previousRoom = "" }) {
  const uid = await ensureParticipantSession();
  if (!configured) {
    const participant = localParticipant(uid, profile.room);
    participant.currentGroup = profile.room;
    participant.groupXp = Number(groupXp?.[profile.room] || 0);
    participant.active = true;
    refreshLocalReflectionBoardEligibility(localMissionEvent);
    return uid;
  }
  {
    const compactServices = await getServices();
    const missionParticipantRef = compactServices.doc(compactServices.db, "missionParticipants", uid);
    const missionParticipantSnapshot = await compactServices.getDoc(missionParticipantRef);
    const reflectionStatus = missionParticipantSnapshot.data()?.reflectionStatus || {};
    const boardCompleted = missionParticipantSnapshot.data()?.boardCompleted || {};
    const rooms = new Set([profile.room, previousRoom].filter(Boolean));
    const batch = compactServices.writeBatch(compactServices.db);
    batch.set(compactServices.doc(compactServices.db, "leaderboardParticipants", uid), {
      uid,
      displayName: profile.displayName,
      currentGroup: profile.room,
      personalXp: totalXp,
      updatedAt: compactServices.serverTimestamp(),
    }, { merge: true });
    rooms.forEach((room) => {
      batch.set(compactServices.doc(compactServices.db, "leaderboardGroups", room, "members", uid), {
        uid,
        groupCode: room,
        displayName: profile.displayName,
        personalXp: totalXp,
        groupXp: Number(groupXp?.[room] || 0),
        questionXp: questionXp?.[room] || {},
        active: room === profile.room,
        reflectionStatus,
        boardCompleted,
        updatedAt: compactServices.serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
    return uid;
  }
}

export async function deactivateParticipantMembership(roomCode) {
  const uid = await ensureParticipantSession();
  if (!roomCode) return;
  if (!configured) {
    const participant = localMissionParticipants.get(uid);
    if (participant) participant.active = false;
    refreshLocalReflectionBoardEligibility(localMissionEvent);
    await tryDeclareEventWinner({ roomCode });
    return;
  }
  const services = await getServices();
  const memberRef = services.doc(services.db, "leaderboardGroups", roomCode, "members", uid);
  await services.setDoc(memberRef, { active: false, updatedAt: services.serverTimestamp() }, { merge: true });
  await refreshReflectionBoardEligibilityFromFirestore();
  await tryDeclareEventWinner({ roomCode });
}

async function refreshReflectionBoardEligibilityFromFirestore() {
  if (!configured) return;
  const services = await getServices();
  const eventRef = services.doc(services.db, "missionEvent", "assis-2026-07-26");
  const membersSnapshot = await services.getDocs(services.query(
    services.collectionGroup(services.db, "members"),
    services.where("active", "==", true),
    services.limit(500),
  ));
  const byGroup = new Map();
  membersSnapshot.docs.forEach((item) => {
    const member = item.data();
    const summary = byGroup.get(member.groupCode) || { groupCode: member.groupCode, participants: 0, members: 0, reflectionResolved: {} };
    summary.members += 1;
    if (Number(member.groupXp || 0) > 0) summary.participants += 1;
    Object.entries(member.reflectionStatus || {}).forEach(([key, status]) => {
      if (isResolvedReflectionStatus(status)) summary.reflectionResolved[key] = Number(summary.reflectionResolved[key] || 0) + 1;
    });
    byGroup.set(member.groupCode, summary);
  });
  await services.runTransaction(services.db, async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    const event = { resolvedByGroup: {}, unlocked: {}, ...(eventSnapshot.data() || {}) };
    refreshReflectionBoardEligibility(event, [...byGroup.values()]);
    transaction.set(eventRef, { ...event, updatedAt: services.serverTimestamp() }, { merge: true });
  });
}

export async function subscribeToQuestionGroupTotal(roomCode, questionNumber, callback, onError) {
  if (!configured) return () => {};
  const services = await getServices();
  const membersQuery = services.query(
    services.collection(services.db, "leaderboardGroups", roomCode, "members"),
    services.where("active", "==", true),
    services.limit(200),
  );
  return services.onSnapshot(membersQuery, (snapshot) => {
    const total = snapshot.docs.reduce((sum, item) => sum + Number(item.data()?.questionXp?.[questionNumber] || 0), 0);
    callback(total);
  }, onError);
}

export async function subscribeToLeaderboards(roomCode, callback, onError) {
  if (!configured) return () => {};
  const services = await getServices();
  const membersQuery = services.query(
    services.collection(services.db, "leaderboardGroups", roomCode, "members"),
    services.where("active", "==", true),
    services.limit(100),
  );
  const eventQuery = services.query(
    services.collectionGroup(services.db, "members"),
    services.where("active", "==", true),
    services.limit(500),
  );
  let members = [];
  let groups = [];
  const emit = () => callback({ members, groups });
  const unsubMembers = services.onSnapshot(membersQuery, (snapshot) => {
    members = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    emit();
  }, onError);
  const unsubEvent = services.onSnapshot(eventQuery, (snapshot) => {
    groups = aggregateGroupStandings(snapshot.docs.map((item) => item.data()))
      .map((summary) => ({ ...summary, active: true }));
    emit();
  }, onError);
  return () => { unsubMembers(); unsubEvent(); };
}

function normalizeEventWinner(data) {
  if (!data?.winnerGroup) return null;
  return {
    groupCode: data.winnerGroup,
    totalXp: Number(data.winnerXp || 0),
    targetXp: Number(data.winnerTarget || 0),
    memberCount: Number(data.winnerMemberCount || 0),
    declaredAt: data.winnerDeclaredAt || null,
    finalStandings: Array.isArray(data.finalStandings)
      ? data.finalStandings.map((standing) => ({
        groupCode: String(standing.groupCode || ""),
        totalXp: Number(standing.totalXp || 0),
        targetXp: Number(standing.targetXp || 0),
        members: Number(standing.members || 0),
        participants: Number(standing.participants || 0),
      }))
      : [],
  };
}

export async function subscribeToEventWinner(callback, onError) {
  if (!configured) {
    localEventListeners.add(callback);
    callback(normalizeEventWinner(localMissionEvent));
    return () => localEventListeners.delete(callback);
  }
  const services = await getServices();
  const eventRef = services.doc(services.db, "missionEvent", "assis-2026-07-26");
  return services.onSnapshot(eventRef, (snapshot) => callback(normalizeEventWinner(snapshot.data())), onError);
}

export async function getEventWinner() {
  if (!configured) return normalizeEventWinner(localMissionEvent);
  const services = await getServices();
  const snapshot = await services.getDoc(services.doc(services.db, "missionEvent", "assis-2026-07-26"));
  return normalizeEventWinner(snapshot.data());
}

export async function subscribeToRoom(roomCode, questionNumber, callback, onError) {
  if (!configured) return () => {};
  const services = await getServices();
  const roomRef = services.collection(services.db, "rooms", roomCode, "questions", String(questionNumber), "reflections");
  const roomQuery = services.query(roomRef, services.orderBy("createdAt", "desc"), services.limit(150));
  let reflections = [];
  let votes = [];
  const emit = () => callback(reflections.map((reflection) => ({
    ...reflection,
    voters: [...new Set([...(reflection.voters || []), ...votes.filter((vote) => vote.reflectionId === reflection.id).map((vote) => vote.voterUid)])],
  })));
  const unsubReflections = services.onSnapshot(
    roomQuery,
    (snapshot) => {
      reflections = snapshot.docs.map((item) => ({ id: item.id, questionNumber, ...item.data() }));
      emit();
    },
    onError,
  );
  const voteQuery = services.query(
    services.collection(services.db, "heartVotes"),
    services.where("questionNumber", "==", String(questionNumber)),
    services.limit(600),
  );
  const unsubVotes = services.onSnapshot(voteQuery, (snapshot) => {
    votes = snapshot.docs.map((item) => item.data()).filter((item) => item.roomCode === roomCode);
    emit();
  }, onError);
  return () => { unsubReflections(); unsubVotes(); };
}

export async function subscribeToGlobalQuestion(questionNumber, callback, onError) {
  if (!configured) return () => {};
  const services = await getServices();
  const globalQuery = services.query(
    services.collectionGroup(services.db, "reflections"),
    services.where("questionNumber", "==", String(questionNumber)),
    services.orderBy("createdAt", "desc"),
    services.limit(200),
  );
  let reflections = [];
  let votes = [];
  const emit = () => callback(reflections.map((reflection) => ({
    ...reflection,
    voters: [...new Set([...(reflection.voters || []), ...votes.filter((vote) => vote.reflectionId === reflection.id).map((vote) => vote.voterUid)])],
  })));
  const unsubReflections = services.onSnapshot(globalQuery, (snapshot) => {
    reflections = snapshot.docs.map((item) => ({ id: item.id, questionNumber, ...item.data() }));
    emit();
  }, onError);
  const voteQuery = services.query(
    services.collection(services.db, "heartVotes"),
    services.where("questionNumber", "==", String(questionNumber)),
    services.limit(600),
  );
  const unsubVotes = services.onSnapshot(voteQuery, (snapshot) => {
    votes = snapshot.docs.map((item) => item.data());
    emit();
  }, onError);
  return () => { unsubReflections(); unsubVotes(); };
}

function nextSummaryAfterResolution(summary, key, shouldIncrement) {
  const reflectionResolved = { ...(summary.reflectionResolved || {}) };
  if (shouldIncrement) reflectionResolved[key] = Number(reflectionResolved[key] || 0) + 1;
  return {
    groupCode: summary.groupCode,
    totalXp: Number(summary.totalXp || 0),
    participants: Number(summary.participants || 0),
    members: Number(summary.members || 0),
    reflectionResolved,
    averageXp: Number(summary.averageXp || 0),
  };
}

export async function submitReflectionMission({ mission, name, text }) {
  const uid = await ensureParticipantSession();
  const key = String(mission.questionNumber);
  if (!text || text.length > 300) throw new Error("invalid-reflection");
  if (!configured) {
    const participant = localParticipant(uid, mission.groupCode);
    if (participant.activeMission?.id !== mission.id) throw new Error("mission-not-owned");
    participant.reflectionStatus[key] = "submitted";
    participant.activeMission = null;
    refreshLocalReflectionBoardEligibility(localMissionEvent);
    return {
      id: uid,
      authorUid: uid,
      name,
      text,
      voters: [],
      roomCode: mission.groupCode,
      questionNumber: key,
      createdAt: { toMillis: () => Date.now() },
    };
  }

  const services = await getServices();
  const participantRef = services.doc(services.db, "missionParticipants", uid);
  const answerRef = services.doc(services.db, "rooms", mission.groupCode, "questions", key, "reflections", uid);
  const memberRef = services.doc(services.db, "leaderboardGroups", mission.groupCode, "members", uid);
  const result = await services.runTransaction(services.db, async (transaction) => {
    const [participantSnapshot, answerSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(participantRef),
      transaction.get(answerRef),
      transaction.get(memberRef),
    ]);
    const participant = participantSnapshot.data() || { reflectionStatus: {}, boardCompleted: {} };
    if (answerSnapshot.exists() && answerSnapshot.data()?.authorUid === uid && participant.reflectionStatus?.[key] === "submitted") {
      return answerSnapshot.data();
    }
    if (participant.activeMission?.id !== mission.id || participant.activeMission?.type !== "reflection") {
      throw new Error("mission-not-owned");
    }
    if (answerSnapshot.exists() && answerSnapshot.data()?.authorUid !== uid) throw new Error("reflection-owner-mismatch");

    const member = memberSnapshot.data();
    const memberStatuses = { ...(member?.reflectionStatus || {}), [key]: "submitted" };
    participant.reflectionStatus = { ...(participant.reflectionStatus || {}), [key]: "submitted" };
    participant.activeMission = null;

    if (!answerSnapshot.exists()) {
      transaction.set(answerRef, {
        authorUid: uid,
        name,
        text,
        voters: [],
        roomCode: mission.groupCode,
        questionNumber: key,
        createdAt: services.serverTimestamp(),
      });
    }
    transaction.set(participantRef, { ...participant, updatedAt: services.serverTimestamp() }, { merge: true });
    if (member) transaction.set(memberRef, { reflectionStatus: memberStatuses, updatedAt: services.serverTimestamp() }, { merge: true });
    return answerSnapshot.exists() ? answerSnapshot.data() : null;
  });
  void refreshReflectionBoardEligibilityFromFirestore()
    .catch((error) => console.warn("Unable to refresh reflection eligibility", error));
  return {
    id: uid,
    authorUid: uid,
    name,
    text,
    voters: result?.voters || [],
    roomCode: mission.groupCode,
    questionNumber: key,
    createdAt: result?.createdAt || { toMillis: () => Date.now() },
  };
}

export async function reconcileParticipantReflections(roomCode) {
  const uid = await ensureParticipantSession();
  if (reconciledReflectionUsers.has(uid)) return [];
  if (!configured) return [];
  const services = await getServices();
  const participantRef = services.doc(services.db, "missionParticipants", uid);
  const participantSnapshot = await services.getDoc(participantRef);
  const participant = participantSnapshot.data();
  const submittedKeys = Object.entries(participant?.reflectionStatus || {})
    .filter(([, status]) => status === "submitted")
    .map(([key]) => String(key));
  if (!submittedKeys.length) {
    reconciledReflectionUsers.add(uid);
    return [];
  }

  const ownReflections = await services.getDocs(services.query(
    services.collectionGroup(services.db, "reflections"),
    services.where("authorUid", "==", uid),
    services.limit(50),
  ));
  const existingKeys = new Set(ownReflections.docs.map((item) => String(item.data()?.questionNumber || "")));
  const missingKeys = submittedKeys.filter((key) => !existingKeys.has(key));
  if (!missingKeys.length) {
    reconciledReflectionUsers.add(uid);
    return [];
  }

  const memberRef = services.doc(services.db, "leaderboardGroups", roomCode, "members", uid);
  await services.runTransaction(services.db, async (transaction) => {
    const [freshParticipantSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(participantRef),
      transaction.get(memberRef),
    ]);
    const freshParticipant = freshParticipantSnapshot.data() || {};
    const reflectionStatus = { ...(freshParticipant.reflectionStatus || {}) };
    const boardCompleted = { ...(freshParticipant.boardCompleted || {}) };
    missingKeys.forEach((key) => {
      if (reflectionStatus[key] === "submitted") delete reflectionStatus[key];
      delete boardCompleted[key];
    });
    transaction.set(participantRef, { reflectionStatus, boardCompleted, updatedAt: services.serverTimestamp() }, { merge: true });

    const member = memberSnapshot.data();
    if (member) {
      const memberStatuses = { ...(member.reflectionStatus || {}) };
      missingKeys.forEach((key) => { if (memberStatuses[key] === "submitted") delete memberStatuses[key]; });
      transaction.set(memberRef, { reflectionStatus: memberStatuses, updatedAt: services.serverTimestamp() }, { merge: true });
    }
  });
  await refreshReflectionBoardEligibilityFromFirestore();
  reconciledReflectionUsers.add(uid);
  return missingKeys;
}

export async function giveHeart({ roomCode, questionNumber, reflectionId }) {
  const uid = await ensureParticipantSession();
  if (!configured) {
    const key = `${uid}__${questionNumber}`;
    const ids = localHeartAllocations.get(key) || [];
    if (ids.includes(reflectionId) || ids.length >= 3) throw new Error("heart-limit");
    const nextIds = [...ids, reflectionId];
    localHeartAllocations.set(key, nextIds);
    return { uid, count: nextIds.length, bonus: nextIds.length === 3 };
  }
  const services = await getServices();
  const answerRef = services.doc(services.db, "rooms", roomCode, "questions", String(questionNumber), "reflections", reflectionId);
  const allocationRef = services.doc(services.db, "heartAllocations", `${uid}__${questionNumber}`);
  const voteRef = services.doc(services.db, "heartVotes", `${uid}__${questionNumber}__${reflectionId}`);
  const [answerSnapshot, allocationSnapshot, voteSnapshot] = await Promise.all([
    services.getDoc(answerRef),
    services.getDoc(allocationRef),
    services.getDoc(voteRef),
  ]);
  if (!answerSnapshot.exists()) throw new Error("reflection-missing");
  const answer = answerSnapshot.data();
  if (answer.authorUid === uid) throw new Error("own-reflection");
  const reflectionIds = allocationSnapshot.data()?.reflectionIds || [];
  if (reflectionIds.includes(reflectionId) || voteSnapshot.exists()) return { uid, count: reflectionIds.length, bonus: reflectionIds.length === 3 };
  if (reflectionIds.length >= 3) throw new Error("heart-limit");
  const nextIds = [...reflectionIds, reflectionId];
  const rewardRef = services.doc(services.db, "heartRewards", `${answer.authorUid}__${questionNumber}__${uid}`);
  // Each vote has its own immutable document, so popular reflections no longer
  // create a single hot array document during the event.
  const batch = services.writeBatch(services.db);
  batch.set(voteRef, {
    authorUid: answer.authorUid,
    voterUid: uid,
    reflectionId,
    roomCode,
    questionNumber: String(questionNumber),
    createdAt: services.serverTimestamp(),
  });
  batch.set(allocationRef, {
    uid,
    questionNumber: String(questionNumber),
    reflectionIds: nextIds,
    updatedAt: services.serverTimestamp(),
  });
  batch.set(rewardRef, {
    authorUid: answer.authorUid,
    voterUid: uid,
    reflectionId,
    questionNumber: String(questionNumber),
    xp: 5,
    createdAt: services.serverTimestamp(),
  });
  await batch.commit();
  return { uid, count: nextIds.length, bonus: nextIds.length === 3 };
}

export async function subscribeToHeartRewards(authorUid, callback, onError) {
  if (!configured) return () => {};
  const services = await getServices();
  const rewardsQuery = services.query(
    services.collection(services.db, "heartRewards"),
    services.where("authorUid", "==", authorUid),
    services.limit(300),
  );
  return services.onSnapshot(rewardsQuery, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), onError);
}

function localParticipant(uid, roomCode) {
  if (!localMissionParticipants.has(uid)) {
    localMissionParticipants.set(uid, { uid, currentGroup: roomCode, groupXp: 0, active: false, activeMission: null, reflectionStatus: {}, boardCompleted: {} });
  }
  return localMissionParticipants.get(uid);
}

function refreshLocalReflectionBoardEligibility(event) {
  const summariesByGroup = new Map();
  localMissionParticipants.forEach((participant) => {
    if (!participant.active) return;
    const summary = summariesByGroup.get(participant.currentGroup) || {
      groupCode: participant.currentGroup,
      participants: 0,
      members: 0,
      reflectionResolved: {},
    };
    summary.members += 1;
    if (Number(participant.groupXp || 0) > 0) summary.participants += 1;
    Object.entries(participant.reflectionStatus || {}).forEach(([key, status]) => {
      if (isResolvedReflectionStatus(status)) summary.reflectionResolved[key] = Number(summary.reflectionResolved[key] || 0) + 1;
    });
    summariesByGroup.set(participant.currentGroup, summary);
  });
  refreshReflectionBoardEligibility(event, [...summariesByGroup.values()]);
}

function localGroup(roomCode) {
  if (!localMissionGroups.has(roomCode)) localMissionGroups.set(roomCode, { groupCode: roomCode, challenges: {}, progress: {} });
  return localMissionGroups.get(roomCode);
}

function emitLocalMissionGroup(roomCode) {
  const listeners = localMissionListeners.get(roomCode) || [];
  listeners.forEach((callback) => callback(structuredClone(localGroup(roomCode))));
}

export function chooseMission({ participant, group, event, sharedChallenges, questions, roomCode, now, excludeMissionId = "" }) {
  const candidates = [];
  const boardCandidates = [];
  for (const challenge of sharedChallenges) {
    const saved = group.challenges?.[challenge.id];
    const available = !saved || (saved.status !== "completed" && saved.status !== "skipped" && (saved.status !== "reserved" || Number(saved.leaseUntil || 0) <= now));
    if (available && challenge.id !== excludeMissionId) candidates.push({ ...challenge, type: "shared", groupCode: roomCode });
  }
  for (const questionNumber of questions) {
    const key = String(questionNumber);
    if (!participant.reflectionStatus?.[key]) candidates.push({ id: `reflection__${key}`, type: "reflection", questionNumber, groupCode: roomCode, xp: 10 });
    if (event.unlocked?.[key] && participant.reflectionStatus?.[key] && !participant.boardCompleted?.[key]) {
      boardCandidates.push({ id: `board__${key}`, type: "board", questionNumber, groupCode: roomCode, xp: 2 });
    }
  }
  if (boardCandidates.length) return boardCandidates[Math.floor(Math.random() * boardCandidates.length)];
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function claimRandomMission({ roomCode, sharedChallenges, questions, excludeMissionId = "" }) {
  const uid = await ensureParticipantSession();
  const now = Date.now();
  if (!configured) {
    if (localMissionEvent.winnerGroup) return { type: "winner" };
    const participant = localParticipant(uid, roomCode);
    const group = localGroup(roomCode);
    if (!participant.active) { participant.active = true; localMissionEvent.activeCount += 1; }
    const activeMission = participant.activeMission;
    const activeSharedChallenge = activeMission?.type === "shared" ? group.challenges?.[activeMission.id] : null;
    const activeMissionIsStillOwned = activeMission?.expiresAt > now
      && activeMission.groupCode === roomCode
      && (activeMission.type !== "shared" || (activeSharedChallenge?.status === "reserved" && activeSharedChallenge.reservedBy === uid));
    if (activeMissionIsStillOwned) return activeMission;
    // Recover from an obsolete reservation instead of reviving a team task that
    // another device has already completed or released.
    if (activeMission?.type === "shared") participant.activeMission = null;
    const mission = chooseMission({ participant, group, event: localMissionEvent, sharedChallenges, questions, roomCode, now, excludeMissionId });
    if (!mission) {
      const complete = sharedChallenges.every((item) => ["completed", "skipped"].includes(group.challenges?.[item.id]?.status))
        && questions.every((number) => participant.reflectionStatus?.[number] && participant.boardCompleted?.[number]);
      return complete ? { type: "complete" } : null;
    }
    mission.expiresAt = now + MISSION_LEASE_MS;
    participant.currentGroup = roomCode;
    participant.activeMission = mission;
    if (mission.type === "shared") group.challenges[mission.id] = { status: "reserved", reservedBy: uid, leaseUntil: mission.expiresAt };
    emitLocalMissionGroup(roomCode);
    return structuredClone(mission);
  }
  const services = await getServices();
  const participantRef = services.doc(services.db, "missionParticipants", uid);
  const legacyGroupRef = services.doc(services.db, "missionGroups", roomCode);
  const challengeCollection = services.collection(services.db, "missionGroups", roomCode, "challenges");
  const eventRef = services.doc(services.db, "missionEvent", "assis-2026-07-26");
  const [participantSnapshot, legacyGroupSnapshot, challengeSnapshot, eventSnapshot] = await Promise.all([
    services.getDoc(participantRef),
    services.getDoc(legacyGroupRef),
    services.getDocs(challengeCollection),
    services.getDoc(eventRef),
  ]);
  const participant = { uid, currentGroup: roomCode, active: false, activeMission: null, reflectionStatus: {}, boardCompleted: {}, ...(participantSnapshot.data() || {}) };
  const group = { groupCode: roomCode, challenges: { ...(legacyGroupSnapshot.data()?.challenges || {}) }, progress: {} };
  challengeSnapshot.docs.forEach((snapshot) => { group.challenges[snapshot.id] = snapshot.data(); });
  const event = { activeCount: 0, resolved: {}, unlocked: {}, ...(eventSnapshot.data() || {}) };
  if (event.winnerGroup) return { type: "winner" };
  if (participant.activeMission?.expiresAt > now && participant.activeMission.groupCode === roomCode) return participant.activeMission;

  // Only participants competing for the same challenge now touch the same
  // reservation document. Unrelated group members no longer restart one large
  // group transaction.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const mission = chooseMission({ participant, group, event, sharedChallenges, questions, roomCode, now: Date.now(), excludeMissionId });
    if (!mission) {
      const complete = sharedChallenges.every((item) => ["completed", "skipped"].includes(group.challenges?.[item.id]?.status))
        && questions.every((number) => participant.reflectionStatus?.[number] && participant.boardCompleted?.[number]);
      await services.setDoc(participantRef, { active: true, activeMission: null, currentGroup: roomCode, updatedAt: services.serverTimestamp() }, { merge: true });
      return complete ? { type: "complete" } : null;
    }
    mission.expiresAt = Date.now() + MISSION_LEASE_MS;
    if (mission.type !== "shared") {
      await services.runTransaction(services.db, async (transaction) => {
        const latestSnapshot = await transaction.get(participantRef);
        const latest = latestSnapshot.data() || {};
        if (latest.activeMission?.expiresAt > Date.now() && latest.activeMission.groupCode === roomCode) throw new Error("mission-already-owned");
        transaction.set(participantRef, { active: true, currentGroup: roomCode, activeMission: mission, updatedAt: services.serverTimestamp() }, { merge: true });
      });
      return mission;
    }

    const challengeRef = services.doc(challengeCollection, mission.id);
    try {
      await services.runTransaction(services.db, async (transaction) => {
        const [latestParticipantSnapshot, savedSnapshot] = await Promise.all([
          transaction.get(participantRef),
          transaction.get(challengeRef),
        ]);
        const latestParticipant = latestParticipantSnapshot.data() || {};
        if (latestParticipant.activeMission?.expiresAt > Date.now() && latestParticipant.activeMission.groupCode === roomCode) throw new Error("mission-already-owned");
        const saved = savedSnapshot.data() || group.challenges[mission.id] || {};
        const unavailable = ["completed", "skipped"].includes(saved.status)
          || (saved.status === "reserved" && Number(saved.leaseUntil || 0) > Date.now() && saved.reservedBy !== uid);
        if (unavailable) throw new Error("challenge-unavailable");
        transaction.set(challengeRef, {
          challengeId: mission.id,
          questionNumber: String(mission.questionNumber),
          status: "reserved",
          reservedBy: uid,
          leaseUntil: mission.expiresAt,
          updatedAt: services.serverTimestamp(),
        }, { merge: true });
        transaction.set(participantRef, { active: true, currentGroup: roomCode, activeMission: mission, updatedAt: services.serverTimestamp() }, { merge: true });
      });
      return mission;
    } catch (error) {
      if (!String(error?.message || "").includes("challenge-unavailable")) throw error;
      group.challenges[mission.id] = { status: "reserved", reservedBy: "another-participant", leaseUntil: Date.now() + MISSION_LEASE_MS };
    }
  }
  return null;
}

export async function renewMission(mission) {
  const uid = await ensureParticipantSession();
  const expiresAt = Date.now() + MISSION_LEASE_MS;
  if (!configured) {
    const participant = localParticipant(uid, mission.groupCode);
    if (participant.activeMission?.id !== mission.id) return null;
    participant.activeMission.expiresAt = expiresAt;
    if (mission.type === "shared") localGroup(mission.groupCode).challenges[mission.id].leaseUntil = expiresAt;
    return { ...participant.activeMission };
  }
  const services = await getServices();
  const participantRef = services.doc(services.db, "missionParticipants", uid);
  const challengeRef = services.doc(services.db, "missionGroups", mission.groupCode, "challenges", mission.id);
  return services.runTransaction(services.db, async (transaction) => {
    const [participantSnapshot, challengeSnapshot] = await Promise.all([
      transaction.get(participantRef),
      mission.type === "shared" ? transaction.get(challengeRef) : Promise.resolve(null),
    ]);
    const participant = participantSnapshot.data();
    if (participant?.activeMission?.id !== mission.id) return null;
    const nextMission = { ...participant.activeMission, expiresAt };
    if (mission.type === "shared") {
      const challenge = challengeSnapshot.data() || {};
      if (challenge.reservedBy !== uid || challenge.status !== "reserved") return null;
      transaction.set(challengeRef, { leaseUntil: expiresAt, updatedAt: services.serverTimestamp() }, { merge: true });
    }
    transaction.update(participantRef, { activeMission: nextMission, updatedAt: services.serverTimestamp() });
    return nextMission;
  });
}

export async function completeSharedMission({ mission, correct, xpAwarded }) {
  const uid = await ensureParticipantSession();
  const key = String(mission.questionNumber);
  if (!configured) {
    const participant = localParticipant(uid, mission.groupCode);
    const group = localGroup(mission.groupCode);
    const saved = group.challenges[mission.id];
    if (saved?.reservedBy !== uid) throw new Error("mission-not-owned");
    group.challenges[mission.id] = { ...saved, status: "completed", completedBy: uid, correct, xpAwarded, completedAt: Date.now() };
    group.progress[key] = Number(group.progress[key] || 0) + 1;
    participant.activeMission = null;
    emitLocalMissionGroup(mission.groupCode);
    return true;
  }
  const services = await getServices();
  const participantRef = services.doc(services.db, "missionParticipants", uid);
  const challengeRef = services.doc(services.db, "missionGroups", mission.groupCode, "challenges", mission.id);
  return services.runTransaction(services.db, async (transaction) => {
    const [participantSnapshot, challengeSnapshot] = await Promise.all([transaction.get(participantRef), transaction.get(challengeRef)]);
    const participant = participantSnapshot.data();
    const saved = challengeSnapshot.data() || {};
    if (saved.status === "completed") return saved.completedBy === uid;
    const ownsReservation = participant?.activeMission?.id === mission.id && saved.reservedBy === uid && saved.status === "reserved";
    if (!ownsReservation && !mission.offline) throw new Error("mission-not-owned");
    transaction.set(challengeRef, {
      ...saved,
      challengeId: mission.id,
      questionNumber: key,
      status: "completed",
      completedBy: uid,
      correct,
      xpAwarded,
      completedAt: services.serverTimestamp(),
      updatedAt: services.serverTimestamp(),
    });
    transaction.set(participantRef, { activeMission: null, updatedAt: services.serverTimestamp() }, { merge: true });
    return true;
  });
}

export async function skipSharedMission(mission) {
  const uid = await ensureParticipantSession();
  const key = String(mission.questionNumber);
  if (!configured) {
    const participant = localParticipant(uid, mission.groupCode);
    const group = localGroup(mission.groupCode);
    const saved = group.challenges[mission.id];
    if (saved?.reservedBy !== uid || saved.status !== "reserved") throw new Error("mission-not-owned");
    group.challenges[mission.id] = { ...saved, status: "skipped", skippedBy: uid, skippedAt: Date.now() };
    group.progress[key] = Number(group.progress[key] || 0) + 1;
    participant.activeMission = null;
    emitLocalMissionGroup(mission.groupCode);
    return true;
  }
  const services = await getServices();
  const participantRef = services.doc(services.db, "missionParticipants", uid);
  const challengeRef = services.doc(services.db, "missionGroups", mission.groupCode, "challenges", mission.id);
  return services.runTransaction(services.db, async (transaction) => {
    const [participantSnapshot, challengeSnapshot] = await Promise.all([transaction.get(participantRef), transaction.get(challengeRef)]);
    const participant = participantSnapshot.data();
    const saved = challengeSnapshot.data() || {};
    if (saved.status === "skipped" && saved.skippedBy === uid) return true;
    if (participant?.activeMission?.id !== mission.id || saved.reservedBy !== uid || saved.status !== "reserved") throw new Error("mission-not-owned");
    transaction.set(challengeRef, {
      ...saved,
      challengeId: mission.id,
      questionNumber: key,
      status: "skipped",
      skippedBy: uid,
      skippedAt: services.serverTimestamp(),
      updatedAt: services.serverTimestamp(),
    });
    transaction.update(participantRef, { activeMission: null, updatedAt: services.serverTimestamp() });
    return true;
  });
}

export async function finishPersonalMission({ mission, reflectionStatus = "" }) {
  const uid = await ensureParticipantSession();
  const key = String(mission.questionNumber);
  if (!configured) {
    const participant = localParticipant(uid, mission.groupCode);
    if (participant.activeMission?.id !== mission.id) throw new Error("mission-not-owned");
    if (reflectionStatus && !participant.reflectionStatus[key]) participant.reflectionStatus[key] = reflectionStatus;
    refreshLocalReflectionBoardEligibility(localMissionEvent);
    if (mission.type === "board") {
      if ((localHeartAllocations.get(`${uid}__${key}`) || []).length < 3) throw new Error("three-hearts-required");
      participant.boardCompleted[key] = true;
    }
    participant.activeMission = null;
    return { unlocked: Boolean(localMissionEvent.unlocked[key]) };
  }
  const services = await getServices();
  const participantRef = services.doc(services.db, "missionParticipants", uid);
  const memberRef = services.doc(services.db, "leaderboardGroups", mission.groupCode, "members", uid);
  const allocationRef = services.doc(services.db, "heartAllocations", `${uid}__${key}`);
  await services.runTransaction(services.db, async (transaction) => {
    const [participantSnapshot, memberSnapshot, allocationSnapshot] = await Promise.all([
      transaction.get(participantRef),
      transaction.get(memberRef),
      mission.type === "board" ? transaction.get(allocationRef) : Promise.resolve(null),
    ]);
    const participant = participantSnapshot.data() || { reflectionStatus: {}, boardCompleted: {} };
    if (mission.type === "board" && participant.boardCompleted?.[key]) return;
    if (reflectionStatus && participant.reflectionStatus?.[key] === reflectionStatus && !participant.activeMission) return;
    if (participant.activeMission?.id !== mission.id) throw new Error("mission-not-owned");
    participant.reflectionStatus ||= {};
    participant.boardCompleted ||= {};
    if (reflectionStatus && !participant.reflectionStatus[key]) participant.reflectionStatus[key] = reflectionStatus;
    if (mission.type === "board") {
      if ((allocationSnapshot.data()?.reflectionIds || []).length < 3) throw new Error("three-hearts-required");
      participant.boardCompleted[key] = true;
    }
    participant.activeMission = null;
    transaction.set(participantRef, { ...participant, updatedAt: services.serverTimestamp() }, { merge: true });
    const member = memberSnapshot.data();
    if (member && (reflectionStatus || mission.type === "board")) {
      transaction.set(memberRef, {
        ...(reflectionStatus ? { reflectionStatus: { ...(member.reflectionStatus || {}), [key]: reflectionStatus } } : {}),
        ...(mission.type === "board" ? { boardCompleted: { ...(member.boardCompleted || {}), [key]: true } } : {}),
        updatedAt: services.serverTimestamp(),
      }, { merge: true });
    }
  });
  if (reflectionStatus) {
    void refreshReflectionBoardEligibilityFromFirestore()
      .catch((error) => console.warn("Unable to refresh reflection eligibility", error));
  }
  return { unlocked: false };
}

export async function tryDeclareEventWinner({ roomCode }) {
  if (!configured) {
    if (localMissionEvent.winnerGroup) return normalizeEventWinner(localMissionEvent);
    const standings = aggregateGroupStandings([...localMissionParticipants.values()]);
    const winner = standings.find((standing) => standing.groupCode === roomCode);
    if (!isStandingWinnerEligible(winner)) return null;
    localMissionEvent.winnerGroup = roomCode;
    localMissionEvent.winnerXp = winner.totalXp;
    localMissionEvent.winnerTarget = winner.targetXp;
    localMissionEvent.winnerMemberCount = winner.members;
    localMissionEvent.winnerDeclaredAt = Date.now();
    localMissionEvent.finalStandings = standings;
    const result = normalizeEventWinner(localMissionEvent);
    localEventListeners.forEach((listener) => listener(result));
    return result;
  }

  const services = await getServices();
  const membersQuery = services.query(
    services.collection(services.db, "leaderboardGroups", roomCode, "members"),
    services.where("active", "==", true),
    services.limit(200),
  );
  const membersSnapshot = await services.getDocsFromServer(membersQuery);
  const candidate = aggregateGroupStandings(membersSnapshot.docs.map((snapshot) => snapshot.data()))[0];
  if (!candidate || candidate.groupCode !== roomCode || !isStandingWinnerEligible(candidate)) return null;

  const allMembersSnapshot = await services.getDocsFromServer(services.query(
    services.collectionGroup(services.db, "members"),
    services.where("active", "==", true),
    services.limit(500),
  ));
  const finalStandings = aggregateGroupStandings(allMembersSnapshot.docs.map((snapshot) => snapshot.data()));
  const winner = finalStandings.find((standing) => standing.groupCode === roomCode);
  if (!isStandingWinnerEligible(winner)) return null;

  const eventRef = services.doc(services.db, "missionEvent", "assis-2026-07-26");
  return services.runTransaction(services.db, async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    const existing = normalizeEventWinner(eventSnapshot.data());
    if (existing) return existing;
    transaction.set(eventRef, {
      winnerGroup: roomCode,
      winnerXp: winner.totalXp,
      winnerTarget: winner.targetXp,
      winnerMemberCount: winner.members,
      finalStandings,
      winnerDeclaredAt: services.serverTimestamp(),
      updatedAt: services.serverTimestamp(),
    }, { merge: true });
    return {
      groupCode: roomCode,
      totalXp: winner.totalXp,
      targetXp: winner.targetXp,
      memberCount: winner.members,
      finalStandings,
    };
  });
}

export async function releaseActiveMission(mission) {
  if (!mission) return;
  const uid = await ensureParticipantSession();
  if (!configured) {
    const participant = localParticipant(uid, mission.groupCode);
    if (mission.type === "shared" && localGroup(mission.groupCode).challenges[mission.id]?.reservedBy === uid) delete localGroup(mission.groupCode).challenges[mission.id];
    participant.activeMission = null;
    emitLocalMissionGroup(mission.groupCode);
    return;
  }
  const services = await getServices();
  const participantRef = services.doc(services.db, "missionParticipants", uid);
  const challengeRef = services.doc(services.db, "missionGroups", mission.groupCode, "challenges", mission.id);
  await services.runTransaction(services.db, async (transaction) => {
    const participantSnapshot = await transaction.get(participantRef);
    if (participantSnapshot.data()?.activeMission?.id !== mission.id) return;
    if (mission.type === "shared") {
      const challengeSnapshot = await transaction.get(challengeRef);
      const challenge = challengeSnapshot.data() || {};
      if (challenge.reservedBy === uid && challenge.status === "reserved") {
        transaction.set(challengeRef, {
          challengeId: mission.id,
          questionNumber: String(mission.questionNumber),
          status: "available",
          reservedBy: null,
          leaseUntil: 0,
          updatedAt: services.serverTimestamp(),
        });
      }
    }
    transaction.update(participantRef, { activeMission: null, updatedAt: services.serverTimestamp() });
  });
}

export async function subscribeToMissionGroup(roomCode, callback, onError) {
  if (!configured) {
    const listeners = localMissionListeners.get(roomCode) || [];
    listeners.push(callback);
    localMissionListeners.set(roomCode, listeners);
    callback(structuredClone(localGroup(roomCode)));
    return () => localMissionListeners.set(roomCode, (localMissionListeners.get(roomCode) || []).filter((item) => item !== callback));
  }
  const services = await getServices();
  const groupRef = services.doc(services.db, "missionGroups", roomCode);
  const challengeCollection = services.collection(services.db, "missionGroups", roomCode, "challenges");
  let legacy = { groupCode: roomCode, challenges: {}, progress: {} };
  let challengeDocs = [];
  const emit = () => {
    const challenges = { ...(legacy.challenges || {}) };
    challengeDocs.forEach((item) => { challenges[item.id] = item.data; });
    const progress = challengeDocs.length ? {} : { ...(legacy.progress || {}) };
    challengeDocs.forEach(({ data }) => {
      if (!["completed", "skipped"].includes(data.status)) return;
      const key = String(data.questionNumber || "");
      if (key) progress[key] = Number(progress[key] || 0) + 1;
    });
    callback({ groupCode: roomCode, challenges, progress });
  };
  const unsubLegacy = services.onSnapshot(groupRef, (snapshot) => { legacy = { ...legacy, ...(snapshot.data() || {}) }; emit(); }, onError);
  const unsubChallenges = services.onSnapshot(challengeCollection, (snapshot) => {
    challengeDocs = snapshot.docs.map((item) => ({ id: item.id, data: item.data() }));
    emit();
  }, onError);
  return () => { unsubLegacy(); unsubChallenges(); };
}

export async function getQuestionReflectionCounts(questionNumbers) {
  if (!configured) return new Map(questionNumbers.map((number) => [number, 0]));
  const services = await getServices();
  const entries = await Promise.all(questionNumbers.map(async (number) => {
    const globalQuery = services.query(
      services.collectionGroup(services.db, "reflections"),
      services.where("questionNumber", "==", String(number)),
    );
    const snapshot = await services.getCountFromServer(globalQuery);
    return [number, snapshot.data().count];
  }));
  return new Map(entries);
}

export async function getGlobalReflections(questionNumber, { after = null, pageSize = 50 } = {}) {
  if (!configured) return { reflections: [], cursor: null, hasMore: false };
  const services = await getServices();
  const reflectionsRef = services.collectionGroup(services.db, "reflections");
  const constraints = [
    services.where("questionNumber", "==", String(questionNumber)),
    services.orderBy("createdAt", "desc"),
  ];
  if (after) constraints.push(services.startAfter(after));
  constraints.push(services.limit(pageSize));
  const [snapshot, votesSnapshot] = await Promise.all([
    services.getDocs(services.query(reflectionsRef, ...constraints)),
    services.getDocs(services.query(
      services.collection(services.db, "heartVotes"),
      services.where("questionNumber", "==", String(questionNumber)),
      services.limit(600),
    )),
  ]);
  const votes = votesSnapshot.docs.map((item) => item.data());
  return {
    reflections: snapshot.docs.map((item) => {
      const reflection = { id: item.id, questionNumber, ...item.data() };
      return {
        ...reflection,
        voters: [...new Set([...(reflection.voters || []), ...votes.filter((vote) => vote.reflectionId === item.id).map((vote) => vote.voterUid)])],
      };
    }),
    cursor: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.size === pageSize,
  };
}

export function participantUid() {
  return currentUid || auth?.currentUser?.uid || null;
}
