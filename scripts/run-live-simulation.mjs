import { readFileSync, writeFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence, signInAnonymously } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import activities from "../src/data/approved-activities.js";
import { GROUPS } from "../src/groups.js";
import { REFLECTION_BOARD_UNLOCK_RATIO } from "../src/reflections.js";
import { isGroupJourneyComplete } from "../src/event-winner.js";

const ENV = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
  .filter(Boolean)
  .map(([, key, value]) => [key, value.trim()]));

const config = {
  apiKey: ENV.VITE_FIREBASE_API_KEY,
  authDomain: ENV.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: ENV.VITE_FIREBASE_PROJECT_ID,
  storageBucket: ENV.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.VITE_FIREBASE_APP_ID,
};

if (Object.values(config).some((value) => !value)) throw new Error("Missing Firebase configuration in .env.local.");

const RUN_MINUTES = positiveInteger(process.env.SIMULATION_MINUTES, 35);
const GROUP_COUNT = Math.min(10, positiveInteger(process.env.SIMULATION_GROUPS, 10));
const USERS_PER_GROUP = Math.min(10, positiveInteger(process.env.SIMULATION_USERS_PER_GROUP, 10));
const EVENT_ID = "assis-2026-07-26";
const questionNumbers = Object.keys(activities).map(Number).sort((a, b) => a - b);
const simulationNames = [
  ["Ana Luiza", "Gabriel Santos", "Beatriz Lima", "Lucas Henrique", "Maria Eduarda", "Rafael Costa", "Sofia Almeida", "Pedro Miguel", "Julia Martins"],
  ["Joao Vitor", "Camila Rocha", "Felipe Augusto", "Larissa Gomes", "Matheus Oliveira", "Isabela Ferreira", "Thiago Mendes", "Vitoria Souza", "Daniel Ribeiro", "Helena Cardoso"],
  ["Bruno Carvalho", "Mariana Silva", "Caio Rodrigues", "Leticia Moraes", "Gustavo Freitas", "Clara Nunes", "Enzo Barros", "Yasmin Lopes", "Andre Teixeira", "Luana Pereira"],
  ["Vinicius Araujo", "Alice Moreira", "Davi Cardoso", "Luiza Barros", "Miguel Farias", "Cecilia Ramos", "Arthur Moura", "Manuela Pires", "Guilherme Castro", "Bianca Duarte"],
  ["Bernardo Melo", "Elisa Freire", "Heitor Rezende", "Laura Siqueira", "Nicolas Fonseca", "Valentina Campos", "Samuel Peixoto", "Lorena Tavares", "Igor Paiva", "Marina Borges"],
  ["Eduardo Neves", "Olivia Nascimento", "Leonardo Vieira", "Helena Azevedo", "Diego Macedo", "Isis Dantas", "Caue Batista", "Livia Machado", "Renato Aguiar", "Carolina Meireles"],
  ["Ricardo Matos", "Teresa Fonseca", "Wesley Rocha", "Gabriela Coelho", "Hugo Viana", "Fernanda Vilela", "Joana Costa", "Caio Nogueira", "Paulo Cesar", "Ester Almeida"],
  ["Mateus Brito", "Clara Fernandes", "Vitor Hugo", "Amanda Sales", "Enrico Xavier", "Larissa Pacheco", "Ruan Monteiro", "Natalia Reis", "Felipe Soares", "Rafaela Prado"],
  ["Lucca Moraes", "Mariana Leite", "Enzo Afonso", "Isadora Mendes", "Thiago Araujo", "Camila Lopes", "Gustavo Neiva", "Yasmin Rios", "Pedro Paulo", "Beatriz Assis"],
  ["Murilo Gouveia", "Sabrina Nunes", "Joao Gabriel", "Alice Valente", "Rodolfo Sampaio", "Leticia Prado", "Daniela Pires", "Vitor Nascimento", "Marcos Vinicius", "Juliana Farias"],
];
const groupPlans = GROUPS.slice(0, GROUP_COUNT).map((group, index) => ({
  code: group.code,
  // One place is deliberately held open for Fr. Joachim in Assis-Sao-Jose.
  names: simulationNames[index].slice(0, index === 0 ? USERS_PER_GROUP - 1 : USERS_PER_GROUP),
}));

const sharedChallenges = questionNumbers.flatMap((questionNumber) => {
  const item = activities[questionNumber];
  return [
    { id: `${questionNumber}__quiz`, questionNumber, xp: 10 },
    ...item.games.map((game, index) => ({ id: `${questionNumber}__game-${index}`, questionNumber, xp: gameXp(game) })),
  ];
});

const bots = [];
const botByUid = new Map();
let runUntil = 0;
const statusPath = "/tmp/youcat-live-simulation.status";

for (const plan of groupPlans) {
  for (const name of plan.names) bots.push({ name, room: plan.code });
}

console.log(`Creating ${bots.length} simulated participants for ${RUN_MINUTES} minutes.`);
console.log("Assis-Sao-Jose intentionally has nine simulated participants; one place is reserved for the human participant.");
writeStatus("starting");

for (const [index, bot] of bots.entries()) {
  await prepareBot(bot, index);
  writeStatus("starting");
}
await Promise.all(groupPlans.map((plan) => syncGroupSummary(plan.code)));
runUntil = Date.now() + RUN_MINUTES * 60_000;
console.log("SIMULATION_READY");
writeStatus("ready");

scheduleFinaleSimulation();
setTimeout(stopSimulation, Math.max(0, runUntil - Date.now()));

function gameXp(game) {
  if (game.xp) return game.xp;
  if (game.type === "minigame") return 5;
  if (game.type === "match") return 4;
  if (game.type === "order") return 6;
  if (game.type === "move") return Math.min(9, 4 + (game.answer?.length || 3));
  if (game.type === "reveal") return Math.min(9, 3 + (game.cards?.length || 3));
  if (game.type === "crossword") return Math.min(10, 4 + (game.clues?.length || 4));
  if (game.type === "wordsearch") return Math.min(10, 4 + (game.words?.length || 4));
  return 5;
}

async function prepareBot(bot, index) {
  bot.app = initializeApp(config, `live-simulation-${Date.now()}-${index}`);
  bot.auth = getAuth(bot.app);
  await setPersistence(bot.auth, inMemoryPersistence);
  bot.uid = (await signInAnonymously(bot.auth)).user.uid;
  bot.db = getFirestore(bot.app);
  bot.totalXp = 0;
  bot.groupXp = 0;
  bot.questionXp = {};
  bot.readingActions = 0;
  bot.readingTarget = randomInteger(2, 5);
  bot.reflectionStatus = new Map();
  bot.heartAllocations = new Map();
  bot.boardCompleted = new Set();
  botByUid.set(bot.uid, bot);
  await setDoc(doc(bot.db, "missionParticipants", bot.uid), {
    uid: bot.uid,
    currentGroup: bot.room,
    active: true,
    activeMission: null,
    reflectionStatus: {},
    boardCompleted: {},
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(bot.db, "leaderboardGroups", bot.room, "members", bot.uid), {
    uid: bot.uid,
    groupCode: bot.room,
    displayName: bot.name,
    personalXp: 0,
    groupXp: 0,
    questionXp: {},
    reflectionStatus: {},
    boardCompleted: {},
    active: true,
    updatedAt: serverTimestamp(),
  });
}

function scheduleFinaleSimulation() {
  const totalMs = RUN_MINUTES * 60_000;
  const firstActionAt = 12_000;
  const reflectionStartAt = 30_000;
  const reflectionWindow = Math.round(totalMs * 0.30);
  const challengeStartAt = 45_000;
  const challengeWindow = Math.round(totalMs * 0.78);
  const boardStartAt = reflectionStartAt + reflectionWindow + 25_000;
  const boardWindow = Math.round(totalMs * 0.48);
  const bonusStartAt = 70_000;
  const bonusWindow = Math.round(totalMs * 0.70);
  const readingBonusByGroup = {
    "Assis-Sao-Jose": 175,
    "Assis-Sao-Francisco": 390,
    "Assis-Santa-Clara": 270,
    "Assis-Santo-Antonio": 240,
    "Assis-Sao-Joao-Paulo": 220,
    "Assis-Santa-Teresa-de-Calcuta": 205,
    "Assis-Sao-Pedro": 190,
    "Assis-Sao-Paulo": 180,
    "Assis-Santa-Rita": 165,
    "Assis-Sao-Bento": 150,
  };

  groupPlans.forEach((plan) => {
    const groupBots = bots.filter((bot) => bot.room === plan.code);

    // A first short reading makes every bot a current, contributing group member.
    groupBots.forEach((bot, index) => {
      scheduleAction(bot, firstActionAt + index * 1_400 + randomInteger(0, 3_000), async () => {
        await awardXp(bot, randomInteger(2, 5), questionNumbers[index % questionNumbers.length]);
      });
    });

    // Everyone resolves every personal reflection in a natural mix of submitted and declined answers.
    groupBots.forEach((bot, index) => {
      questionNumbers.forEach((questionNumber, reflectionIndex) => {
        const offset = Math.round(((index * questionNumbers.length) + reflectionIndex) * reflectionWindow / Math.max(1, groupBots.length * questionNumbers.length - 1));
        scheduleAction(bot, reflectionStartAt + offset + randomInteger(0, 9_000), async () => {
          await completeReflection(bot, { questionNumber, submitted: Math.random() < 0.86 });
        });
      });
    });

    // Rebuild the current-member and resolved-reflection counts before checking the board rule.
    scheduleAction(groupBots[0], reflectionStartAt + reflectionWindow + 18_000, async () => {
      await syncGroupSummary(plan.code);
      await refreshBoardEligibility(groupBots[0].db);
    });

    // Once the boards unlock, every participant gives three hearts for every question.
    groupBots.forEach((bot, index) => {
      questionNumbers.forEach((questionNumber, boardIndex) => {
        const offset = Math.round(((index * questionNumbers.length) + boardIndex) * boardWindow
          / Math.max(1, groupBots.length * questionNumbers.length - 1));
        scheduleAction(bot, boardStartAt + offset + randomInteger(0, 5_000), async () => {
          await completeBoard(bot, questionNumber);
          await tryDeclareWinner(plan.code);
        });
      });
    });

    // Team challenges are distributed across the event, with an occasional missed answer.
    sharedChallenges.forEach((challenge, index) => {
      const bot = groupBots[index % groupBots.length];
      const offset = Math.round(index * challengeWindow / Math.max(1, sharedChallenges.length - 1));
      scheduleAction(bot, challengeStartAt + offset + randomInteger(0, 9_000), async () => {
        await completeSpecificChallenge(bot, challenge);
        await tryDeclareWinner(plan.code);
      });
    });

    // Different amounts of voluntary reading produce a clear, but plausible, final ranking.
    const bonus = readingBonusByGroup[plan.code];
    const perBot = Math.floor(bonus / groupBots.length);
    let remainder = bonus % groupBots.length;
    groupBots.forEach((bot, index) => {
      const xp = perBot + (remainder-- > 0 ? 1 : 0);
      scheduleAction(bot, bonusStartAt + Math.round(index * bonusWindow / groupBots.length) + randomInteger(0, 8_000), async () => {
        const questionNumber = questionNumbers[(index * 3 + groupBots.length) % questionNumbers.length];
        await awardXp(bot, xp, questionNumber);
        console.log(`${bot.name} completed additional reading in question ${questionNumber}.`);
      });
    });
  });

  // A final consistency pass makes the board status visible before the finish.
  setTimeout(async () => {
    try {
      await Promise.all(groupPlans.map((plan) => syncGroupSummary(plan.code)));
      await refreshBoardEligibility(bots[0].db);
    } catch (error) {
      console.warn(`Final reflection summary failed: ${error.message}`);
    }
  }, Math.max(0, totalMs - 30_000));
}

function scheduleAction(bot, delay, action) {
  bot.timers ||= [];
  bot.timers.push(setTimeout(async () => {
    if (Date.now() >= runUntil) return;
    try {
      await action();
    } catch (error) {
      console.warn(`Simulation action failed for ${bot.name}: ${error.message}`);
    }
  }, delay));
}

async function awardXp(bot, xp, questionNumber) {
  if (xp <= 0) return;
  const participantRef = doc(bot.db, "leaderboardParticipants", bot.uid);
  const memberRef = doc(bot.db, "leaderboardGroups", bot.room, "members", bot.uid);
  const summaryRef = doc(bot.db, "leaderboardGroupSummaries", bot.room);
  const questionRef = doc(bot.db, "leaderboardQuestionSummaries", `${bot.room}__${questionNumber}`);
  await runTransaction(bot.db, async (transaction) => {
    const [participantSnapshot, memberSnapshot, summarySnapshot, questionSnapshot] = await Promise.all([
      transaction.get(participantRef), transaction.get(memberRef), transaction.get(summaryRef), transaction.get(questionRef),
    ]);
    const previousTotal = Number(participantSnapshot.data()?.personalXp || 0);
    const previousGroup = Number(memberSnapshot.data()?.groupXp || 0);
    const previousQuestion = Number(memberSnapshot.data()?.questionXp?.[questionNumber] || 0);
    const nextQuestionXp = { ...(memberSnapshot.data()?.questionXp || {}), [questionNumber]: previousQuestion + xp };
    const nextTotal = previousTotal + xp;
    const nextGroup = previousGroup + xp;
    const totalXp = Math.max(0, Number(summarySnapshot.data()?.totalXp || 0) + xp);
    const participants = Math.max(0, Number(summarySnapshot.data()?.participants || 0) + (previousGroup < 1 ? 1 : 0));
    transaction.set(participantRef, { uid: bot.uid, displayName: bot.name, currentGroup: bot.room, personalXp: nextTotal, updatedAt: serverTimestamp() });
    transaction.set(memberRef, {
      uid: bot.uid,
      groupCode: bot.room,
      displayName: bot.name,
      personalXp: nextTotal,
      groupXp: nextGroup,
      questionXp: nextQuestionXp,
      reflectionStatus: Object.fromEntries(bot.reflectionStatus),
      active: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    transaction.set(summaryRef, { groupCode: bot.room, totalXp, participants, averageXp: participants ? totalXp / participants : 0, updatedAt: serverTimestamp() }, { merge: true });
    transaction.set(questionRef, { groupCode: bot.room, questionNumber: String(questionNumber), totalXp: Math.max(0, Number(questionSnapshot.data()?.totalXp || 0) + xp), updatedAt: serverTimestamp() });
  });
  bot.totalXp += xp;
  bot.groupXp += xp;
  bot.questionXp[questionNumber] = Number(bot.questionXp[questionNumber] || 0) + xp;
}

async function completeChallenge(bot) {
  const groupRef = doc(bot.db, "missionGroups", bot.room);
  const outcome = await runTransaction(bot.db, async (transaction) => {
    const snapshot = await transaction.get(groupRef);
    const group = { groupCode: bot.room, challenges: {}, progress: {}, ...(snapshot.data() || {}) };
    const available = sharedChallenges.filter((challenge) => {
      const saved = group.challenges?.[challenge.id];
      return !saved || (saved.status === "reserved" && Number(saved.leaseUntil || 0) <= Date.now());
    });
    if (!available.length) return null;
    const challenge = randomItem(available);
    const skipped = Math.random() < 0.07;
    const correct = !skipped && Math.random() < 0.68;
    group.challenges[challenge.id] = {
      status: skipped ? "skipped" : "completed",
      completedBy: bot.uid,
      correct,
      xpAwarded: correct ? challenge.xp : 0,
      completedAt: Date.now(),
    };
    group.progress[String(challenge.questionNumber)] = Number(group.progress[String(challenge.questionNumber)] || 0) + 1;
    transaction.set(groupRef, { ...group, updatedAt: serverTimestamp() });
    return { ...challenge, correct, skipped };
  });
  if (!outcome) return false;
  if (outcome.correct) await awardXp(bot, outcome.xp, outcome.questionNumber);
  console.log(`${bot.name} ${outcome.skipped ? "skipped" : outcome.correct ? "solved" : "missed"} a challenge in question ${outcome.questionNumber}.`);
  return true;
}

async function completeSpecificChallenge(bot, challenge) {
  const groupRef = doc(bot.db, "missionGroups", bot.room);
  const completed = await runTransaction(bot.db, async (transaction) => {
    const snapshot = await transaction.get(groupRef);
    const group = { groupCode: bot.room, challenges: {}, progress: {}, ...(snapshot.data() || {}) };
    const existing = group.challenges?.[challenge.id];
    // Never replace a challenge that a real participant currently has open.
    if (existing?.status === "completed" || existing?.status === "skipped" || (existing?.status === "reserved" && Number(existing.leaseUntil || 0) > Date.now())) return false;
    const skipped = Math.random() < 0.04;
    const correct = !skipped && Math.random() < 0.78;
    group.challenges[challenge.id] = {
      status: skipped ? "skipped" : "completed",
      completedBy: bot.uid,
      correct,
      xpAwarded: correct ? challenge.xp : 0,
      completedAt: Date.now(),
    };
    group.progress[String(challenge.questionNumber)] = Number(group.progress[String(challenge.questionNumber)] || 0) + 1;
    transaction.set(groupRef, { ...group, updatedAt: serverTimestamp() });
    return { correct, skipped };
  });
  if (!completed) return false;
  if (completed.correct) await awardXp(bot, challenge.xp, challenge.questionNumber);
  console.log(`${bot.name} ${completed.skipped ? "skipped" : completed.correct ? "solved" : "missed"} a challenge in question ${challenge.questionNumber}.`);
  return true;
}

async function completeReflection(bot, { questionNumber: requestedQuestion, submitted: requestedSubmission } = {}) {
  const pending = questionNumbers.filter((number) => !bot.reflectionStatus.has(number));
  if (!pending.length) return false;
  const questionNumber = pending.includes(requestedQuestion) ? requestedQuestion : randomItem(pending);
  const submitted = requestedSubmission ?? Math.random() < 0.76;
  if (submitted) {
    const text = reflectionText(questionNumber);
    await setDoc(doc(bot.db, "rooms", bot.room, "questions", String(questionNumber), "reflections", bot.uid), {
      authorUid: bot.uid,
      name: bot.name,
      text,
      voters: [],
      roomCode: bot.room,
      questionNumber: String(questionNumber),
      createdAt: serverTimestamp(),
    });
    const xp = text.length > 100 ? 10 : text.length > 30 ? 5 : 0;
    await awardXp(bot, xp, questionNumber);
  }
  const status = submitted ? "submitted" : "declined";
  bot.reflectionStatus.set(questionNumber, status);
  await setDoc(doc(bot.db, "missionParticipants", bot.uid), {
    uid: bot.uid,
    currentGroup: bot.room,
    active: true,
    activeMission: null,
    reflectionStatus: Object.fromEntries(bot.reflectionStatus),
    boardCompleted: Object.fromEntries([...bot.boardCompleted].map((number) => [number, true])),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await setDoc(doc(bot.db, "leaderboardGroups", bot.room, "members", bot.uid), {
    reflectionStatus: Object.fromEntries(bot.reflectionStatus),
    active: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  console.log(`${bot.name} ${submitted ? "shared" : "skipped"} a reflection for question ${questionNumber}.`);
  return true;
}

function reflectionText(questionNumber) {
  const texts = [
    "Quero escolher gestos simples que deixem minhas relações mais verdadeiras e respeitosas.",
    "Para mim, esta pergunta lembra que a liberdade cresce quando há sinceridade, tempo para pensar e cuidado concreto com o outro.",
    "Percebo que vale a pena conversar com clareza, ouvir bem e não deixar a pressa decidir aquilo que pede responsabilidade.",
    "Um pequeno passo seria tratar as pessoas com mais atenção e coerência, especialmente quando uma escolha parece mais fácil do que realmente é.",
  ];
  const short = ["Quero agir com mais clareza.", "A amizade pede respeito.", "Vale a pena pensar melhor."];
  const roll = Math.random();
  if (roll < 0.22) return randomItem(short);
  if (roll < 0.7) return randomItem(texts.slice(0, 2));
  return `${randomItem(texts.slice(2))} Esta é uma ideia que quero levar para as escolhas desta semana, também na forma como escuto e respondo às outras pessoas. (Questão ${questionNumber})`;
}

async function refreshBoardEligibility(db) {
  const summaries = (await getDocs(collection(db, "leaderboardGroupSummaries"))).docs.map((snapshot) => snapshot.data());
  const activeGroups = summaries.filter((group) => Number(group.participants || 0) >= 2);
  const eligibleCount = activeGroups.reduce((total, group) => total + Number(group.members || 0), 0);
  const eventRef = doc(db, "missionEvent", EVENT_ID);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(eventRef);
    const event = { resolved: {}, eligibleParticipantCount: {}, unlocked: {}, ...(snapshot.data() || {}) };
    for (const questionNumber of questionNumbers) {
      const key = String(questionNumber);
      const resolved = activeGroups.reduce((total, group) => total + Number(group.reflectionResolved?.[key] || 0), 0);
      event.resolved[key] = resolved;
      event.eligibleParticipantCount[key] = eligibleCount;
      if (eligibleCount > 0 && resolved / eligibleCount >= REFLECTION_BOARD_UNLOCK_RATIO) event.unlocked[key] = true;
    }
    transaction.set(eventRef, { ...event, updatedAt: serverTimestamp() });
  });
}

async function syncGroupSummary(roomCode) {
  const referenceBot = bots.find((bot) => bot.room === roomCode);
  if (!referenceBot) return;
  const membersSnapshot = await getDocs(collection(referenceBot.db, "leaderboardGroups", roomCode, "members"));
  const members = membersSnapshot.docs.map((snapshot) => snapshot.data()).filter((member) => member.active !== false);
  const contributors = members.filter((member) => Number(member.groupXp || 0) > 0);
  const reflectionResolved = {};
  members.forEach((member) => {
    Object.entries(member.reflectionStatus || {}).forEach(([key, status]) => {
      if (status === "submitted" || status === "declined") {
        reflectionResolved[key] = Number(reflectionResolved[key] || 0) + 1;
      }
    });
  });
  const summaryRef = doc(referenceBot.db, "leaderboardGroupSummaries", roomCode);
  await runTransaction(referenceBot.db, async (transaction) => {
    const snapshot = await transaction.get(summaryRef);
    const totalXp = Number(snapshot.data()?.totalXp || 0);
    transaction.set(summaryRef, {
      groupCode: roomCode,
      totalXp,
      participants: contributors.length,
      members: members.length,
      reflectionResolved,
      averageXp: contributors.length ? totalXp / contributors.length : 0,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
}

async function tryDeclareWinner(roomCode) {
  const referenceBot = bots.find((bot) => bot.room === roomCode);
  if (!referenceBot) return null;
  const eventRef = doc(referenceBot.db, "missionEvent", EVENT_ID);
  const existing = await getDoc(eventRef);
  if (existing.data()?.winnerGroup) return existing.data().winnerGroup;
  const [membersSnapshot, groupSnapshot, summarySnapshot] = await Promise.all([
    getDocs(collection(referenceBot.db, "leaderboardGroups", roomCode, "members")),
    getDoc(doc(referenceBot.db, "missionGroups", roomCode)),
    getDoc(doc(referenceBot.db, "leaderboardGroupSummaries", roomCode)),
  ]);
  const complete = isGroupJourneyComplete({
    members: membersSnapshot.docs.map((snapshot) => snapshot.data()),
    group: groupSnapshot.data() || { challenges: {} },
    challengeIds: sharedChallenges.map((challenge) => challenge.id),
    questions: questionNumbers,
  });
  if (!complete) return null;
  const winnerXp = Number(summarySnapshot.data()?.totalXp || 0);
  const winner = await runTransaction(referenceBot.db, async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    if (eventSnapshot.data()?.winnerGroup) return eventSnapshot.data().winnerGroup;
    transaction.set(eventRef, {
      winnerGroup: roomCode,
      winnerXp,
      winnerDeclaredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return roomCode;
  });
  if (winner === roomCode) {
    console.log(`WINNER_DECLARED ${roomCode} (${winnerXp} XP)`);
    writeStatus("winner", { winnerGroup: roomCode, winnerXp });
  }
  return winner;
}

async function giveSimulationHeart(bot, requestedQuestionNumber) {
  const questionNumber = requestedQuestionNumber || randomItem([...bot.reflectionStatus.keys()]);
  if (!questionNumber) return false;
  const hearted = bot.heartAllocations.get(questionNumber) || new Set();
  if (hearted.size >= 3) return false;
  const candidates = [];
  for (const plan of groupPlans) {
    const snapshots = await getDocs(collection(bot.db, "rooms", plan.code, "questions", String(questionNumber), "reflections"));
    snapshots.docs.forEach((snapshot) => {
      const reflection = { id: snapshot.id, ...snapshot.data(), roomCode: plan.code };
      if (reflection.authorUid !== bot.uid && !hearted.has(reflection.id) && botByUid.has(reflection.authorUid)) candidates.push(reflection);
    });
  }
  if (!candidates.length) return false;
  const reflection = randomItem(candidates);
  const target = botByUid.get(reflection.authorUid);
  const answerRef = doc(bot.db, "rooms", reflection.roomCode, "questions", String(questionNumber), "reflections", reflection.id);
  const allocationRef = doc(bot.db, "heartAllocations", `${bot.uid}__${questionNumber}`);
  const rewardRef = doc(bot.db, "heartRewards", `${reflection.authorUid}__${questionNumber}__${bot.uid}`);
  const result = await runTransaction(bot.db, async (transaction) => {
    const [answerSnapshot, allocationSnapshot] = await Promise.all([transaction.get(answerRef), transaction.get(allocationRef)]);
    const allocation = allocationSnapshot.data()?.reflectionIds || [];
    if (!answerSnapshot.exists() || allocation.includes(reflection.id) || allocation.length >= 3) return null;
    const next = [...allocation, reflection.id];
    transaction.update(answerRef, { voters: arrayUnion(bot.uid) });
    transaction.set(allocationRef, { uid: bot.uid, questionNumber: String(questionNumber), reflectionIds: next, updatedAt: serverTimestamp() });
    transaction.set(rewardRef, { authorUid: reflection.authorUid, voterUid: bot.uid, reflectionId: reflection.id, questionNumber: String(questionNumber), xp: 5, createdAt: serverTimestamp() });
    return { bonus: next.length === 3 };
  });
  if (!result) return false;
  hearted.add(reflection.id);
  bot.heartAllocations.set(questionNumber, hearted);
  await awardXp(target, 5, questionNumber);
  if (result.bonus) await awardXp(bot, 2, questionNumber);
  console.log(`${bot.name} gave a heart to ${target.name}.`);
  return true;
}

async function completeBoard(bot, requestedQuestionNumber) {
  const eventSnapshot = await getDocs(collection(bot.db, "missionEvent"));
  const event = eventSnapshot.docs.find((snapshot) => snapshot.id === EVENT_ID)?.data() || {};
  const available = [...bot.reflectionStatus.keys()].filter((number) => event.unlocked?.[number] && !bot.boardCompleted.has(number));
  if (!available.length) return false;
  const questionNumber = available.includes(requestedQuestionNumber) ? requestedQuestionNumber : randomItem(available);
  let attempts = 0;
  while ((bot.heartAllocations.get(questionNumber)?.size || 0) < 3 && attempts < 12) {
    await giveSimulationHeart(bot, questionNumber);
    attempts += 1;
  }
  if ((bot.heartAllocations.get(questionNumber)?.size || 0) < 3) return false;
  bot.boardCompleted.add(questionNumber);
  await setDoc(doc(bot.db, "missionParticipants", bot.uid), {
    boardCompleted: Object.fromEntries([...bot.boardCompleted].map((number) => [number, true])),
    activeMission: null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await setDoc(doc(bot.db, "leaderboardGroups", bot.room, "members", bot.uid), {
    boardCompleted: Object.fromEntries([...bot.boardCompleted].map((number) => [number, true])),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await awardXp(bot, 2, questionNumber);
  console.log(`${bot.name} viewed the reflection board for question ${questionNumber}.`);
  return true;
}

async function stopSimulation() {
  bots.forEach((bot) => (bot.timers || []).forEach((timer) => clearTimeout(timer)));
  await Promise.all(bots.map((bot) => deleteApp(bot.app)));
  console.log("SIMULATION_COMPLETE");
  writeStatus("complete");
}

function writeStatus(status, extra = {}) {
  writeFileSync(statusPath, JSON.stringify({
    status,
    participantsReady: bots.filter((bot) => bot.uid).length,
    simulatedGroups: groupPlans.map((group) => ({ code: group.code, participants: group.names.length })),
    reservedHumanSlot: "Assis-Sao-Jose",
    endsAt: new Date(runUntil).toISOString(),
    ...extra,
  }));
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
