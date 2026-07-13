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
      const now = Date.now();
      callback(
        snapshot.docs
          .map((item) => ({ id: item.id, questionNumber, ...item.data() }))
          .filter((item) => !item.expiresAt || item.expiresAt.toMillis() > now),
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
      createdAt: { toMillis: () => Date.now() },
      expiresAt: { toMillis: () => Date.now() + 6 * 60 * 60 * 1000 },
    };
  }

  const services = await getServices();
  const answerId = uid;
  const answerRef = services.doc(services.db, "rooms", roomCode, "questions", String(questionNumber), "reflections", answerId);
  const expiresAt = services.Timestamp.fromMillis(Date.now() + 6 * 60 * 60 * 1000);
  await services.setDoc(answerRef, {
    authorUid: uid,
    name,
    age,
    text,
    voters: [],
    createdAt: services.serverTimestamp(),
    expiresAt,
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

export function participantUid() {
  return currentUid || auth?.currentUser?.uid || null;
}
