const env = import.meta.env || {};
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const configured = Object.values(config).every(Boolean);
let servicesPromise = null;
let auth = null;
let currentUid = null;
const localMissionGroups = new Map();
const localMissionParticipants = new Map();
const localMissionListeners = new Map();
const localMissionEvent = { activeCount: 0, resolved: {}, resolvedByGroup: {}, unlocked: {} };
const localHeartAllocations = new Map();
const MISSION_LEASE_MS = 5 * 60 * 1000;

function refreshReflectionBoardEligibility(event, summaries) {
  const activeGroups = summaries.filter((group) => Number(group.participants || 0) >= 2);
  const activeGroupCodes = new Set(activeGroups.map((group) => group.groupCode));
  const eligibleCount = activeGroups.reduce((total, group) => total + Number(group.participants || 0), 0);
  const keys = Object.keys(event.resolvedByGroup || {});
  event.resolved ||= {};
  event.eligibleParticipantCount ||= {};
  event.unlocked ||= {};
  keys.forEach((key) => {
    const resolvedCount = Object.entries(event.resolvedByGroup[key] || {})
      .filter(([groupCode]) => activeGroupCodes.has(groupCode))
      .reduce((total, [, count]) => total + Number(count || 0), 0);
    event.resolved[key] = resolvedCount;
    event.eligibleParticipantCount[key] = eligibleCount;
    if (eligibleCount > 0 && resolvedCount / eligibleCount >= 0.9) event.unlocked[key] = true;
  });
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
      return {
        auth,
        db: firestoreModule.getFirestore(app),
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

  const services = await getServices();
  await services.setPersistence(services.auth, services.browserLocalPersistence);
  const credential = services.auth.currentUser
    ? { user: services.auth.currentUser }
    : await services.signInAnonymously(services.auth);
  currentUid = credential.user.uid;
  return currentUid;
}

export async function resetParticipantSession() {
  if (!configured) {
    currentUid = crypto.randomUUID();
    return currentUid;
  }
  const services = await getServices();
  await services.signOut(services.auth);
  currentUid = null;
  return ensureParticipantSession();
}

export async function syncLeaderboard({ profile, totalXp, groupXp, questionXp = {}, previousRoom = "" }) {
  const uid = await ensureParticipantSession();
  if (!configured) {
    const participant = localParticipant(uid, profile.room);
    participant.currentGroup = profile.room;
    participant.groupXp = Number(groupXp?.[profile.room] || 0);
    return uid;
  }
  const services = await getServices();
  const groups = new Set([...Object.keys(groupXp || {}), profile.room]);
  if (previousRoom) groups.add(previousRoom);
  const groupList = [...groups];
  let groupActivityChanged = false;
  await services.runTransaction(services.db, async (transaction) => {
    const reads = await Promise.all(groupList.map(async (room) => {
      const memberRef = services.doc(services.db, "leaderboardGroups", room, "members", uid);
      const summaryRef = services.doc(services.db, "leaderboardGroupSummaries", room);
      const [memberSnapshot, summarySnapshot] = await Promise.all([
        transaction.get(memberRef),
        transaction.get(summaryRef),
      ]);
      return { room, memberRef, summaryRef, memberSnapshot, summarySnapshot };
    }));
    const questionReads = await Promise.all(groupList.flatMap((room) => {
      const numbers = new Set([
        ...Object.keys(questionXp?.[room] || {}),
        ...Object.keys(reads.find((item) => item.room === room)?.memberSnapshot.data()?.questionXp || {}),
      ]);
      return [...numbers].map(async (questionNumber) => {
        const summaryRef = services.doc(services.db, "leaderboardQuestionSummaries", `${room}__${questionNumber}`);
        return { room, questionNumber, summaryRef, snapshot: await transaction.get(summaryRef) };
      });
    }));

    const participantRef = services.doc(services.db, "leaderboardParticipants", uid);
    transaction.set(participantRef, {
      uid,
      displayName: profile.displayName,
      currentGroup: profile.room,
      personalXp: totalXp,
      updatedAt: services.serverTimestamp(),
    }, { merge: true });

    reads.forEach(({ room, memberRef, summaryRef, memberSnapshot, summarySnapshot }) => {
      const nextGroupXp = Number(groupXp?.[room] || 0);
      const previousGroupXp = Number(memberSnapshot.data()?.groupXp || 0);
      transaction.set(memberRef, {
        uid,
        groupCode: room,
        displayName: profile.displayName,
        personalXp: totalXp,
        groupXp: nextGroupXp,
        questionXp: questionXp?.[room] || {},
        active: room === profile.room,
        updatedAt: services.serverTimestamp(),
      }, { merge: true });

      const previousSummary = summarySnapshot.data() || {};
      const total = Math.max(0, Number(previousSummary.totalXp || 0) + nextGroupXp - previousGroupXp);
      const becameActive = previousGroupXp < 1 && nextGroupXp >= 1;
      const becameInactive = previousGroupXp >= 1 && nextGroupXp < 1;
      if (becameActive || becameInactive) groupActivityChanged = true;
      const participants = Math.max(0, Number(previousSummary.participants || 0) + (becameActive ? 1 : 0) - (becameInactive ? 1 : 0));
      if (total > 0 || summarySnapshot.exists()) {
        transaction.set(summaryRef, {
          groupCode: room,
          totalXp: total,
          participants,
          averageXp: participants ? total / participants : 0,
          updatedAt: services.serverTimestamp(),
        });
      }
    });

    questionReads.forEach(({ room, questionNumber, summaryRef, snapshot }) => {
      const member = reads.find((item) => item.room === room)?.memberSnapshot.data() || {};
      const previous = Number(member.questionXp?.[questionNumber] || 0);
      const next = Number(questionXp?.[room]?.[questionNumber] || 0);
      const total = Math.max(0, Number(snapshot.data()?.totalXp || 0) + next - previous);
      if (total > 0 || snapshot.exists()) {
        transaction.set(summaryRef, {
          groupCode: room,
          questionNumber: String(questionNumber),
          totalXp: total,
          updatedAt: services.serverTimestamp(),
        });
      }
    });
  });
  if (groupActivityChanged) await refreshReflectionBoardEligibilityFromFirestore();
  return uid;
}

async function refreshReflectionBoardEligibilityFromFirestore() {
  if (!configured) return;
  const services = await getServices();
  const eventRef = services.doc(services.db, "missionEvent", "assis-2026-07-26");
  const groupSummaries = services.collection(services.db, "leaderboardGroupSummaries");
  await services.runTransaction(services.db, async (transaction) => {
    const [eventSnapshot, summariesSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(groupSummaries),
    ]);
    const event = { resolvedByGroup: {}, unlocked: {}, ...(eventSnapshot.data() || {}) };
    refreshReflectionBoardEligibility(event, summariesSnapshot.docs.map((snapshot) => snapshot.data()));
    transaction.set(eventRef, { ...event, updatedAt: services.serverTimestamp() }, { merge: true });
  });
}

export async function subscribeToQuestionGroupTotal(roomCode, questionNumber, callback, onError) {
  if (!configured) return () => {};
  const services = await getServices();
  const summaryRef = services.doc(services.db, "leaderboardQuestionSummaries", `${roomCode}__${questionNumber}`);
  return services.onSnapshot(summaryRef, (snapshot) => callback(Number(snapshot.data()?.totalXp || 0)), onError);
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
    services.collection(services.db, "leaderboardGroupSummaries"),
    services.limit(20),
  );
  let members = [];
  let groups = [];
  const emit = () => callback({ members, groups });
  const unsubMembers = services.onSnapshot(membersQuery, (snapshot) => {
    members = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    emit();
  }, onError);
  const unsubEvent = services.onSnapshot(eventQuery, (snapshot) => {
    groups = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    emit();
  }, onError);
  return () => { unsubMembers(); unsubEvent(); };
}

export async function subscribeToRoom(roomCode, questionNumber, callback, onError) {
  if (!configured) return () => {};
  const services = await getServices();
  const roomRef = services.collection(services.db, "rooms", roomCode, "questions", String(questionNumber), "reflections");
  const roomQuery = services.query(roomRef, services.orderBy("createdAt", "desc"), services.limit(150));
  return services.onSnapshot(
    roomQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((item) => ({ id: item.id, questionNumber, ...item.data() })),
      );
    },
    onError,
  );
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
  return services.onSnapshot(globalQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, questionNumber, ...item.data() })));
  }, onError);
}

export async function publishReflection({ roomCode, questionNumber, name, text }) {
  const uid = await ensureParticipantSession();
  if (!configured) {
    return {
      id: `${questionNumber}_${uid}`,
      questionNumber,
      authorUid: uid,
      name,
      text,
      voters: [],
      roomCode,
      questionNumber: String(questionNumber),
      createdAt: { toMillis: () => Date.now() },
    };
  }

  const services = await getServices();
  const answerId = uid;
  const answerRef = services.doc(services.db, "rooms", roomCode, "questions", String(questionNumber), "reflections", answerId);
  await services.setDoc(answerRef, {
    authorUid: uid,
    name,
    text,
    voters: [],
    roomCode,
    questionNumber: String(questionNumber),
    createdAt: services.serverTimestamp(),
  });
  return { id: answerId };
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
  return services.runTransaction(services.db, async (transaction) => {
    const [answerSnapshot, allocationSnapshot] = await Promise.all([transaction.get(answerRef), transaction.get(allocationRef)]);
    if (!answerSnapshot.exists()) throw new Error("reflection-missing");
    const answer = answerSnapshot.data();
    if (answer.authorUid === uid) throw new Error("own-reflection");
    const reflectionIds = allocationSnapshot.data()?.reflectionIds || [];
    if (reflectionIds.includes(reflectionId) || reflectionIds.length >= 3) throw new Error("heart-limit");
    const nextIds = [...reflectionIds, reflectionId];
    transaction.update(answerRef, { voters: services.arrayUnion(uid) });
    transaction.set(allocationRef, {
      uid,
      questionNumber: String(questionNumber),
      reflectionIds: nextIds,
      updatedAt: services.serverTimestamp(),
    });
    const rewardRef = services.doc(services.db, "heartRewards", `${answer.authorUid}__${questionNumber}__${uid}`);
    transaction.set(rewardRef, {
      authorUid: answer.authorUid,
      voterUid: uid,
      reflectionId,
      questionNumber: String(questionNumber),
      xp: 5,
      createdAt: services.serverTimestamp(),
    });
    return { uid, count: nextIds.length, bonus: nextIds.length === 3 };
  });
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
  const contributorsByGroup = new Map();
  localMissionParticipants.forEach((participant) => {
    if (!participant.active || Number(participant.groupXp || 0) <= 0) return;
    contributorsByGroup.set(participant.currentGroup, Number(contributorsByGroup.get(participant.currentGroup) || 0) + 1);
  });
  const activeGroups = new Set([...contributorsByGroup.entries()]
    .filter(([, contributors]) => contributors >= 2)
    .map(([groupCode]) => groupCode));
  const eligibleCount = [...contributorsByGroup.entries()]
    .filter(([groupCode]) => activeGroups.has(groupCode))
    .reduce((total, [, contributors]) => total + contributors, 0);
  event.resolved ||= {};
  event.eligibleParticipantCount ||= {};
  event.unlocked ||= {};
  Object.keys(event.resolvedByGroup || {}).forEach((key) => {
    const resolvedCount = Object.entries(event.resolvedByGroup[key] || {})
      .filter(([groupCode]) => activeGroups.has(groupCode))
      .reduce((total, [, count]) => total + Number(count || 0), 0);
    event.resolved[key] = resolvedCount;
    event.eligibleParticipantCount[key] = eligibleCount;
    if (eligibleCount > 0 && resolvedCount / eligibleCount >= 0.9) event.unlocked[key] = true;
  });
}

function localGroup(roomCode) {
  if (!localMissionGroups.has(roomCode)) localMissionGroups.set(roomCode, { groupCode: roomCode, challenges: {}, progress: {} });
  return localMissionGroups.get(roomCode);
}

function emitLocalMissionGroup(roomCode) {
  const listeners = localMissionListeners.get(roomCode) || [];
  listeners.forEach((callback) => callback(structuredClone(localGroup(roomCode))));
}

function chooseMission({ participant, group, event, sharedChallenges, questions, roomCode, now, excludeMissionId = "" }) {
  const candidates = [];
  for (const challenge of sharedChallenges) {
    const saved = group.challenges?.[challenge.id];
    const available = !saved || (saved.status !== "completed" && saved.status !== "skipped" && (saved.status !== "reserved" || Number(saved.leaseUntil || 0) <= now));
    if (available && challenge.id !== excludeMissionId) candidates.push({ ...challenge, type: "shared", groupCode: roomCode });
  }
  for (const questionNumber of questions) {
    const key = String(questionNumber);
    if (!participant.reflectionStatus?.[key]) candidates.push({ id: `reflection__${key}`, type: "reflection", questionNumber, groupCode: roomCode, xp: 10 });
    if (event.unlocked?.[key] && participant.reflectionStatus?.[key] && !participant.boardCompleted?.[key]) {
      candidates.push({ id: `board__${key}`, type: "board", questionNumber, groupCode: roomCode, xp: 2 });
    }
  }
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function claimRandomMission({ roomCode, sharedChallenges, questions, excludeMissionId = "" }) {
  const uid = await ensureParticipantSession();
  const now = Date.now();
  if (!configured) {
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
  const groupRef = services.doc(services.db, "missionGroups", roomCode);
  const eventRef = services.doc(services.db, "missionEvent", "assis-2026-07-26");
  return services.runTransaction(services.db, async (transaction) => {
    const [participantSnapshot, groupSnapshot, eventSnapshot] = await Promise.all([
      transaction.get(participantRef), transaction.get(groupRef), transaction.get(eventRef),
    ]);
    const participant = { uid, currentGroup: roomCode, active: false, activeMission: null, reflectionStatus: {}, boardCompleted: {}, ...(participantSnapshot.data() || {}) };
    const group = { groupCode: roomCode, challenges: {}, progress: {}, ...(groupSnapshot.data() || {}) };
    const event = { activeCount: 0, resolved: {}, unlocked: {}, ...(eventSnapshot.data() || {}) };
    if (participant.activeMission?.expiresAt > now && participant.activeMission.groupCode === roomCode) return participant.activeMission;
    if (!participant.active) { participant.active = true; event.activeCount += 1; }
    const mission = chooseMission({ participant, group, event, sharedChallenges, questions, roomCode, now, excludeMissionId });
    if (!mission) {
      transaction.set(participantRef, { ...participant, activeMission: null, updatedAt: services.serverTimestamp() }, { merge: true });
      transaction.set(eventRef, { ...event, updatedAt: services.serverTimestamp() }, { merge: true });
      const complete = sharedChallenges.every((item) => ["completed", "skipped"].includes(group.challenges?.[item.id]?.status))
        && questions.every((number) => participant.reflectionStatus?.[number] && participant.boardCompleted?.[number]);
      return complete ? { type: "complete" } : null;
    }
    mission.expiresAt = now + MISSION_LEASE_MS;
    participant.currentGroup = roomCode;
    participant.activeMission = mission;
    if (mission.type === "shared") group.challenges[mission.id] = { status: "reserved", reservedBy: uid, leaseUntil: mission.expiresAt };
    transaction.set(participantRef, { ...participant, updatedAt: services.serverTimestamp() }, { merge: true });
    transaction.set(groupRef, { ...group, updatedAt: services.serverTimestamp() }, { merge: true });
    transaction.set(eventRef, { ...event, updatedAt: services.serverTimestamp() }, { merge: true });
    return mission;
  });
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
  const groupRef = services.doc(services.db, "missionGroups", mission.groupCode);
  return services.runTransaction(services.db, async (transaction) => {
    const [participantSnapshot, groupSnapshot] = await Promise.all([
      transaction.get(participantRef),
      mission.type === "shared" ? transaction.get(groupRef) : Promise.resolve(null),
    ]);
    const participant = participantSnapshot.data();
    if (participant?.activeMission?.id !== mission.id) return null;
    const nextMission = { ...participant.activeMission, expiresAt };
    if (mission.type === "shared") {
      const group = groupSnapshot.data() || { challenges: {} };
      if (group.challenges?.[mission.id]?.reservedBy !== uid) return null;
      group.challenges[mission.id] = { ...group.challenges[mission.id], leaseUntil: expiresAt };
      transaction.set(groupRef, { ...group, updatedAt: services.serverTimestamp() }, { merge: true });
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
  const groupRef = services.doc(services.db, "missionGroups", mission.groupCode);
  return services.runTransaction(services.db, async (transaction) => {
    const [participantSnapshot, groupSnapshot] = await Promise.all([transaction.get(participantRef), transaction.get(groupRef)]);
    const participant = participantSnapshot.data();
    const group = groupSnapshot.data() || { challenges: {}, progress: {} };
    const saved = group.challenges?.[mission.id];
    if (participant?.activeMission?.id !== mission.id || saved?.reservedBy !== uid || saved.status === "completed") throw new Error("mission-not-owned");
    group.challenges[mission.id] = { ...saved, status: "completed", completedBy: uid, correct, xpAwarded, completedAt: Date.now() };
    group.progress ||= {};
    group.progress[key] = Number(group.progress[key] || 0) + 1;
    transaction.set(groupRef, { ...group, updatedAt: services.serverTimestamp() }, { merge: true });
    transaction.update(participantRef, { activeMission: null, updatedAt: services.serverTimestamp() });
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
  const groupRef = services.doc(services.db, "missionGroups", mission.groupCode);
  return services.runTransaction(services.db, async (transaction) => {
    const [participantSnapshot, groupSnapshot] = await Promise.all([transaction.get(participantRef), transaction.get(groupRef)]);
    const participant = participantSnapshot.data();
    const group = groupSnapshot.data() || { challenges: {}, progress: {} };
    const saved = group.challenges?.[mission.id];
    if (participant?.activeMission?.id !== mission.id || saved?.reservedBy !== uid || saved.status !== "reserved") throw new Error("mission-not-owned");
    group.challenges[mission.id] = { ...saved, status: "skipped", skippedBy: uid, skippedAt: services.serverTimestamp() };
    group.progress ||= {};
    group.progress[key] = Number(group.progress[key] || 0) + 1;
    transaction.set(groupRef, { ...group, updatedAt: services.serverTimestamp() }, { merge: true });
    transaction.update(participantRef, { activeMission: null, updatedAt: services.serverTimestamp() });
    return true;
  });
}

export async function finishPersonalMission({ mission, reflectionStatus = "" }) {
  const uid = await ensureParticipantSession();
  const key = String(mission.questionNumber);
  if (!configured) {
    const participant = localParticipant(uid, mission.groupCode);
    if (reflectionStatus && !participant.reflectionStatus[key]) {
      participant.reflectionStatus[key] = reflectionStatus;
      localMissionEvent.resolvedByGroup ||= {};
      localMissionEvent.resolvedByGroup[key] ||= {};
      if (Number(participant.groupXp || 0) > 0) {
        localMissionEvent.resolvedByGroup[key][mission.groupCode] = Number(localMissionEvent.resolvedByGroup[key][mission.groupCode] || 0) + 1;
      }
    }
    refreshLocalReflectionBoardEligibility(localMissionEvent);
    if (mission.type === "board") participant.boardCompleted[key] = true;
    participant.activeMission = null;
    return { unlocked: Boolean(localMissionEvent.unlocked[key]) };
  }
  const services = await getServices();
  const participantRef = services.doc(services.db, "missionParticipants", uid);
  const eventRef = services.doc(services.db, "missionEvent", "assis-2026-07-26");
  const memberRef = services.doc(services.db, "leaderboardGroups", mission.groupCode, "members", uid);
  // Complete the participant-owned mission first. The shared event document
  // is intentionally updated afterwards so many simultaneous reflections do
  // not make every participant wait on the same contended transaction.
  const result = await services.runTransaction(services.db, async (transaction) => {
    const participantSnapshot = await transaction.get(participantRef);
    const participant = participantSnapshot.data() || { reflectionStatus: {}, boardCompleted: {} };
    if (participant.activeMission?.id !== mission.id) throw new Error("mission-not-owned");
    participant.reflectionStatus ||= {};
    participant.boardCompleted ||= {};
    const newlyResolvedReflection = Boolean(reflectionStatus && !participant.reflectionStatus[key]);
    if (reflectionStatus && !participant.reflectionStatus[key]) {
      participant.reflectionStatus[key] = reflectionStatus;
    }
    if (mission.type === "board") participant.boardCompleted[key] = true;
    participant.activeMission = null;
    transaction.set(participantRef, { ...participant, updatedAt: services.serverTimestamp() }, { merge: true });
    return { unlocked: false, newlyResolvedReflection };
  });

  if (result.newlyResolvedReflection) {
    void (async () => {
      const memberSnapshot = await services.getDoc(memberRef);
      if (Number(memberSnapshot.data()?.groupXp || 0) > 0) {
        await services.runTransaction(services.db, async (transaction) => {
          const eventSnapshot = await transaction.get(eventRef);
          const event = { resolvedByGroup: {}, unlocked: {}, ...(eventSnapshot.data() || {}) };
          event.resolvedByGroup ||= {};
          event.resolvedByGroup[key] ||= {};
          event.resolvedByGroup[key][mission.groupCode] = Number(event.resolvedByGroup[key][mission.groupCode] || 0) + 1;
          transaction.set(eventRef, { ...event, updatedAt: services.serverTimestamp() }, { merge: true });
        });
      }
      await refreshReflectionBoardEligibilityFromFirestore();
    })().catch((error) => {
      console.warn("Unable to refresh reflection-board eligibility", error);
    });
  }
  return { unlocked: result.unlocked };
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
  const groupRef = services.doc(services.db, "missionGroups", mission.groupCode);
  await services.runTransaction(services.db, async (transaction) => {
    const participantSnapshot = await transaction.get(participantRef);
    if (participantSnapshot.data()?.activeMission?.id !== mission.id) return;
    if (mission.type === "shared") {
      const groupSnapshot = await transaction.get(groupRef);
      const group = groupSnapshot.data() || { challenges: {} };
      if (group.challenges?.[mission.id]?.reservedBy === uid && group.challenges[mission.id].status === "reserved") delete group.challenges[mission.id];
      transaction.set(groupRef, { ...group, updatedAt: services.serverTimestamp() }, { merge: true });
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
  return services.onSnapshot(groupRef, (snapshot) => callback({ groupCode: roomCode, challenges: {}, progress: {}, ...(snapshot.data() || {}) }), onError);
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
  const snapshot = await services.getDocs(services.query(reflectionsRef, ...constraints));
  return {
    reflections: snapshot.docs.map((item) => ({ id: item.id, questionNumber, ...item.data() })),
    cursor: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.size === pageSize,
  };
}

export function participantUid() {
  return currentUid || auth?.currentUser?.uid || null;
}
