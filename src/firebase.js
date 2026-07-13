const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const configured = Object.values(config).every(Boolean);
let servicesPromise = null;
let auth = null;
let currentUid = null;

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
  await services.setPersistence(services.auth, services.browserSessionPersistence);
  const credential = services.auth.currentUser
    ? { user: services.auth.currentUser }
    : await services.signInAnonymously(services.auth);
  currentUid = credential.user.uid;
  return currentUid;
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

export async function publishReflection({ roomCode, questionNumber, name, age, text }) {
  const uid = await ensureParticipantSession();
  if (!configured) {
    return {
      id: `${questionNumber}_${uid}`,
      questionNumber,
      authorUid: uid,
      name,
      age,
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
    age,
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
  if (!configured) return uid;
  const services = await getServices();
  const answerRef = services.doc(services.db, "rooms", roomCode, "questions", String(questionNumber), "reflections", reflectionId);
  await services.updateDoc(answerRef, { voters: services.arrayUnion(uid) });
  return uid;
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
