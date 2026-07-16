import "@fontsource/fira-sans/latin-400.css";
import "@fontsource/fira-sans/latin-500.css";
import "@fontsource/fira-sans/latin-600.css";
import "@fontsource/fira-sans/latin-700.css";
import "@fontsource/fira-sans/latin-800.css";
import "./styles.css";
import officialContent from "./data/official-content.json";
import learningContent from "./data/learning-content.js";
import { GROUPS, displayNameForLeaderboard, groupByCode, normalizeGroup } from "./groups.js";
import { rankGroupSummaries, rankMembers } from "./leaderboard.js";
import { ACHIEVEMENTS, createProgressStore, readingReward } from "./progress.js";
import { createWordSearch, pathBetweenCells, simplifyPath, validateStroke } from "./wordsearch.js";
import { isSolved, moveTile, movableTileIndices, shuffleBoard, tileBackground } from "./image-shuffle.js";
import {
  ensureParticipantSession,
  claimRandomMission,
  completeSharedMission,
  finishPersonalMission,
  getGlobalReflections,
  getQuestionReflectionCounts,
  giveHeart,
  isFirebaseConfigured,
  participantUid,
  publishReflection,
  releaseActiveMission,
  renewMission,
  resetParticipantSession,
  skipSharedMission,
  subscribeToGlobalQuestion,
  subscribeToHeartRewards,
  subscribeToLeaderboards,
  subscribeToMissionGroup,
  subscribeToQuestionGroupTotal,
  syncLeaderboard,
} from "./firebase.js";

const app = document.querySelector("#app");
const params = new URLSearchParams(window.location.search);
const language = params.get("lang") === "en" ? "en" : "pt";
const gameLabId = params.get("lab");
const initialRoom = normalizeGroup(params.get("room") || "");
const youcatLoveLogo = new URL("./assets/brand/youcat-love-red.svg", import.meta.url).href;
const progress = createProgressStore();
const CONTENT_VERSION = 5;

const copy = {
  en: {
    home: "Home",
    welcomeTitle: "YOUCAT Assis",
    name: "Your name",
    namePlaceholder: "How should the group call you?",
    age: "Your age",
    room: "Group code",
    roomPlaceholder: "Choose your group",
    roomFromLink: "Your group is already connected",
    enter: "Enter",
    choose: "Choose a question",
    roomLabel: "Group",
    question: "Question",
    answers: "answers",
    allReflections: "All reflections",
    allReflectionsBody: "Answers from every group, gathered around this question.",
    globalEmpty: "No one has answered this question yet.",
    globalLoading: "Loading all answers…",
    loadMore: "Load more",
    openAllReflections: "Open all answers",
    completed: "answer shared",
    introHint: "Scroll up to begin",
    reader: "Reader",
    loveForever: "YOUCAT Love Forever",
    deepDive: "Deep Dive",
    games: "Four games",
    game: "Game",
    quiz: "One question to discuss",
    answer: "Personal reflection",
    answerBody: "Answer without sharing anything too personal.",
    answerPlaceholder: "Write your answer here…",
    submit: "Share anonymously",
    submitted: "Your anonymous reflection has been shared.",
    reflections: "Reflections from everyone",
    reflectionsBody: "No names or groups are shown. A heart gives the author +5 XP.",
    empty: "No one has answered this question yet.",
    loading: "Connecting to the group…",
    localMode: "Local preview: Firebase is not connected yet.",
    liveMode: "Live group feed",
    tryAgain: "Please try again.",
    correct: "Correct",
    incorrect: "Try once more",
    sequenceHelp: "Tap the steps in the right order.",
    matchHelp: "Tap one item on the left, then its match on the right.",
    wordSearchHelp: "Draw across each hidden word. You can retry exploratory strokes.",
    wordSearchTry: "That is not one of the hidden words. Try again.",
    wordSearchComplete: "All words found.",
    wordSearchAttempt: "Find every word to complete this team attempt. Exploratory strokes do not count against you.",
    imageShuffleHelp: "Move a piece next to the open space. Take your time—only the completed picture counts.",
    imageShuffleAttempt: "Move only neighbouring pieces into the open space. You can take as many moves as you need.",
    skipChallenge: "Skip this challenge",
    imageShuffleMoves: "moves",
    imageShuffleRestart: "Shuffle again",
    imageShuffleReference: "View picture",
    imageShuffleComplete: "Picture complete.",
    done: "Completed",
    of: "of",
    hearts: "hearts",
    ownAnswer: "your answer",
    xp: "XP",
    changeGroup: "Change group",
    continueAs: "Continue as",
    newPerson: "New person on this device",
    leaderboard: "Leaderboard",
    yourGroup: "Your group",
    eventGroups: "Event groups",
    practiceAgain: "Practice again",
    missedXp: "No XP this time",
    solution: "Correct solution",
    sound: "Reward sound",
    groupGoal: "Group goal",
    overview: "Overview",
    yourContribution: "Your contribution to the group",
    groupQuestionTotal: "Your group’s total for this question",
    nextQuestion: "Continue to the next question",
    backToQuestions: "Choose another question",
    anonymousReflection: "Anonymous reflection",
    nextChallenge: "Are you ready for the next challenge?",
    getChallenge: "Get a random challenge",
    waitingChallenge: "Your teammates are working on the available challenges. The next one will appear automatically.",
    teamProgress: "Team progress",
    challenge: "Team challenge",
    missionXp: "XP earned in this mission",
    declineReflection: "I prefer not to answer",
    notNow: "Not now",
    finishBoard: "Finish this reflection board",
    allComplete: "Your group has completed all challenges.",
    testMinigames: "Test minigames",
  },
  pt: {
    home: "Início",
    welcomeTitle: "YOUCAT Assis",
    name: "Seu nome",
    namePlaceholder: "Como o grupo deve chamar você?",
    age: "Sua idade",
    room: "Código do grupo",
    roomPlaceholder: "Escolha o seu grupo",
    roomFromLink: "Seu grupo já está conectado",
    enter: "Entrar",
    choose: "Escolha uma pergunta",
    roomLabel: "Grupo",
    question: "Pergunta",
    answers: "respostas",
    allReflections: "Todas as reflexões",
    allReflectionsBody: "Respostas de todos os grupos, reunidas em torno desta pergunta.",
    globalEmpty: "Ninguém respondeu a esta pergunta ainda.",
    globalLoading: "Carregando todas as respostas…",
    loadMore: "Carregar mais",
    openAllReflections: "Abrir todas as respostas",
    completed: "resposta compartilhada",
    introHint: "Role para cima e comece",
    reader: "Leitura",
    loveForever: "YOUCAT Love Forever",
    deepDive: "Aprofundamento",
    games: "Quatro jogos",
    game: "Jogo",
    quiz: "Uma pergunta para discutir",
    answer: "Reflexão pessoal",
    answerBody: "Responda sem contar nada íntimo demais.",
    answerPlaceholder: "Escreva sua resposta aqui…",
    submit: "Compartilhar anonimamente",
    submitted: "Sua reflexão anônima foi compartilhada.",
    reflections: "Reflexões de todos",
    reflectionsBody: "Nenhum nome ou grupo é exibido. Um coração dá +5 XP ao autor.",
    empty: "Ninguém respondeu a esta pergunta ainda.",
    loading: "Conectando ao grupo…",
    localMode: "Prévia local: o Firebase ainda não está conectado.",
    liveMode: "Mural do grupo ao vivo",
    tryAgain: "Tente novamente.",
    correct: "Correto",
    incorrect: "Tente mais uma vez",
    sequenceHelp: "Toque nas etapas na ordem certa.",
    matchHelp: "Toque em um item à esquerda e depois no correspondente à direita.",
    wordSearchHelp: "Desenhe uma linha sobre cada palavra escondida. Você pode tentar novamente.",
    wordSearchTry: "Essa não é uma das palavras escondidas. Tente novamente.",
    wordSearchComplete: "Todas as palavras foram encontradas.",
    wordSearchAttempt: "Encontre todas as palavras para concluir esta tentativa da equipe. Traços exploratórios não contam contra você.",
    imageShuffleHelp: "Mova uma peça ao lado do espaço vazio. Sem pressa — só a imagem completa conta.",
    imageShuffleAttempt: "Mova apenas peças vizinhas para o espaço vazio. Você pode fazer quantos movimentos precisar.",
    skipChallenge: "Pular este desafio",
    imageShuffleMoves: "movimentos",
    imageShuffleRestart: "Embaralhar novamente",
    imageShuffleReference: "Ver imagem",
    imageShuffleComplete: "Imagem completa.",
    done: "Concluído",
    of: "de",
    hearts: "corações",
    ownAnswer: "sua resposta",
    xp: "XP",
    changeGroup: "Mudar de grupo",
    continueAs: "Continuar como",
    newPerson: "Nova pessoa neste dispositivo",
    leaderboard: "Classificação",
    yourGroup: "Seu grupo",
    eventGroups: "Grupos do evento",
    practiceAgain: "Praticar novamente",
    missedXp: "Sem XP desta vez",
    solution: "Solução correta",
    sound: "Som das recompensas",
    groupGoal: "Meta do grupo",
    overview: "Visão geral",
    yourContribution: "Sua contribuição para o grupo",
    groupQuestionTotal: "Total do seu grupo nesta pergunta",
    nextQuestion: "Continuar para a próxima pergunta",
    backToQuestions: "Escolher outra pergunta",
    anonymousReflection: "Reflexão anônima",
    nextChallenge: "Você está pronto para o próximo desafio?",
    getChallenge: "Receber um desafio aleatório",
    waitingChallenge: "Seus companheiros estão trabalhando nos desafios disponíveis. O próximo aparecerá automaticamente.",
    teamProgress: "Progresso da equipe",
    challenge: "Desafio da equipe",
    missionXp: "XP conquistado nesta missão",
    declineReflection: "Prefiro não responder",
    notNow: "Agora não",
    finishBoard: "Concluir este mural de reflexões",
    allComplete: "Seu grupo concluiu todos os desafios.",
    testMinigames: "Testar minijogos",
  },
};

const topics = {
  3: t("Love that remains", "Amor que permanece"),
  14: t("Sex and self-gift", "Sexo e dom de si"),
  25: t("Spiritual direction", "Orientação espiritual"),
  34: t("Freedom in a sexualized world", "Liberdade num mundo erotizado"),
  59: t("Friendship and boundaries", "Amizade e limites"),
  68: t("Trust before marriage", "Confiança antes do matrimônio"),
  83: t("Cohabitation and commitment", "Coabitação e compromisso"),
  126: t("Lifelong fidelity", "Fidelidade por toda a vida"),
  127: t("Fidelity in serious crises", "Fidelidade nas crises graves"),
  140: t("When love changes", "Quando o amor muda"),
};

const questionIllustrations = {
  3: new URL("./assets/illustrations/questions/question-003-love-remains.png", import.meta.url).href,
  14: new URL("./assets/illustrations/questions/question-014-self-gift.png", import.meta.url).href,
  25: new URL("./assets/illustrations/questions/question-025-spiritual-direction.png", import.meta.url).href,
  34: new URL("./assets/illustrations/questions/question-034-freedom-from-images.png", import.meta.url).href,
  59: new URL("./assets/illustrations/questions/question-059-friendship.png", import.meta.url).href,
  68: new URL("./assets/illustrations/questions/question-068-trust-before-marriage.png", import.meta.url).href,
  83: new URL("./assets/illustrations/questions/question-083-commitment-foundation.png", import.meta.url).href,
  126: new URL("./assets/illustrations/questions/question-126-lifelong-fidelity.png", import.meta.url).href,
  127: new URL("./assets/illustrations/questions/question-127-fidelity-in-crisis.png", import.meta.url).href,
  140: new URL("./assets/illustrations/questions/question-140-love-matures.png", import.meta.url).href,
};

const gameIllustrations = {
  "25:0": new URL("./assets/illustrations/games/question-025-emmaus-guide.png", import.meta.url).href,
  "34:3": new URL("./assets/illustrations/games/question-034-freedom-plan.png", import.meta.url).href,
  "59:1": new URL("./assets/illustrations/games/question-059-transparent-friendship.png", import.meta.url).href,
  "68:3": new URL("./assets/illustrations/games/question-068-definitive-yes.png", import.meta.url).href,
  "83:0": new URL("./assets/illustrations/games/question-083-choosing-not-drifting.png", import.meta.url).href,
  "126:2": new URL("./assets/illustrations/games/question-126-prayer-fidelity.png", import.meta.url).href,
  "140:1": new URL("./assets/illustrations/games/question-140-mature-love.png", import.meta.url).href,
};

const achievementIllustrations = {
  "first-steps": new URL("./assets/illustrations/achievements/achievement-first-steps.png", import.meta.url).href,
  curious: new URL("./assets/illustrations/achievements/achievement-curious.png", import.meta.url).href,
  explorer: new URL("./assets/illustrations/achievements/achievement-explorer.png", import.meta.url).href,
  persevering: new URL("./assets/illustrations/achievements/achievement-persevering.png", import.meta.url).href,
};

const groupIllustrations = {
  "Assis-Sao-Jose": new URL("./assets/illustrations/groups/saint-sao-jose.png", import.meta.url).href,
  "Assis-Sao-Francisco": new URL("./assets/illustrations/groups/saint-sao-francisco.png", import.meta.url).href,
  "Assis-Santa-Clara": new URL("./assets/illustrations/groups/saint-santa-clara.png", import.meta.url).href,
  "Assis-Santo-Antonio": new URL("./assets/illustrations/groups/saint-santo-antonio.png", import.meta.url).href,
  "Assis-Sao-Joao-Paulo": new URL("./assets/illustrations/groups/saint-sao-joao-paulo-ii.png", import.meta.url).href,
  "Assis-Santa-Teresa-de-Calcuta": new URL("./assets/illustrations/groups/saint-santa-teresa-de-calcuta.png", import.meta.url).href,
  "Assis-Sao-Pedro": new URL("./assets/illustrations/groups/saint-sao-pedro.png", import.meta.url).href,
  "Assis-Sao-Paulo": new URL("./assets/illustrations/groups/saint-sao-paulo.png", import.meta.url).href,
  "Assis-Santa-Rita": new URL("./assets/illustrations/groups/saint-santa-rita.png", import.meta.url).href,
  "Assis-Sao-Bento": new URL("./assets/illustrations/groups/saint-sao-bento.png", import.meta.url).href,
  "Assis-Santa-Teresinha": new URL("./assets/illustrations/groups/saint-santa-teresinha.png", import.meta.url).href,
  "Assis-Sao-Joao-Bosco": new URL("./assets/illustrations/groups/saint-sao-joao-bosco.png", import.meta.url).href,
  "Assis-Santa-Faustina": new URL("./assets/illustrations/groups/saint-santa-faustina.png", import.meta.url).href,
  "Assis-Santo-Agostinho": new URL("./assets/illustrations/groups/saint-santo-agostinho.png", import.meta.url).href,
  "Assis-Santa-Monica": new URL("./assets/illustrations/groups/saint-santa-monica.png", import.meta.url).href,
  "Assis-Sao-Padre-Pio": new URL("./assets/illustrations/groups/saint-sao-padre-pio.png", import.meta.url).href,
  "Assis-Santa-Catarina": new URL("./assets/illustrations/groups/saint-santa-catarina-de-sena.png", import.meta.url).href,
  "Assis-Sao-Domingos": new URL("./assets/illustrations/groups/saint-sao-domingos.png", import.meta.url).href,
  "Assis-Santa-Gianna": new URL("./assets/illustrations/groups/saint-santa-gianna.png", import.meta.url).href,
  "Assis-Sao-Maximiliano-Kolbe": new URL("./assets/illustrations/groups/saint-sao-maximiliano-kolbe.png", import.meta.url).href,
};

function gameIllustration(number, gameIndex) {
  return gameIllustrations[`${number}:${gameIndex}`] || questionIllustrations[number];
}

const IMAGE_SHUFFLE_SIZE = 3;

function imageShuffleStateFor(gameState) {
  try {
    movableTileIndices(gameState.puzzleBoard, IMAGE_SHUFFLE_SIZE);
  } catch {
    gameState.puzzleBoard = shuffleBoard(IMAGE_SHUFFLE_SIZE);
    gameState.puzzleMoves = 0;
    gameState.puzzleStartedAt = Date.now();
    gameState.puzzleReference = false;
  }
  gameState.puzzleMoves = Number.isInteger(gameState.puzzleMoves) ? gameState.puzzleMoves : 0;
  gameState.puzzleReference = Boolean(gameState.puzzleReference);
  return gameState;
}

const officialByNumber = new Map(officialContent.questions.map((item) => [item.number, item]));
const learningByNumber = new Map(learningContent.map((item) => [item.number, item]));
const wordSearchCache = new Map();

function wordSearchFor(number, game, gameIndex) {
  const labels = game.words.map((word) => tr(word));
  const seed = `${game.seed || `assis-${number}-${gameIndex}`}:${language}`;
  const key = `${number}:${gameIndex}:${language}:${seed}:${labels.join("|")}`;
  if (!wordSearchCache.has(key)) {
    wordSearchCache.set(key, createWordSearch({
      words: labels,
      title: tr(game.title || game.prompt),
      locale: language,
      seed,
      target: "assis",
      id: `assis-${number}-${gameIndex}-${language}`,
    }));
  }
  return wordSearchCache.get(key);
}

function wordSearchPathPoints(points = []) {
  return points
    .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
    .map((point) => `${point.x * 100},${point.y * 100}`)
    .join(" ");
}

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

const sharedChallenges = learningContent.flatMap((item) => [
  { id: `${item.number}__quiz`, questionNumber: item.number, challengeKind: "quiz", challengeIndex: 0, xp: 10 },
  ...item.games.map((game, index) => ({ id: `${item.number}__game-${index}`, questionNumber: item.number, challengeKind: "game", challengeIndex: index, xp: gameXp(game) })),
]);
const questionNumbers = officialContent.questions.map((item) => item.number);

const state = {
  view: "welcome",
  profile: progress.profile(),
  room: initialRoom || progress.profile()?.room || GROUPS[0].code,
  currentQuestion: null,
  interactions: new Map(),
  reflections: new Map(),
  reflectionCounts: new Map(),
  globalReflections: [],
  globalCursor: null,
  globalHasMore: false,
  globalStatus: "idle",
  globalError: "",
  feedStatus: "idle",
  feedError: "",
  unsubscribe: null,
  questionTotalUnsubscribe: null,
  questionGroupTotal: 0,
  missionDashboardUnsubscribe: null,
  heartRewardsUnsubscribe: null,
  activeMission: null,
  completedMission: null,
  missionInteraction: null,
  missionStartXp: 0,
  missionGroupState: { challenges: {}, progress: {} },
  missionClaiming: false,
  missionWaitTimer: null,
  lastMissionActivity: Date.now(),
  missionRenewTimer: null,
  leaderboardUnsubscribe: null,
  leaderboardMembers: [],
  leaderboardContributions: [],
  leaderboardStatus: "idle",
  groupGoalCelebrated: false,
  readingCleanup: null,
  syncTimer: null,
  submitting: false,
  activeMinigameController: null,
};

function t(en, pt) {
  return { en, pt };
}

function tr(value) {
  if (typeof value === "string") return value;
  return value?.[language] ?? value?.pt ?? value?.en ?? "";
}

function c(key) {
  return copy[language][key];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shuffledChoiceOrder(count) {
  const order = Array.from({ length: count }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  // A shuffled answer list must never accidentally retain the authored order.
  if (count > 1 && order.every((value, index) => value === index)) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

function choiceOrderFor(gameState, key, count) {
  gameState.choiceOrders ||= {};
  const saved = gameState.choiceOrders[key];
  const valid = Array.isArray(saved)
    && saved.length === count
    && new Set(saved).size === count
    && saved.every((index) => Number.isInteger(index) && index >= 0 && index < count);
  if (valid) return saved;
  const order = shuffledChoiceOrder(count);
  gameState.choiceOrders[key] = order;
  return order;
}

function interactionFor(number) {
  if (!state.interactions.has(number)) {
    const learning = learningByNumber.get(number);
    const fresh = {
      contentVersion: CONTENT_VERSION,
      games: learning.games.map((game) => ({
        attempted: false,
        succeeded: false,
        practice: false,
        finished: false,
        selected: null,
        sequence: [],
        activeLeft: null,
        matched: [],
        foundWordIds: [],
        wordSearchStrokes: [],
        choiceOrders: {},
        start: game.start || [],
        message: "",
      })),
      quiz: learning.quiz.map(() => ({ selected: null, correct: false, attempted: false, practice: false, choiceOrders: {} })),
      answer: "",
      submitted: false,
    };
    const saved = progress.interaction(number);
    if (saved?.contentVersion === CONTENT_VERSION) {
      fresh.answer = saved.answer || "";
      fresh.submitted = Boolean(saved.submitted);
      fresh.games = fresh.games.map((item, index) => ({ ...item, ...(saved.games?.[index] || {}) }));
      fresh.quiz = fresh.quiz.map((item, index) => ({ ...item, ...(saved.quiz?.[index] || {}) }));
    }
    state.interactions.set(number, fresh);
  }
  return state.interactions.get(number);
}

function saveInteraction(number) {
  progress.saveInteraction(number, interactionFor(number));
}

function scheduleLeaderboardSync(previousRoom = "", immediate = false) {
  if (!state.profile) return;
  clearTimeout(state.syncTimer);
  state.syncTimer = setTimeout(async () => {
    try {
      await syncLeaderboard({
        profile: {
          ...state.profile,
          room: state.room,
          displayName: displayNameForLeaderboard(state.profile.name),
        },
        totalXp: progress.totalXp(),
        groupXp: progress.allGroupXp(),
        questionXp: progress.allGroupQuestionXp(),
        previousRoom,
      });
    } catch (error) {
      console.warn("Leaderboard sync will retry later", error);
    }
  }, immediate ? 0 : 10_000);
}

function playRewardSound() {
  if (!progress.soundEnabled()) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext();
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + index * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.08 + 0.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + index * 0.08);
      oscillator.stop(context.currentTime + index * 0.08 + 0.14);
    });
    setTimeout(() => context.close(), 500);
  } catch {}
}

function showReward(xp, unlocked = []) {
  document.querySelector(".reward-pop")?.remove();
  const pop = document.createElement("div");
  pop.className = "reward-pop";
  pop.setAttribute("role", "status");
  pop.innerHTML = `<span>+${xp} XP</span><i></i><i></i><i></i>`;
  document.body.append(pop);
  playRewardSound();
  setTimeout(() => pop.remove(), 1700);
  if (unlocked.length) setTimeout(() => showAchievement(unlocked[unlocked.length - 1]), 500);
}

function showAchievement(item) {
  const overlay = document.createElement("button");
  overlay.type = "button";
  overlay.className = "achievement-celebration";
  overlay.dataset.action = "dismiss-achievement";
  overlay.innerHTML = `<span>Conquista desbloqueada</span><img src="${achievementIllustrations[item.id]}" alt="" /><strong>${escapeHtml(item[language])}</strong><small>${item.xp} XP</small>`;
  document.body.append(overlay);
  progress.clearPendingAchievement();
  setTimeout(() => overlay.remove(), 3000);
}

function showGroupGoalCelebration() {
  if (state.groupGoalCelebrated) return;
  state.groupGoalCelebrated = true;
  const group = groupByCode(state.room);
  const overlay = document.createElement("button");
  overlay.type = "button";
  overlay.className = "achievement-celebration group-celebration";
  overlay.dataset.action = "dismiss-achievement";
  overlay.innerHTML = `<span>${c("groupGoal")}</span>${groupMark(group)}<strong>500 XP</strong><small>${escapeHtml(group.saint)}</small>`;
  document.body.append(overlay);
  playRewardSound();
  setTimeout(() => overlay.remove(), 3000);
}

function grantReward(id, xp, meta = {}) {
  const group = meta.groupCode || state.room;
  const result = progress.awardOnce(id, xp, group, meta);
  if (!result.awarded) return false;
  showReward(xp, result.unlocked);
  if (state.currentQuestion && Number(meta.question) === Number(state.currentQuestion)) {
    const personal = document.querySelector("[data-question-personal-xp]");
    if (personal) personal.textContent = `${questionXp(state.currentQuestion, state.room)} XP`;
    if (!isFirebaseConfigured()) {
      state.questionGroupTotal = progress.questionGroupXp(state.room, state.currentQuestion);
      const total = document.querySelector("[data-question-group-total]");
      if (total) total.textContent = `${state.questionGroupTotal} XP`;
    }
  }
  scheduleLeaderboardSync();
  return true;
}

function questionXp(number, group = null) {
  return Object.entries(progress.awards()).reduce((sum, [id, item]) => (
    (id.includes(`:${number}:`) || id.endsWith(`:${number}`)) && (!group || item.group === group) ? sum + item.xp : sum
  ), 0);
}

function renderAchievementShelf() {
  const total = progress.totalXp();
  return `<section class="achievement-shelf" aria-label="Conquistas">
    <div class="shelf-heading"><h2>Conquistas</h2><span>${total} XP</span></div>
    <div class="achievement-carousel">
      ${ACHIEVEMENTS.map((item, index) => {
        const unlocked = total >= item.xp;
        const illustration = achievementIllustrations[item.id];
        return `<article class="achievement-card ${unlocked ? "is-unlocked" : "is-locked"}">
          <img src="${illustration}" alt="" />
          <strong>${escapeHtml(item[language])}</strong><span>${item.xp} XP</span>
        </article>`;
      }).join("")}
    </div>
  </section>`;
}

function homeIcon() {
  return '<span class="home-sketch" aria-hidden="true"><span></span></span>';
}

function bottomNavigation(disabled = false) {
  return `
    <nav class="bottom-home" aria-label="${c("home")}">
      <button type="button" data-action="home" ${disabled ? "disabled" : ""} aria-label="${c("home")}">
        ${homeIcon()}
        <span>${c("home")}</span>
      </button>
    </nav>
  `;
}

function groupOptions(selected = state.room) {
  return GROUPS.map((group) => `<option value="${group.code}" ${group.code === selected ? "selected" : ""}>${escapeHtml(group.code)}</option>`).join("");
}

function groupMark(group, compact = false) {
  const illustration = groupIllustrations[group.code];
  return `<span class="group-mark ${compact ? "is-compact" : ""}" aria-hidden="true">${illustration ? `<img src="${illustration}" alt="" />` : `<span>${escapeHtml(group.saint.slice(0, 1))}</span><i>${escapeHtml(group.symbol)}</i>`}</span>`;
}

function renderReturning() {
  const profile = state.profile;
  const group = groupByCode(profile.room);
  app.innerHTML = `
    <main class="app-shell welcome-screen returning-screen">
      <section class="welcome-content">
        <div class="welcome-logo"><img src="${youcatLoveLogo}" alt="YOUCAT" /></div>
        ${groupMark(group)}
        <h1>${c("continueAs")} ${escapeHtml(profile.name)}?</h1>
        <p class="returning-group">${escapeHtml(profile.room)} · ${progress.totalXp()} XP</p>
        <button type="button" class="primary-action" data-action="continue-profile">${c("enter")}</button>
        <button type="button" class="secondary-action" data-action="change-group">${c("changeGroup")}</button>
        <button type="button" class="quiet-action" data-action="new-person">${c("newPerson")}</button>
      </section>
      ${bottomNavigation(true)}
    </main>
  `;
}

function renderWelcome() {
  app.innerHTML = `
    <main class="app-shell welcome-screen">
      <section class="welcome-content">
        <div class="welcome-logo">
          <img src="${youcatLoveLogo}" alt="YOUCAT" />
        </div>
        <h1>${c("welcomeTitle")}</h1>
        <form id="welcome-form" class="welcome-form">
          <label>
            <span>${c("name")}</span>
            <input name="name" type="text" autocomplete="name" maxlength="60" placeholder="${c("namePlaceholder")}" required />
          </label>
          <label>
            <span>${c("age")}</span>
            <input name="age" type="number" inputmode="numeric" min="18" max="120" value="24" required />
          </label>
          <label>
            <span>${c("room")}</span>
            <select name="room" required>${groupOptions(initialRoom || state.room)}</select>
            ${initialRoom ? `<small>${c("roomFromLink")}: <strong>${escapeHtml(initialRoom)}</strong></small>` : ""}
          </label>
          <button class="primary-action" type="submit">${c("enter")}</button>
          <p id="welcome-error" class="form-error" role="alert"></p>
        </form>
      </section>
      ${bottomNavigation(true)}
    </main>
  `;
}

function renderHome() {
  cleanupSubscription();
  cleanupLeaderboardSubscription();
  cleanupMissionDashboard();
  state.view = "home";
  state.currentQuestion = null;
  const cards = officialContent.questions.map((item, index) => {
    const official = item.official[language];
    const completed = Number(state.missionGroupState.progress?.[item.number] || 0);
    const ratio = Math.min(1, completed / 5);
    return `
      <article class="question-card" style="--card-index:${index}">
        <div class="question-card-main mission-question-card" aria-label="${escapeHtml(official.question)}">
          <img class="question-card-illustration" src="${questionIllustrations[item.number]}" alt="" />
          <span class="question-card-copy">
            <span class="question-card-meta">
              <span>${c("question")} ${item.number}</span>
            </span>
            <span class="question-card-title">${escapeHtml(tr(topics[item.number]))}</span>
            <span class="question-card-question">${escapeHtml(official.question)}</span>
          </span>
        </div>
        <div class="team-progress-ring" data-team-progress="${item.number}" style="--team-progress:${ratio}">
          <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"></circle><circle class="team-progress-value" cx="24" cy="24" r="20"></circle></svg>
          <strong>${completed}/5</strong><small>${c("teamProgress")}</small>
        </div>
      </article>
    `;
  }).join("");

  app.innerHTML = `
    <main class="app-shell home-screen">
      <header class="home-heading">
        <p class="brand-kicker">YOUCAT</p>
        <h1>${c("teamProgress")}</h1>
        <button type="button" class="room-chip" data-action="change-group">${c("roomLabel")} ${escapeHtml(state.room)}</button>
        <strong class="home-xp">${progress.totalXp()} XP</strong>
      </header>
      <section class="group-home-card">
        ${groupMark(groupByCode(state.room), true)}
        <div><span>${c("yourGroup")}</span><strong>${escapeHtml(groupByCode(state.room).saint)}</strong></div>
        <button type="button" data-action="open-leaderboard">${c("leaderboard")} →</button>
      </section>
      ${renderAchievementShelf()}
      <section class="mission-launch">
        <p>${language === "pt" ? "Cada missão é escolhida aleatoriamente entre os desafios ainda disponíveis." : "Each mission is chosen randomly from the challenges still available."}</p>
        <button type="button" class="primary-action" data-action="next-mission" ${state.missionClaiming ? "disabled" : ""}>${c("getChallenge")}</button>
        <p class="mission-waiting" role="status">${state.missionStatus === "waiting" ? c("waitingChallenge") : ""}</p>
      </section>
      <a class="minigame-lab-home-link" href="?lab=index&amp;lang=${language}">${c("testMinigames")} →</a>
      <section class="question-list" aria-label="${c("teamProgress")}">${cards}</section>
      ${bottomNavigation(false)}
    </main>
  `;
  window.scrollTo({ top: 0, behavior: "auto" });
  void connectMissionDashboard();
  clearTimeout(state.missionWaitTimer);
  if (state.missionStatus === "waiting") {
    state.missionWaitTimer = setTimeout(() => { void requestNextMission(); }, 15_000);
  }
  void import("./minigames/runtime.js")
    .then(({ preloadPhaserRuntimeAfterHome }) => preloadPhaserRuntimeAfterHome())
    .catch(() => {});
}

function cleanupMissionDashboard() {
  if (state.missionDashboardUnsubscribe) state.missionDashboardUnsubscribe();
  state.missionDashboardUnsubscribe = null;
  clearTimeout(state.missionWaitTimer);
  state.missionWaitTimer = null;
}

function cleanupHeartRewards() {
  if (state.heartRewardsUnsubscribe) state.heartRewardsUnsubscribe();
  state.heartRewardsUnsubscribe = null;
}

async function connectHeartRewards() {
  cleanupHeartRewards();
  const uid = participantUid();
  if (!uid || !isFirebaseConfigured()) return;
  state.heartRewardsUnsubscribe = await subscribeToHeartRewards(uid, (rewards) => {
    rewards.forEach((reward) => {
      grantReward(`heart-received:${reward.id}`, Number(reward.xp || 5), {
        type: "heart-received",
        question: Number(reward.questionNumber),
      });
    });
  }, () => {});
}

async function connectMissionDashboard() {
  cleanupMissionDashboard();
  state.missionDashboardUnsubscribe = await subscribeToMissionGroup(state.room, (group) => {
    state.missionGroupState = group;
    questionNumbers.forEach((number) => {
      const completed = Number(group.progress?.[number] || 0);
      const ring = document.querySelector(`[data-team-progress="${number}"]`);
      if (!ring) return;
      ring.style.setProperty("--team-progress", Math.min(1, completed / 5));
      const value = ring.querySelector("strong");
      if (value) value.textContent = `${completed}/5`;
    });
    if (state.view === "home" && state.missionStatus === "waiting") {
      const button = document.querySelector('[data-action="next-mission"]');
      if (button) button.disabled = false;
    }
  }, () => {});
}

async function refreshReflectionCounts() {
  const questionNumbers = officialContent.questions.map((item) => item.number);
  try {
    const counts = isFirebaseConfigured()
      ? await getQuestionReflectionCounts(questionNumbers)
      : new Map(questionNumbers.map((number) => [number, (state.reflections.get(number) || []).length]));
    state.reflectionCounts = counts;
    if (state.view !== "home") return;
    questionNumbers.forEach((number) => {
      const counter = document.querySelector(`[data-reflection-count="${number}"]`);
      if (counter) counter.textContent = String(counts.get(number) || 0);
    });
  } catch (error) {
    console.error("Unable to load reflection counts", error);
    if (state.view !== "home") return;
    document.querySelectorAll("[data-reflection-count]").forEach((counter) => { counter.textContent = "–"; });
  }
}

function cleanupLeaderboardSubscription() {
  if (state.leaderboardUnsubscribe) state.leaderboardUnsubscribe();
  state.leaderboardUnsubscribe = null;
}

function groupRankings() {
  return rankGroupSummaries(state.leaderboardContributions, 3);
}

function currentGroupTotal() {
  return Number(state.leaderboardContributions.find((item) => item.groupCode === state.room)?.totalXp || progress.groupXp(state.room));
}

async function connectLeaderboards(rerender = false) {
  cleanupLeaderboardSubscription();
  if (!isFirebaseConfigured()) {
    const local = {
      uid: participantUid() || "local",
      displayName: displayNameForLeaderboard(state.profile.name),
      groupCode: state.room,
      personalXp: progress.totalXp(),
      totalXp: progress.groupXp(state.room),
      participants: progress.groupXp(state.room) ? 1 : 0,
      averageXp: progress.groupXp(state.room),
      active: true,
    };
    state.leaderboardMembers = [local];
    state.leaderboardContributions = progress.totalXp() ? [local] : [];
    state.leaderboardStatus = "ready";
    if (rerender && state.view === "leaderboard") renderLeaderboard();
    if (rerender && state.view === "question" && state.completedMission) updateMissionGroupLeaderboard();
    return;
  }
  state.leaderboardStatus = "loading";
  try {
    state.leaderboardUnsubscribe = await subscribeToLeaderboards(state.room, ({ members, groups }) => {
      const previousTotal = currentGroupTotal();
      state.leaderboardMembers = rankMembers(members);
      state.leaderboardContributions = groups;
      if (previousTotal < 500 && currentGroupTotal() >= 500) showGroupGoalCelebration();
      state.leaderboardStatus = "ready";
      if (state.view === "leaderboard") renderLeaderboard(false);
      if (state.view === "question" && state.completedMission) updateMissionGroupLeaderboard();
    }, () => {
      state.leaderboardStatus = "error";
      if (state.view === "leaderboard") renderLeaderboard(false);
      if (state.view === "question" && state.completedMission) updateMissionGroupLeaderboard();
    });
  } catch {
    state.leaderboardStatus = "error";
  }
}

function renderLeaderboard(resetScroll = true) {
  state.view = "leaderboard";
  const groupTotal = currentGroupTotal();
  const members = state.leaderboardMembers;
  const groups = groupRankings();
  app.innerHTML = `
    <main class="app-shell leaderboard-screen">
      <header class="leaderboard-heading">
        <p class="brand-kicker">YOUCAT</p><h1>${c("leaderboard")}</h1>
        <div class="group-goal"><span>${c("groupGoal")}: ${Math.min(groupTotal, 500)}/500 XP</span><i style="--goal:${Math.min(100, groupTotal / 5)}%"></i></div>
      </header>
      <section class="ranking-section">
        <h2>${c("yourGroup")} · ${escapeHtml(state.room)}</h2>
        ${state.leaderboardStatus === "loading" ? `<p>${c("loading")}</p>` : ""}
        <ol class="ranking-list">${members.map((member, index) => `<li><b>${index + 1}</b><span>${escapeHtml(member.displayName)}</span><strong>${member.personalXp} XP</strong></li>`).join("") || `<li class="ranking-empty">Ainda não há XP neste grupo.</li>`}</ol>
      </section>
      <section class="ranking-section event-ranking">
        <h2>${c("eventGroups")}</h2>
        <p class="ranking-note">Média por participante ativo · mínimo de 3 participantes</p>
        <ol class="ranking-list">${groups.map((group, index) => `<li>${groupMark(groupByCode(group.code), true)}<b>${index + 1}</b><span>${escapeHtml(group.code)}</span><strong>${group.average.toFixed(1)} XP</strong></li>`).join("") || `<li class="ranking-empty">Os grupos aparecerão após três participantes ganharem XP.</li>`}</ol>
      </section>
      ${bottomNavigation(false)}
    </main>`;
  if (resetScroll) window.scrollTo({ top: 0, behavior: "auto" });
}

function renderGroupChooser() {
  state.view = "groups";
  app.innerHTML = `
    <main class="app-shell group-screen">
      <header class="group-heading"><p class="brand-kicker">YOUCAT</p><h1>${c("changeGroup")}</h1><p>Seu XP pessoal permanece com você.</p></header>
      <form id="group-form" class="group-grid">
        ${GROUPS.map((group) => `<label class="group-choice ${group.code === state.room ? "is-selected" : ""}">
          <input type="radio" name="room" value="${group.code}" ${group.code === state.room ? "checked" : ""} />
          ${groupMark(group)}<span><strong>${escapeHtml(group.saint)}</strong><small>${escapeHtml(group.code)}</small></span>
        </label>`).join("")}
        <label class="sound-setting"><input type="checkbox" name="sound" ${progress.soundEnabled() ? "checked" : ""} /><span>${c("sound")}</span></label>
        <button class="primary-action" type="submit">${c("enter")}</button>
      </form>
      ${bottomNavigation(false)}
    </main>`;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderGlobalOverview(number) {
  const official = officialByNumber.get(number).official[language];
  app.innerHTML = `
    <main class="app-shell global-screen">
      <header class="global-heading">
        <p class="section-kicker">${c("question")} ${number}</p>
        <img src="${questionIllustrations[number]}" alt="" />
        <h1>${c("allReflections")}</h1>
        <p>${escapeHtml(official.question)}</p>
        <span class="global-total">${state.reflectionCounts.get(number) ?? state.globalReflections.length} ${c("answers")}</span>
      </header>
      <section class="global-reflections" aria-live="polite">
        <p class="global-intro">${c("allReflectionsBody")}</p>
        <div id="global-reflections-list" class="reflections-list">${renderGlobalReflectionsList(number)}</div>
        ${state.globalStatus === "ready" && state.globalHasMore ? `<button type="button" class="secondary-action load-more" data-action="load-global-more" data-question="${number}">${c("loadMore")}</button>` : ""}
      </section>
      ${bottomNavigation(false)}
    </main>
  `;
  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderGlobalReflectionsList(number) {
  if (state.globalStatus === "loading" && !state.globalReflections.length) return `<p class="empty-state">${c("globalLoading")}</p>`;
  if (state.globalError) return `<p class="empty-state form-error">${escapeHtml(state.globalError)}</p>`;
  if (!state.globalReflections.length) return `<p class="empty-state">${c("globalEmpty")}</p>`;
  const sorted = [...state.globalReflections]
    .sort((a, b) => (b.voters?.length || 0) - (a.voters?.length || 0) || createdAt(b) - createdAt(a));
  return renderReflectionCards(sorted, number, true);
}

async function openGlobalOverview(number) {
  cleanupSubscription();
  state.view = "global";
  state.currentQuestion = number;
  state.globalReflections = [];
  state.globalCursor = null;
  state.globalHasMore = false;
  state.globalError = "";
  state.globalStatus = isFirebaseConfigured() ? "loading" : "ready";

  if (!isFirebaseConfigured()) {
    state.globalReflections = (state.reflections.get(number) || []).map((item) => ({ ...item, roomCode: item.roomCode || state.room }));
    state.globalHasMore = false;
    renderGlobalOverview(number);
    return;
  }

  renderGlobalOverview(number);
  await loadGlobalPage(number);
}

async function loadGlobalPage(number) {
  if (state.globalStatus === "loading" && state.globalReflections.length) return;
  state.globalStatus = "loading";
  state.globalError = "";
  try {
    const page = await getGlobalReflections(number, { after: state.globalCursor, pageSize: 50 });
    const seen = new Set(state.globalReflections.map((item) => item.id));
    state.globalReflections.push(...page.reflections.filter((item) => !seen.has(item.id)));
    state.globalCursor = page.cursor;
    state.globalHasMore = page.hasMore;
    state.globalStatus = "ready";
  } catch (error) {
    console.error("Unable to load global reflections", error);
    state.globalStatus = "error";
    state.globalError = c("tryAgain");
  }
  if (state.view === "global" && state.currentQuestion === number) renderGlobalOverview(number);
}

function reflectionXp(length) {
  if (length < 1) return 0;
  if (length < 50) return 3;
  if (length < 100) return 5;
  if (length < 200) return 7;
  return 10;
}

function renderQuestion(number, positions = null) {
  const mission = state.activeMission || state.completedMission;
  if (!mission) return renderHome();
  state.view = "question";
  state.currentQuestion = number;
  const official = officialByNumber.get(number).official[language];
  const learning = learningByNumber.get(number);
  const finished = Boolean(state.completedMission);
  app.innerHTML = `<main class="app-shell question-screen"><div id="question-feed" class="question-feed">
    <section class="feed-section intro-section" data-section="intro"><div class="section-inner">
      <p class="section-kicker">YOUCAT Love Forever ${number}</p><div class="intro-illustration"><img src="${questionIllustrations[number]}" alt="" /></div>
      <h1>${escapeHtml(official.question)}</h1><div class="topic-marker">${escapeHtml(tr(topics[number]))}</div>
      <p class="scroll-hint">${c("introHint")} <span aria-hidden="true">↓</span></p>
    </div></section>
    <section class="feed-section" data-section="reader"><div class="section-inner section-with-carousel"><p class="section-kicker">1 · ${c("reader")}</p>${renderReaderCarousel(number, official, learning)}</div></section>
    ${renderMissionElement(mission, learning, finished)}
    ${finished ? renderMissionOverview() : ""}
  </div>${bottomNavigation(false)}</main>`;
  bindCarouselState();
  bindWordSearchBoards();
  bindReadingTimers();
  bindMissionLease();
  restorePositions(positions);
}

function renderMissionElement(mission, learning, finished) {
  if (mission.type === "reflection") {
    const interaction = interactionFor(mission.questionNumber);
    const xp = reflectionXp(interaction.answer.trim().length);
    return `<section class="feed-section answer-section" data-section="reflection"><div class="section-inner">
      <p class="section-kicker">2 · ${c("answer")}</p><h2>${escapeHtml(tr(learning.reflectionPrompt))}</h2><p>${c("answerBody")}</p>
      <form id="answer-form" class="answer-form"><textarea name="answer" maxlength="300" placeholder="${c("answerPlaceholder")}" ${finished ? "disabled" : ""}>${escapeHtml(interaction.answer)}</textarea>
        <div class="answer-form-foot"><span id="answer-count">${interaction.answer.length}/300 · +${xp} XP</span><button class="primary-action" type="submit" ${finished || state.submitting ? "disabled" : ""}>${c("submit")}</button></div>
        <div class="reflection-skip-actions"><button type="button" class="quiet-action" data-action="reflection-decline" ${finished ? "disabled" : ""}>${c("declineReflection")}</button></div>
        <p id="answer-message" class="form-note" role="status"></p>
      </form></div></section>`;
  }
  if (mission.type === "board") {
    const reflections = state.reflections.get(mission.questionNumber) || [];
    const uid = participantUid();
    const heartsGiven = reflections.filter((item) => (item.voters || []).includes(uid)).length;
    return `<section class="feed-section reflections-section" data-section="board"><div class="section-inner reflections-inner">
      <p class="section-kicker">2 · ${c("reflections")}</p><h2>${c("reflections")}</h2><p>${c("reflectionsBody")}</p>
      <div class="board-heart-counter">♡ ${heartsGiven}/3</div><div class="feed-mode is-live">${c("liveMode")}</div><div id="reflections-list" class="reflections-list" aria-live="polite">${renderReflectionsList(mission.questionNumber)}</div>
      <button type="button" class="primary-action finish-board-action" data-action="finish-board" ${finished ? "disabled" : ""}>${c("finishBoard")}</button>
    </div></section>`;
  }
  if (mission.challengeKind === "quiz") {
    return `<section class="feed-section" data-section="challenge"><div class="section-inner section-with-carousel"><p class="section-kicker">2 · ${c("challenge")} · ${mission.xp} XP</p>${renderMissionQuiz(mission, learning.quiz[0])}</div></section>`;
  }
  const game = learning.games[mission.challengeIndex];
  const attemptNote = game.type === "wordsearch" ? c("wordSearchAttempt") : game.type === "image-shuffle" ? c("imageShuffleAttempt") : "";
  const attemptNoteMarkup = attemptNote ? `<p class="one-attempt-note">${attemptNote}</p>` : "";
  if (game.type === "minigame") {
    const label = language === "pt" ? "Abrir jogo" : "Open game";
    const support = language === "pt"
      ? "O progresso é salvo se você sair antes de verificar. Verificar envia a única tentativa da missão."
      : "Progress is saved if you leave before Check. Check submits the mission’s single attempt.";
    const result = finished
      ? `<div class="answer-explanation ${state.missionInteraction.currentCorrect ? "is-correct" : "is-wrong"}"><strong>${state.missionInteraction.currentCorrect ? `✓ ${c("correct")}` : `× ${c("missedXp")}`}</strong>${game.insight ? `<p>${escapeHtml(tr(game.insight))}</p>` : ""}</div>`
      : `<p class="game-help">${support}</p><button type="button" class="primary-action minigame-launch-action" data-action="launch-minigame">${label}</button>`;
    return `<section class="feed-section" data-section="challenge"><div class="section-inner section-with-carousel"><p class="section-kicker">2 · ${c("challenge")} · ${mission.xp} XP</p>${attemptNoteMarkup}<article class="carousel-panel game-panel mission-game-panel"><h2>${escapeHtml(tr(game.title || game.prompt))}</h2>${game.title ? `<p class="game-prompt">${escapeHtml(tr(game.prompt))}</p>` : ""}${result}</article></div></section>`;
  }
  const skipAction = game.type === "image-shuffle" && !finished
    ? `<button type="button" class="quiet-action skip-challenge-action" data-action="skip-challenge">${c("skipChallenge")}</button>`
    : "";
  return `<section class="feed-section" data-section="challenge"><div class="section-inner section-with-carousel"><p class="section-kicker">2 · ${c("challenge")} · ${mission.xp} XP</p>${attemptNoteMarkup}<article class="carousel-panel game-panel mission-game-panel"><h2>${escapeHtml(tr(game.title || game.prompt))}</h2>${game.title ? `<p class="game-prompt">${escapeHtml(tr(game.prompt))}</p>` : ""}${renderGame(mission.questionNumber, game, mission.challengeIndex, state.missionInteraction)}${skipAction}</article></div></section>`;
}

function renderMissionQuiz(mission, item) {
  const quizState = state.missionInteraction;
  const optionOrder = choiceOrderFor(quizState, "quiz-options", item.options.length);
  return `<article class="carousel-panel quiz-panel mission-quiz-panel"><h2>${escapeHtml(tr(item.prompt))}</h2><div class="choice-board">
    ${optionOrder.map((index) => `<button type="button" class="choice-option ${quizState.selected === index ? (index === item.correct ? "is-correct" : "is-wrong") : ""} ${quizState.selected !== null && index === item.correct ? "is-correct-solution" : ""}" data-action="mission-quiz-choice" data-option="${index}" ${quizState.attempted ? "disabled" : ""}>${escapeHtml(tr(item.options[index]))}</button>`).join("")}</div>
    ${quizState.selected === null ? "" : `<div class="answer-explanation ${quizState.currentCorrect ? "is-correct" : "is-wrong"}"><strong>${quizState.currentCorrect ? `✓ ${c("correct")}` : `× ${c("missedXp")}`}</strong><p>${escapeHtml(tr(item.feedback))}</p><p>${c("solution")}: ${escapeHtml(tr(item.options[item.correct]))}</p></div>`}</article>`;
}

function renderMissionGroupLeaderboard() {
  if (state.leaderboardStatus === "loading" || state.leaderboardStatus === "idle") return `<p class="ranking-note">${c("loading")}</p>`;
  return `<ol class="ranking-list">${state.leaderboardMembers.map((member, index) => `<li><b>${index + 1}</b><span>${escapeHtml(member.displayName)}</span><strong>${member.personalXp} XP</strong></li>`).join("") || `<li class="ranking-empty">Ainda não há XP neste grupo.</li>`}</ol>`;
}

function updateMissionGroupLeaderboard() {
  const leaderboard = document.querySelector("[data-mission-group-leaderboard]");
  if (leaderboard) leaderboard.innerHTML = renderMissionGroupLeaderboard();
}

function renderMissionOverview() {
  const group = groupByCode(state.room);
  return `<section class="feed-section overview-section mission-leaderboard-section" data-section="overview"><div class="section-inner overview-inner"><p class="section-kicker">3 · ${c("leaderboard")}</p><h2>${c("yourGroup")}</h2>
    <div class="mission-group-identity">${groupMark(group)}<div><strong>${escapeHtml(state.room)}</strong><span>${escapeHtml(group.saint)}</span></div></div>
    <div class="mission-group-leaderboard" data-mission-group-leaderboard>${renderMissionGroupLeaderboard()}</div>
    <button type="button" class="primary-action next-question-action" data-action="next-mission">${c("nextChallenge")}</button>
  </div></section>`;
}

function freshMissionInteraction() {
  return { attempted: false, succeeded: false, finished: false, selected: null, sequence: [], activeLeft: null, matched: [], foundWordIds: [], wordSearchStrokes: [], choiceOrders: {}, currentCorrect: null, message: "" };
}

function missionStorageKey(mission) {
  return `mission-v2:${mission.groupCode}:${mission.id}`;
}

function loadMissionInteraction(mission) {
  return { ...freshMissionInteraction(), ...(progress.interaction(missionStorageKey(mission)) || {}) };
}

function saveMissionInteraction() {
  if (state.activeMission && state.missionInteraction) progress.saveInteraction(missionStorageKey(state.activeMission), state.missionInteraction);
}

async function requestNextMission(excludeMissionId = "") {
  if (state.missionClaiming) return;
  state.missionClaiming = true;
  state.missionStatus = "loading";
  try {
    const mission = await claimRandomMission({ roomCode: state.room, sharedChallenges, questions: questionNumbers, excludeMissionId });
    if (mission?.type === "complete") {
      state.missionStatus = "complete";
      showJourneyComplete();
      return;
    }
    if (!mission) {
      state.missionStatus = "waiting";
      renderHome();
      return;
    }
    await startMission(mission);
  } catch (error) {
    console.error("Unable to assign mission", error);
    state.missionStatus = "waiting";
    renderHome();
  } finally {
    state.missionClaiming = false;
  }
}

function showJourneyComplete() {
  const overlay = document.createElement("button");
  overlay.type = "button";
  overlay.className = "achievement-celebration group-celebration";
  overlay.dataset.action = "open-leaderboard";
  overlay.innerHTML = `${groupMark(groupByCode(state.room))}<strong>${c("allComplete")}</strong><small>${c("leaderboard")} →</small>`;
  document.body.append(overlay);
  playRewardSound();
  setTimeout(() => { if (overlay.isConnected) { overlay.remove(); renderLeaderboard(); void connectLeaderboards(true); } }, 3500);
}

async function startMission(mission) {
  cleanupMissionDashboard();
  cleanupSubscription();
  state.activeMission = mission;
  state.completedMission = null;
  state.missionStartXp = progress.totalXp();
  state.missionInteraction = mission.type === "shared" ? loadMissionInteraction(mission) : null;
  state.feedStatus = mission.type === "board" && isFirebaseConfigured() ? "loading" : "ready";
  state.feedError = "";
  state.questionGroupTotal = progress.questionGroupXp(state.room, mission.questionNumber);
  renderQuestion(mission.questionNumber);
  if (isFirebaseConfigured()) {
    state.questionTotalUnsubscribe = await subscribeToQuestionGroupTotal(state.room, mission.questionNumber, (total) => {
      state.questionGroupTotal = total;
      const value = document.querySelector("[data-question-group-total]");
      if (value) value.textContent = `${total} XP`;
    }, () => {});
  }
  if (mission.type === "board") {
    state.unsubscribe = await subscribeToGlobalQuestion(mission.questionNumber, (reflections) => {
      state.reflections.set(mission.questionNumber, reflections);
      state.feedStatus = "ready";
      updateReflections(mission.questionNumber);
    }, () => {
      state.feedStatus = "error";
      state.feedError = c("tryAgain");
      updateReflections(mission.questionNumber);
    });
  }
}

function bindMissionLease() {
  clearInterval(state.missionRenewTimer);
  if (!state.activeMission) return;
  state.lastMissionActivity = Date.now();
  state.missionRenewTimer = setInterval(async () => {
    if (!state.activeMission || document.visibilityState !== "visible") return;
    if (Date.now() - state.lastMissionActivity >= 5 * 60 * 1000) return;
    try {
      const renewed = await renewMission(state.activeMission);
      if (renewed) state.activeMission = renewed;
    } catch {}
  }, 60_000);
}

function noteMissionActivity() {
  if (state.activeMission) state.lastMissionActivity = Date.now();
}

async function completeTeamAttempt(correct, { render = true, positions = capturePositions() } = {}) {
  const mission = state.activeMission;
  if (!mission || mission.type !== "shared") return;
  const xp = correct ? mission.xp : 0;
  try {
    await completeSharedMission({ mission, correct, xpAwarded: xp });
    if (xp) grantReward(`team:${mission.groupCode}:${mission.id}`, xp, { type: "team-challenge", question: mission.questionNumber });
    saveMissionInteraction();
    state.completedMission = mission;
    state.activeMission = null;
    clearInterval(state.missionRenewTimer);
    if (!render) return;
    renderQuestion(mission.questionNumber, positions);
    void connectLeaderboards(true);
    // Leave the result in view first. The overview is already available below for
    // anyone who wants to continue immediately, then opens itself after feedback.
    setTimeout(() => {
      if (state.completedMission?.id === mission.id && state.view === "question") {
        document.querySelector('[data-section="overview"]')?.scrollIntoView({ behavior: "smooth" });
      }
    }, 3000);
  } catch (error) {
    console.error("Unable to complete team challenge", error);
    state.missionInteraction = loadMissionInteraction(mission);
    renderQuestion(mission.questionNumber, positions);
  }
}

async function finishReflectionMission(status) {
  const mission = state.activeMission;
  if (!mission || mission.type !== "reflection") return;
  await finishPersonalMission({ mission, reflectionStatus: status });
  state.completedMission = mission;
  state.activeMission = null;
  clearInterval(state.missionRenewTimer);
  renderQuestion(mission.questionNumber);
  void connectLeaderboards(true);
  requestAnimationFrame(() => document.querySelector('[data-section="overview"]')?.scrollIntoView({ behavior: "smooth" }));
}

async function finishBoardMission() {
  const mission = state.activeMission;
  if (!mission || mission.type !== "board") return;
  await finishPersonalMission({ mission });
  state.completedMission = mission;
  state.activeMission = null;
  clearInterval(state.missionRenewTimer);
  renderQuestion(mission.questionNumber);
  void connectLeaderboards(true);
  requestAnimationFrame(() => document.querySelector('[data-section="overview"]')?.scrollIntoView({ behavior: "smooth" }));
}

function renderReaderCarousel(number, official, learning) {
  const loveReadingId = `read:${number}:0`;
  const panels = [
    `
      <article class="carousel-panel reader-panel" ${readingAttributes(loveReadingId, `${official.question} ${official.answer}`)}>
        <div class="panel-label">${c("loveForever")} · ${number}</div>
        ${renderReadingRing(loveReadingId, `${official.question} ${official.answer}`)}
        <h2>${escapeHtml(official.question)}</h2>
        <div class="panel-scroll source-text official-text" data-reading-scroll>${renderParagraphs(official.answer, { initial: true })}</div>
      </article>
    `,
    ...learning.deepDive.map((deepDive, index) => {
      const id = `read:${number}:${index + 1}`;
      const text = `${tr(deepDive.question || "")} ${tr(deepDive.body)}`;
      return `
      <article class="carousel-panel reader-panel deep-dive-panel" ${readingAttributes(id, text)}>
        <div class="panel-label">${c("deepDive")} ${index + 1}</div>
        ${renderReadingRing(id, text)}
        <p class="source-line">${escapeHtml(deepDive.source)}</p>
        <h2 class="source-document-title ${sourceTitleClass(deepDive.source)}">${escapeHtml(tr(deepDive.title))}</h2>
        <div class="panel-scroll source-text official-text" data-reading-scroll>
          ${deepDive.question ? `<h3 class="source-question">${escapeHtml(tr(deepDive.question))}</h3>` : ""}
          ${renderParagraphs(tr(deepDive.body), { initial: true, stripLeadingNumber: true })}
        </div>
      </article>
    `}),
  ];
  return carousel("reader-carousel", panels, `${c("reader")} ${number}`);
}

function readingAttributes(id, text) {
  const reward = readingReward(text);
  return `data-reading-id="${id}" data-reading-xp="${reward.xp}" data-reading-ms="${reward.requiredMs}"`;
}

function renderReadingRing(id, text) {
  const reward = readingReward(text);
  const reading = progress.reading(id);
  const awarded = progress.hasAward(id);
  const ratio = awarded ? 1 : Math.min(1, reading.elapsedMs / reward.requiredMs);
  return `<div class="reading-reward ${awarded ? "is-earned" : ""}" data-reading-ring="${id}" style="--reading-progress:${ratio}">
    <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19"></circle><circle class="reading-progress" cx="22" cy="22" r="19"></circle></svg>
    <strong>${awarded ? "✓" : reward.xp}</strong><small>${awarded ? "XP" : "XP"}</small>
  </div>`;
}

function sourceTitleClass(source) {
  if (/^YOUCAT\b/.test(source)) return "is-youcat";
  if (/^DOCAT\b/.test(source)) return "is-docat";
  return "is-magisterium";
}

function renderParagraphs(text, { initial = false, stripLeadingNumber = false } = {}) {
  return String(text)
    .split(/\n{2,}/)
    .map((paragraph, index) => {
      const displayText = stripLeadingNumber ? stripReferenceNumber(paragraph) : paragraph.trim();
      if (!initial || index !== 0) return `<p>${escapeHtml(displayText)}</p>`;
      const firstLetter = displayText.match(/\p{L}/u);
      if (!firstLetter) return `<p>${escapeHtml(displayText)}</p>`;
      const letterIndex = firstLetter.index;
      return `<p class="has-initial">${escapeHtml(displayText.slice(0, letterIndex))}<span class="source-initial">${escapeHtml(firstLetter[0])}</span>${escapeHtml(displayText.slice(letterIndex + firstLetter[0].length))}</p>`;
    })
    .join("");
}

function stripReferenceNumber(text) {
  return String(text)
    .trim()
    .replace(/^(?:Cân\.\s*)?\d+(?:[–-]\d+)?\s*(?:[.—-]\s*)?/u, "")
    .trim();
}

function renderGamesCarousel(number, learning, interaction) {
  const panels = learning.games.map((game, index) => `
    <article class="carousel-panel game-panel">
      <div class="panel-label">${c("game")} ${index + 1} <span class="panel-xp">+3 XP</span> ${interaction.games[index].attempted ? `<span class="done-label ${interaction.games[index].succeeded ? "" : "is-missed"}">${interaction.games[index].succeeded ? "✓ +3 XP" : `× ${c("missedXp")}`}</span>` : ""}</div>
      <h2>${escapeHtml(tr(game.title || game.prompt))}</h2>
      ${game.title ? `<p class="game-prompt">${escapeHtml(tr(game.prompt))}</p>` : ""}
      ${renderGame(number, game, index, interaction.games[index])}
    </article>
  `);
  return carousel("games-carousel", panels, `${c("games")} ${number}`);
}

function renderGame(number, game, gameIndex, gameState) {
  const disabled = gameState.attempted || gameState.finished;
  if (game.type === "minigame") {
    const active = state.activeMission?.type === "shared"
      && state.activeMission.questionNumber === number
      && state.activeMission.challengeKind === "game"
      && state.activeMission.challengeIndex === gameIndex;
    if (disabled) return gameMessage(gameState, game);
    const help = language === "pt" ? "Abra o jogo quando esta atividade for a missão da equipe." : "Open the game when this activity is the team mission.";
    return `<div class="minigame-mission-launch"><p>${help}</p><button type="button" class="primary-action" data-action="launch-minigame" ${active ? "" : "disabled"}>${language === "pt" ? "Abrir jogo" : "Open game"}</button></div>`;
  }
  if (["sequence", "order"].includes(game.type)) {
    const displayItems = (game.start || game.items.map((item) => item.id)).map((id) => game.items.find((item) => item.id === id));
    return `<p class="game-help">${c("sequenceHelp")}</p><div class="sequence-board">
      ${displayItems.map((item) => {
        const selectedIndex = gameState.sequence.indexOf(item.id);
        return `<button type="button" data-action="sequence" data-question="${number}" data-game="${gameIndex}" data-item="${item.id}" class="game-token ${selectedIndex >= 0 ? "is-selected" : ""}" ${disabled ? "disabled" : ""}>${selectedIndex >= 0 ? `<span class="token-order">${selectedIndex + 1}</span>` : ""}${escapeHtml(tr(item.label))}</button>`;
      }).join("")}</div>${gameMessage(gameState, game)}`;
  }

  if (game.type === "match") {
    const rightOrder = choiceOrderFor(gameState, "match-right", game.pairs.length);
    return `<p class="game-help">${c("matchHelp")}</p><div class="match-board"><div class="match-column">
      ${game.pairs.map((pair, index) => `<button type="button" class="game-token ${gameState.activeLeft === index ? "is-active" : ""} ${gameState.matched.includes(index) ? "is-matched" : ""}" data-action="match-left" data-question="${number}" data-game="${gameIndex}" data-pair="${index}" ${disabled || gameState.matched.includes(index) ? "disabled" : ""}>${escapeHtml(tr(pair[0]))}</button>`).join("")}
      </div><div class="match-column">${rightOrder.map((index) => `<button type="button" class="game-token ${gameState.matched.includes(index) ? "is-matched" : ""}" data-action="match-right" data-question="${number}" data-game="${gameIndex}" data-pair="${index}" ${disabled || gameState.matched.includes(index) ? "disabled" : ""}>${escapeHtml(tr(game.pairs[index][1]))}</button>`).join("")}</div></div>${gameMessage(gameState, game)}`;
  }

  if (game.type === "reveal") {
    const cardIndex = gameState.sequence.length;
    const card = game.cards[Math.min(cardIndex, game.cards.length - 1)];
    const optionOrder = choiceOrderFor(gameState, `reveal-${cardIndex}`, game.categories.length);
    const progress = game.cards.length > 1 ? `<div class="reveal-progress">${Math.min(cardIndex + 1, game.cards.length)} ${c("of")} ${game.cards.length}</div>` : "";
    return `${progress}<div class="reveal-card">${escapeHtml(tr(card.text))}</div><div class="choice-board compact-choice-board">
      ${optionOrder.map((index) => `<button type="button" class="choice-option" data-action="reveal-choice" data-question="${number}" data-game="${gameIndex}" data-option="${index}" ${disabled ? "disabled" : ""}>${escapeHtml(tr(game.categories[index]))}</button>`).join("")}</div>${gameMessage(gameState, game)}`;
  }

  if (game.type === "image-shuffle") {
    const puzzleState = imageShuffleStateFor(gameState);
    const board = puzzleState.puzzleBoard;
    const movable = new Set(movableTileIndices(board, IMAGE_SHUFFLE_SIZE));
    const illustration = gameIllustration(number, gameIndex);
    const solved = gameState.finished && isSolved(board, IMAGE_SHUFFLE_SIZE);
    const title = tr(game.title || game.prompt);
    const piece = language === "pt" ? "Peça" : "Piece";
    const movableText = language === "pt" ? "pode mover" : "movable";
    const fixedText = language === "pt" ? "não pode mover" : "not movable";
    return `<p class="game-help" id="image-shuffle-help-${number}-${gameIndex}">${c("imageShuffleHelp")}</p>
      <div class="image-shuffle-game">
        <div class="image-shuffle-meta"><span>3 × 3</span><span>${puzzleState.puzzleMoves} ${c("imageShuffleMoves")}</span><button type="button" class="image-shuffle-reference-action" data-action="image-shuffle-reference">${c("imageShuffleReference")}</button></div>
        ${puzzleState.puzzleReference ? `<img class="image-shuffle-reference" src="${illustration}" alt="${escapeHtml(title)}" />` : ""}
        <div class="image-shuffle-board ${solved ? "is-solved" : ""}" role="grid" aria-label="${escapeHtml(`${title}, 3 by 3 image puzzle`)}" aria-describedby="image-shuffle-help-${number}-${gameIndex}">
          ${board.map((tile, index) => {
            if (tile === 0) return `<div class="image-shuffle-empty" role="gridcell" aria-label="${language === "pt" ? "Espaço vazio" : "Empty space"}" style="--tile-image:url('${illustration}')"></div>`;
            const background = tileBackground(tile, IMAGE_SHUFFLE_SIZE);
            const canMove = movable.has(index) && !solved;
            return `<button type="button" role="gridcell" class="image-shuffle-tile" data-action="image-shuffle-tile" data-cell="${index}" aria-label="${escapeHtml(`${piece} ${tile}; ${canMove ? movableText : fixedText}`)}" style="--tile-image:url('${illustration}');--tile-size:${background.backgroundSize};--tile-position:${background.backgroundPosition}" ${canMove ? "" : "disabled"}><span aria-hidden="true"></span></button>`;
          }).join("")}
        </div>
        <button type="button" class="quiet-action image-shuffle-restart" data-action="image-shuffle-restart" ${solved ? "disabled" : ""}>↺ ${c("imageShuffleRestart")}</button>
        <p class="image-shuffle-status" aria-live="polite">${solved ? c("imageShuffleComplete") : ""}</p>
      </div>${gameMessage(gameState, game)}`;
  }

  if (game.type === "wordsearch") {
    const puzzle = wordSearchFor(number, game, gameIndex);
    const foundWordIds = gameState.foundWordIds || [];
    const strokes = gameState.wordSearchStrokes || [];
    const helpId = `wordsearch-help-${number}-${gameIndex}`;
    return `<p class="game-help" id="${helpId}">${c("wordSearchHelp")}</p><div class="wordsearch-game" data-wordsearch data-question="${number}" data-game="${gameIndex}" data-disabled="${disabled}">
      <p class="wordsearch-progress">${foundWordIds.length}/${puzzle.words.length}</p>
      <div class="wordsearch-board" data-wordsearch-board aria-describedby="${helpId}">
        <svg class="wordsearch-strokes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          ${strokes.map((stroke) => `<polyline class="wordsearch-stroke" points="${wordSearchPathPoints(stroke.points)}"></polyline>`).join("")}
          <polyline class="wordsearch-stroke wordsearch-live-stroke" points=""></polyline>
        </svg>
        <div class="wordsearch-grid" role="grid" aria-label="${escapeHtml(tr(game.title || game.prompt))}" style="grid-template-columns:repeat(${puzzle.size},minmax(0,1fr))">
          ${puzzle.grid.flatMap((row, rowIndex) => row.map((letter, colIndex) => {
            const cellIndex = rowIndex * puzzle.size + colIndex;
            return `<button type="button" class="wordsearch-cell" role="gridcell" data-wordsearch-cell="${cellIndex}" tabindex="${cellIndex === 0 ? 0 : -1}" aria-label="${escapeHtml(`${letter}, ${rowIndex + 1}, ${colIndex + 1}`)}" ${disabled ? "disabled" : ""}>${escapeHtml(letter)}</button>`;
          })).join("")}
        </div>
      </div>
      <ul class="wordsearch-words">${puzzle.words.map((word) => `<li class="${foundWordIds.includes(word.id) ? "is-found" : ""}">${escapeHtml(word.label)}</li>`).join("")}</ul>
      <p class="wordsearch-status ${gameState.finished ? "is-complete" : ""}" data-wordsearch-status aria-live="polite">${gameState.finished ? c("wordSearchComplete") : ""}</p>
    </div>${gameMessage(gameState, game)}`;
  }

  if (game.type === "crossword") {
    const clueIndex = gameState.sequence.length;
    const clue = game.clues[Math.min(clueIndex, game.clues.length - 1)];
    const optionOrder = choiceOrderFor(gameState, `crossword-${clueIndex}`, game.words.length);
    return `<div class="crossword-clue"><span>${Math.min(clueIndex + 1, game.clues.length)}/${game.clues.length}</span><p>${escapeHtml(tr(clue.clue))}</p></div><div class="word-bank">
      ${optionOrder.map((index) => `<button type="button" class="game-token ${gameState.sequence.includes(index) ? "is-matched" : ""}" data-action="crossword-choice" data-question="${number}" data-game="${gameIndex}" data-option="${index}" ${disabled || gameState.sequence.includes(index) ? "disabled" : ""}>${escapeHtml(tr(game.words[index]))}</button>`).join("")}</div>${gameMessage(gameState, game)}`;
  }

  if (game.type === "move") {
    const blockIds = game.start || game.blocks?.map((item) => item.id) || game.answer;
    const illustration = gameIllustration(number, gameIndex);
    const solved = gameState.finished;
    const board = solved ? "" : `<div class="move-board ${game.mode === "image" ? "is-image-puzzle" : ""}">
      ${blockIds.map((id) => {
        const selectedIndex = gameState.sequence.indexOf(id);
        const block = game.blocks?.find((item) => item.id === id);
        return `<button type="button" class="move-block ${selectedIndex >= 0 ? "is-selected" : ""}" data-action="move-block" data-question="${number}" data-game="${gameIndex}" data-item="${id}" ${disabled ? "disabled" : ""} ${game.mode === "image" ? `style="--tile-image:url('${illustration}');--tile-x:${(Number(id) - 1) % 2};--tile-y:${Math.floor((Number(id) - 1) / 2)}"` : ""}>${selectedIndex >= 0 ? `<span class="token-order">${selectedIndex + 1}</span>` : ""}${game.mode === "image" ? `<span class="image-tile" aria-hidden="true"></span><span class="sr-only">${id}</span>` : escapeHtml(tr(block?.label || id))}</button>`;
      }).join("")}</div>`;
    return `${board}${solved ? `<div class="move-reveal">${game.mode !== "quote" ? `<img src="${illustration}" alt="" />` : ""}<blockquote>“${escapeHtml(tr(game.reveal))}”</blockquote>${game.source ? `<p class="source-line">${escapeHtml(tr(game.source))}</p>` : ""}</div>` : ""}${gameMessage(gameState, game)}`;
  }
  return "";
}

function gameSolution(game) {
  if (game.type === "minigame") return tr(game.insight || game.title || game.prompt);
  if (["sequence", "order"].includes(game.type)) return game.answer.map((id) => tr(game.items.find((item) => item.id === id).label)).join(" → ");
  if (game.type === "match") return game.pairs.map((pair) => `${tr(pair[0])} — ${tr(pair[1])}`).join(" · ");
  if (game.type === "reveal") return game.cards.map((card) => `${tr(card.text)} — ${tr(game.categories[card.correct])}`).join(" · ");
  if (game.type === "crossword") return game.clues.map((clue) => tr(game.words[clue.correct])).join(" · ");
  if (game.type === "wordsearch") return game.words.map((word) => tr(word)).join(" · ");
  if (["move", "image-shuffle"].includes(game.type)) return tr(game.reveal);
  return "";
}

function gameMessage(gameState, game) {
  if (gameState.finished) return `<div class="answer-explanation ${gameState.currentCorrect ? "is-correct" : "is-wrong"}"><strong>${gameState.currentCorrect ? `✓ ${c("correct")}` : `× ${c("missedXp")}`}</strong><p>${c("solution")}: ${escapeHtml(gameSolution(game))}</p>${game.insight ? `<p>${escapeHtml(tr(game.insight))}</p>` : ""}</div>`;
  if (gameState.message) return `<p class="game-message is-wrong">${escapeHtml(gameState.message)}</p>`;
  return '<p class="game-message" aria-hidden="true">&nbsp;</p>';
}

function bindWordSearchBoards() {
  document.querySelectorAll("[data-wordsearch]").forEach((container) => {
    if (container.dataset.disabled === "true") return;
    const mission = state.activeMission;
    const number = Number(container.dataset.question);
    const gameIndex = Number(container.dataset.game);
    if (!mission || mission.type !== "shared" || mission.challengeKind !== "game" || mission.questionNumber !== number || mission.challengeIndex !== gameIndex) return;
    const game = learningByNumber.get(number).games[gameIndex];
    if (game.type !== "wordsearch") return;
    const puzzle = wordSearchFor(number, game, gameIndex);
    const gameState = state.missionInteraction;
    gameState.foundWordIds ||= [];
    gameState.wordSearchStrokes ||= [];
    const board = container.querySelector("[data-wordsearch-board]");
    const liveStroke = container.querySelector(".wordsearch-live-stroke");
    const status = container.querySelector("[data-wordsearch-status]");
    const cells = [...container.querySelectorAll("[data-wordsearch-cell]")];
    let activePath = null;
    let tapStartIndex = null;
    let ignoreClickUntil = 0;

    const pointForEvent = (event) => {
      const bounds = board.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
        y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
      };
    };
    const cellForPoint = (point) => Math.min(puzzle.size - 1, Math.floor(point.y * puzzle.size)) * puzzle.size + Math.min(puzzle.size - 1, Math.floor(point.x * puzzle.size));
    const cellCoordinates = (index) => ({ row: Math.floor(index / puzzle.size), col: index % puzzle.size });

    const showInvalid = () => {
      liveStroke.classList.add("is-invalid");
      status.textContent = c("wordSearchTry");
      setTimeout(() => {
        if (!liveStroke.isConnected) return;
        liveStroke.setAttribute("points", "");
        liveStroke.classList.remove("is-invalid");
      }, 170);
    };

    const commit = async (points) => {
      const target = validateStroke(points, puzzle, gameState.foundWordIds);
      if (!target) {
        showInvalid();
        return;
      }
      gameState.foundWordIds.push(target.id);
      gameState.wordSearchStrokes.push({ wordId: target.id, points: simplifyPath(points) });
      gameState.message = "";
      const complete = gameState.foundWordIds.length === puzzle.words.length;
      if (complete) {
        gameState.finished = true;
        gameState.currentCorrect = true;
        gameState.attempted = true;
        gameState.succeeded = true;
      }
      saveMissionInteraction();
      if (complete) await completeTeamAttempt(true);
      else rerenderQuestion();
    };

    const chooseCell = (index) => {
      if (tapStartIndex === null) {
        tapStartIndex = index;
        cells.forEach((cell) => cell.classList.toggle("is-start", Number(cell.dataset.wordsearchCell) === index));
        status.textContent = c("wordSearchHelp");
        return;
      }
      const start = cellCoordinates(tapStartIndex);
      const end = cellCoordinates(index);
      tapStartIndex = null;
      cells.forEach((cell) => cell.classList.remove("is-start"));
      const path = pathBetweenCells(start, end, puzzle.size);
      if (path.length === 1) path.push({ ...path[0] });
      void commit(path);
    };

    board.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      board.setPointerCapture(event.pointerId);
      activePath = [pointForEvent(event)];
      liveStroke.setAttribute("points", wordSearchPathPoints(activePath));
    });
    board.addEventListener("pointermove", (event) => {
      if (!activePath) return;
      activePath.push(pointForEvent(event));
      liveStroke.setAttribute("points", wordSearchPathPoints(activePath));
    });
    board.addEventListener("pointerup", (event) => {
      if (!activePath) return;
      activePath.push(pointForEvent(event));
      const points = activePath;
      activePath = null;
      ignoreClickUntil = performance.now() + 300;
      const distance = Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y);
      if (distance <= 0.02) chooseCell(cellForPoint(points.at(-1)));
      else void commit(points);
    });
    board.addEventListener("pointercancel", () => {
      activePath = null;
      liveStroke.setAttribute("points", "");
    });

    cells.forEach((cell) => {
      cell.addEventListener("click", () => {
        if (performance.now() >= ignoreClickUntil) chooseCell(Number(cell.dataset.wordsearchCell));
      });
      cell.addEventListener("keydown", (event) => {
        const index = Number(cell.dataset.wordsearchCell);
        const row = Math.floor(index / puzzle.size);
        const col = index % puzzle.size;
        const moves = {
          ArrowLeft: [row, Math.max(0, col - 1)],
          ArrowRight: [row, Math.min(puzzle.size - 1, col + 1)],
          ArrowUp: [Math.max(0, row - 1), col],
          ArrowDown: [Math.min(puzzle.size - 1, row + 1), col],
        };
        if (moves[event.key]) {
          event.preventDefault();
          const nextIndex = moves[event.key][0] * puzzle.size + moves[event.key][1];
          cells.forEach((candidate, candidateIndex) => { candidate.tabIndex = candidateIndex === nextIndex ? 0 : -1; });
          cells[nextIndex]?.focus();
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          chooseCell(index);
        }
      });
    });
  });
}

function renderQuizCarousel(number, learning, interaction) {
  const panels = learning.quiz.map((item, quizIndex) => {
    const quizState = interaction.quiz[quizIndex];
    const optionOrder = choiceOrderFor(quizState, "quiz-options", item.options.length);
    return `<article class="carousel-panel quiz-panel"><div class="panel-label"><span class="panel-xp">+10 XP</span> ${quizState.attempted ? `<span class="done-label ${quizState.correct ? "" : "is-missed"}">${quizState.correct ? "✓ +10 XP" : `× ${c("missedXp")}`}</span>` : ""}</div><h2>${escapeHtml(tr(item.prompt))}</h2><div class="choice-board">
      ${optionOrder.map((optionIndex) => `<button type="button" class="choice-option ${quizState.selected === optionIndex ? (optionIndex === item.correct ? "is-correct" : "is-wrong") : ""} ${quizState.selected !== null && optionIndex === item.correct ? "is-correct-solution" : ""}" data-action="quiz-choice" data-question="${number}" data-quiz="${quizIndex}" data-option="${optionIndex}" ${quizState.attempted || quizState.selected !== null ? "disabled" : ""}>${escapeHtml(tr(item.options[optionIndex]))}</button>`).join("")}</div>
      ${quizState.selected === null ? "" : `<div class="answer-explanation ${quizState.currentCorrect ? "is-correct" : "is-wrong"}"><strong>${quizState.currentCorrect ? `✓ ${c("correct")}` : `× ${c("missedXp")}`}</strong><p>${escapeHtml(tr(item.feedback))}</p><p>${c("solution")}: ${escapeHtml(tr(item.options[item.correct]))}</p></div>`}</article>`;
  });
  return carousel("quiz-carousel", panels, `${c("quiz")} ${number}`);
}

function carousel(id, panels, label) {
  return `
    <div class="carousel-wrap">
      <div id="${id}" class="carousel" aria-label="${escapeHtml(label)}">${panels.join("")}</div>
      <div class="carousel-dots" role="tablist" aria-label="${escapeHtml(label)}">
        ${panels.map((_, index) => `<button type="button" data-action="carousel-dot" data-carousel="${id}" data-index="${index}" class="${index === 0 ? "is-active" : ""}" aria-label="${index + 1} ${c("of")} ${panels.length}"></button>`).join("")}
      </div>
    </div>
  `;
}

function renderReflectionsList(number) {
  if (state.feedStatus === "loading") return `<p class="empty-state">${c("loading")}</p>`;
  if (state.feedError) return `<p class="empty-state form-error">${escapeHtml(state.feedError)}</p>`;
  const reflections = [...(state.reflections.get(number) || [])]
    .sort((a, b) => (b.voters?.length || 0) - (a.voters?.length || 0) || createdAt(b) - createdAt(a));
  if (!reflections.length) return `<p class="empty-state">${c("empty")}</p>`;

  return renderReflectionCards(reflections, number, false);
}

function renderReflectionCards(reflections, number, showRoom) {
  const uid = participantUid();
  const heartsGiven = reflections.filter((reflection) => (reflection.voters || []).includes(uid)).length;
  return reflections.map((reflection, index) => {
    const voters = reflection.voters || [];
    const isOwn = reflection.authorUid === uid;
    const hasHearted = voters.includes(uid);
    return `
      <article class="reflection-card ${index === 0 && voters.length ? "is-leading" : ""}">
        <div class="reflection-copy">
          <p class="reflection-author">${c("anonymousReflection")} ${isOwn ? `<span>· ${c("ownAnswer")}</span>` : ""}</p>
          <p>${escapeHtml(reflection.text)}</p>
        </div>
        <button type="button" class="heart-button ${hasHearted ? "is-hearted" : ""}" data-action="heart" data-reflection="${escapeHtml(reflection.id)}" data-question="${number}" data-room="${escapeHtml(reflection.roomCode || "")}" data-scope="${showRoom ? "global" : "room"}" ${hasHearted || isOwn || heartsGiven >= 3 ? "disabled" : ""} aria-label="${voters.length} ${c("hearts")}">
          <span aria-hidden="true">♡</span><strong>${voters.length}</strong>
        </button>
      </article>
    `;
  }).join("");
}

function createdAt(reflection) {
  return reflection.createdAt?.toMillis?.() || 0;
}

function bindCarouselState() {
  document.querySelectorAll(".carousel").forEach((carouselEl) => {
    let raf = null;
    carouselEl.addEventListener("scroll", () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const index = Math.round(carouselEl.scrollLeft / Math.max(1, carouselEl.clientWidth));
        document.querySelectorAll(`[data-carousel="${carouselEl.id}"]`).forEach((dot, dotIndex) => {
          dot.classList.toggle("is-active", dotIndex === index);
        });
      });
    }, { passive: true });
  });
}

function cleanupReadingTimers() {
  if (state.readingCleanup) state.readingCleanup();
  state.readingCleanup = null;
}

function bindReadingTimers() {
  cleanupReadingTimers();
  const panels = [...document.querySelectorAll("[data-reading-id]")];
  if (!panels.length) return;
  const cleanups = [];

  panels.forEach((panel) => {
    const id = panel.dataset.readingId;
    const scroller = panel.querySelector("[data-reading-scroll]");
    let scrollTimer = null;
    const recordScroll = () => {
      const ratio = !scroller || scroller.scrollHeight <= scroller.clientHeight + 4
        ? 1
        : Math.min(1, scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight));
      const reading = progress.reading(id);
      if (ratio > reading.maxScrollRatio) progress.updateReading(id, { maxScrollRatio: ratio });
    };
    recordScroll();
    const onScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(recordScroll, 120);
    };
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => { clearTimeout(scrollTimer); scroller?.removeEventListener("scroll", onScroll); });
  });

  let last = performance.now();
  const interval = setInterval(() => {
    const now = performance.now();
    const delta = Math.min(500, now - last);
    last = now;
    if (document.visibilityState !== "visible") return;
    const active = panels.find((panel) => {
      const carouselEl = panel.closest(".carousel");
      const section = panel.closest(".feed-section");
      if (!carouselEl || !section) return false;
      const siblings = [...carouselEl.children].filter((item) => item.hasAttribute("data-reading-id"));
      const panelIndex = siblings.indexOf(panel);
      const activeIndex = Math.round(carouselEl.scrollLeft / Math.max(1, carouselEl.clientWidth));
      if (panelIndex !== activeIndex) return false;
      const rect = section.getBoundingClientRect();
      const heightVisible = Math.max(0, Math.min(rect.bottom, window.innerHeight - 58) - Math.max(rect.top, 0));
      return heightVisible / Math.max(1, rect.height) > 0.55;
    });
    if (!active) return;
    const id = active.dataset.readingId;
    if (progress.hasAward(id)) return;
    const requiredMs = Number(active.dataset.readingMs);
    const reading = progress.reading(id);
    const elapsedMs = Math.min(requiredMs, reading.elapsedMs + delta);
    const updated = progress.updateReading(id, { elapsedMs });
    const ring = active.querySelector("[data-reading-ring]");
    if (ring) ring.style.setProperty("--reading-progress", Math.min(1, elapsedMs / requiredMs));
    if (elapsedMs >= requiredMs && updated.maxScrollRatio >= 0.85) {
      const xp = Number(active.dataset.readingXp);
      if (grantReward(id, xp, { type: "reading", question: state.currentQuestion })) {
        ring?.classList.add("is-earned");
        const value = ring?.querySelector("strong");
        if (value) value.textContent = "✓";
      }
    }
  }, 250);
  cleanups.push(() => clearInterval(interval));
  state.readingCleanup = () => cleanups.forEach((cleanup) => cleanup());
}

function capturePositions() {
  const feed = document.querySelector("#question-feed");
  const carousels = {};
  document.querySelectorAll(".carousel").forEach((item) => { carousels[item.id] = item.scrollLeft; });
  return { feed: feed?.scrollTop || 0, carousels };
}

function restorePositions(positions) {
  if (!positions) return;
  requestAnimationFrame(() => {
    const feed = document.querySelector("#question-feed");
    if (feed) {
      feed.style.scrollBehavior = "auto";
      feed.scrollTop = positions.feed;
    }
    Object.entries(positions.carousels || {}).forEach(([id, scrollLeft]) => {
      const carouselEl = document.getElementById(id);
      if (carouselEl) {
        carouselEl.style.scrollBehavior = "auto";
        carouselEl.scrollLeft = scrollLeft;
      }
    });
    requestAnimationFrame(() => {
      if (feed) feed.style.removeProperty("scroll-behavior");
      document.querySelectorAll(".carousel").forEach((carouselEl) => {
        carouselEl.style.removeProperty("scroll-behavior");
      });
    });
  });
}

function rerenderQuestion() {
  const positions = capturePositions();
  renderQuestion(state.currentQuestion, positions);
}

async function launchMissionMinigame() {
  const mission = state.activeMission;
  if (!mission || mission.type !== "shared" || mission.challengeKind !== "game" || state.missionInteraction?.attempted || state.activeMinigameController) return;
  const activity = learningByNumber.get(mission.questionNumber)?.games?.[mission.challengeIndex];
  if (activity?.type !== "minigame") return;
  const missionNumber = mission.questionNumber;
  const positions = capturePositions();
  const { applyMissionMinigameResult, startMissionMinigame } = await import("./minigames/mission-player.js");
  document.body.classList.add("is-minigame-open");
  let controller = null;
  let completionTimer = null;
  const close = () => {
    clearTimeout(completionTimer);
    controller?.destroy();
    if (state.activeMinigameController === controller) state.activeMinigameController = null;
    document.body.classList.remove("is-minigame-open");
    renderQuestion(missionNumber, positions);
  };
  const continueToMissionLeaderboard = () => {
    controller?.destroy();
    if (state.activeMinigameController === controller) state.activeMinigameController = null;
    document.body.classList.remove("is-minigame-open");
    renderQuestion(missionNumber);
    void connectLeaderboards(true);
    requestAnimationFrame(() => document.querySelector('[data-section="overview"]')?.scrollIntoView({ behavior: "smooth" }));
  };
  try {
    controller = await startMissionMinigame({
      mount: app,
      mission,
      activity,
      language,
      onClose: close,
      onResult: async (result) => {
        const accepted = applyMissionMinigameResult(state.missionInteraction, result);
        if (!accepted.accepted) return;
        saveMissionInteraction();
        await completeTeamAttempt(accepted.correct, { render: false });
        completionTimer = setTimeout(() => {
          if (state.completedMission?.id === mission.id && state.activeMinigameController === controller) continueToMissionLeaderboard();
        }, 3000);
      },
    });
    state.activeMinigameController = controller;
  } catch (error) {
    document.body.classList.remove("is-minigame-open");
    controller?.destroy();
    state.activeMinigameController = null;
    throw error;
  }
}

async function openQuestion(number) {
  cleanupSubscription();
  state.feedStatus = isFirebaseConfigured() ? "loading" : "ready";
  state.feedError = "";
  state.questionGroupTotal = progress.questionGroupXp(state.room, number);
  renderQuestion(number);

  if (isFirebaseConfigured()) {
    const unsubscribe = await subscribeToGlobalQuestion(
      number,
      (reflections) => {
        state.reflections.set(number, reflections);
        state.feedStatus = "ready";
        rewardReceivedHearts(number, reflections);
        const ownReflection = reflections.find((reflection) => reflection.authorUid === participantUid());
        const interaction = interactionFor(number);
        if (ownReflection && !interaction.submitted) {
          const positions = capturePositions();
          interaction.answer = ownReflection.text;
          interaction.submitted = true;
          saveInteraction(number);
          renderQuestion(number, positions);
        } else {
          updateReflections(number);
        }
      },
      () => {
        state.feedStatus = "error";
        state.feedError = c("tryAgain");
        updateReflections(number);
      },
    );
    if (state.currentQuestion === number) state.unsubscribe = unsubscribe;
    else unsubscribe();

    const totalUnsubscribe = await subscribeToQuestionGroupTotal(state.room, number, (total) => {
      state.questionGroupTotal = total;
      const value = document.querySelector("[data-question-group-total]");
      if (value) value.textContent = `${total} XP`;
    }, () => {});
    if (state.currentQuestion === number) state.questionTotalUnsubscribe = totalUnsubscribe;
    else totalUnsubscribe();
  }
}

function rewardReceivedHearts(number, reflections) {
  const uid = participantUid();
  reflections.filter((reflection) => reflection.authorUid === uid).forEach((reflection) => {
    (reflection.voters || []).forEach((voterUid) => {
      grantReward(`heart-received:${number}:${reflection.id}:${voterUid}`, 5, {
        type: "heart-received",
        question: number,
        groupCode: reflection.roomCode || state.room,
      });
    });
  });
}

function updateReflections(number) {
  if (state.currentQuestion !== number) return;
  const list = document.querySelector("#reflections-list");
  if (list) list.innerHTML = renderReflectionsList(number);
  const uid = participantUid();
  const heartsGiven = (state.reflections.get(number) || []).filter((item) => (item.voters || []).includes(uid)).length;
  const counter = document.querySelector(".board-heart-counter");
  if (counter) counter.textContent = `♡ ${heartsGiven}/3`;
}

function cleanupSubscription() {
  cleanupReadingTimers();
  clearInterval(state.missionRenewTimer);
  state.missionRenewTimer = null;
  if (state.unsubscribe) state.unsubscribe();
  if (state.questionTotalUnsubscribe) state.questionTotalUnsubscribe();
  state.unsubscribe = null;
  state.questionTotalUnsubscribe = null;
}

app.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (event.target.id === "welcome-form") {
    const form = new FormData(event.target);
    const name = String(form.get("name") || "").trim();
    const age = Number(form.get("age"));
    const room = normalizeGroup(form.get("room"));
    const welcomeError = document.querySelector("#welcome-error");
    if (!name || age < 18 || age > 120 || !room) {
      welcomeError.textContent = language === "pt" ? "Preencha nome, idade (18+) e um código de grupo válido." : "Enter a name, an age of 18+, and a valid group code.";
      return;
    }

    try {
      await ensureParticipantSession();
      state.profile = { name, age, room };
      state.room = room;
      progress.setProfile(state.profile);
      scheduleLeaderboardSync("", true);
      void connectHeartRewards();
      renderHome();
    } catch (error) {
      console.error("Unable to join Firebase group", error);
      welcomeError.textContent = language === "pt" ? "Não foi possível entrar no grupo. Tente novamente." : "Could not join the group. Please try again.";
    }
    return;
  }

  if (event.target.id === "group-form") {
    const form = new FormData(event.target);
    const room = normalizeGroup(form.get("room"));
    if (!room) return;
    const previousRoom = state.room;
    if (state.activeMission) await releaseActiveMission(state.activeMission);
    state.activeMission = null;
    state.completedMission = null;
    state.missionInteraction = null;
    progress.transferAwardsToGroup(room);
    state.room = room;
    state.groupGoalCelebrated = false;
    state.profile = { ...state.profile, room };
    progress.setProfile(state.profile);
    progress.setSound(form.get("sound") === "on");
    scheduleLeaderboardSync(previousRoom, true);
    renderHome();
    return;
  }

  if (event.target.id === "answer-form") {
    const mission = state.activeMission;
    if (!mission || mission.type !== "reflection") return;
    const number = state.currentQuestion;
    const interaction = interactionFor(number);
    const positions = capturePositions();
    const text = String(new FormData(event.target).get("answer") || "").trim();
    const message = document.querySelector("#answer-message");
    if (!text) {
      message.textContent = language === "pt" ? "Escreva uma resposta antes de compartilhar." : "Write an answer before sharing.";
      return;
    }

    state.submitting = true;
    interaction.answer = text;
    renderQuestion(number, positions);
    try {
      const result = await publishReflection({
        roomCode: state.room,
        questionNumber: number,
        name: state.profile.name,
        age: state.profile.age,
        text,
      });
      interaction.submitted = true;
      saveInteraction(number);
      const xpAwarded = reflectionXp(text.length);
      const rewarded = grantReward(`reflection:${number}`, xpAwarded, { type: "reflection", question: number });
      if (!isFirebaseConfigured()) {
        const local = state.reflections.get(number) || [];
        state.reflections.set(number, [{ ...result, id: result.id }, ...local]);
      }
      if (rewarded) await new Promise((resolve) => setTimeout(resolve, 900));
      await finishReflectionMission("submitted");
    } catch (error) {
      console.error("Unable to publish reflection", error);
      interaction.submitted = false;
      interaction.answer = text;
      saveInteraction(number);
      state.feedError = c("tryAgain");
    } finally {
      state.submitting = false;
      if (state.activeMission) renderQuestion(number, positions);
    }
  }
});

app.addEventListener("input", (event) => {
  if (event.target.name === "room" && event.target.closest("#group-form")) {
    document.querySelectorAll(".group-choice").forEach((label) => label.classList.toggle("is-selected", label.contains(event.target)));
    return;
  }
  if (event.target.name !== "answer" || !state.currentQuestion) return;
  const interaction = interactionFor(state.currentQuestion);
  interaction.answer = event.target.value;
  saveInteraction(state.currentQuestion);
  const counter = document.querySelector("#answer-count");
  if (counter) counter.textContent = `${event.target.value.length}/300 · +${reflectionXp(event.target.value.trim().length)} XP`;
});

app.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "continue-profile") {
    try {
      await ensureParticipantSession();
      state.room = state.profile.room;
      scheduleLeaderboardSync("", true);
      void connectHeartRewards();
      renderHome();
    } catch {
      renderWelcome();
    }
    return;
  }

  if (action === "new-person") {
    const confirmed = window.confirm(language === "pt" ? "Apagar o perfil e o progresso deste dispositivo?" : "Clear the profile and progress on this device?");
    if (!confirmed) return;
    cleanupSubscription();
    cleanupLeaderboardSubscription();
    cleanupHeartRewards();
    if (state.activeMission) await releaseActiveMission(state.activeMission);
    progress.reset();
    await resetParticipantSession();
    state.profile = null;
    state.room = initialRoom || GROUPS[0].code;
    state.interactions.clear();
    renderWelcome();
    return;
  }

  if (action === "change-group") {
    cleanupMissionDashboard();
    renderGroupChooser();
    return;
  }

  if (action === "open-leaderboard") {
    cleanupSubscription();
    cleanupMissionDashboard();
    scheduleLeaderboardSync("", true);
    renderLeaderboard();
    await connectLeaderboards(true);
    return;
  }

  if (action === "dismiss-achievement") {
    target.remove();
    return;
  }

  if (action === "home") {
    if (state.profile) renderHome();
    return;
  }

  if (action === "next-mission") {
    state.completedMission = null;
    state.missionInteraction = null;
    await requestNextMission();
    return;
  }

  if (action === "skip-challenge") {
    const mission = state.activeMission;
    if (!mission || mission.type !== "shared" || mission.challengeKind !== "game") return;
    target.disabled = true;
    try {
      await skipSharedMission(mission);
      cleanupMissionDashboard();
      state.activeMission = null;
      state.missionInteraction = null;
      await requestNextMission(mission.id);
    } catch (error) {
      console.error("Unable to skip team challenge", error);
      target.disabled = false;
    }
    return;
  }

  if (action === "launch-minigame") {
    target.disabled = true;
    try {
      await launchMissionMinigame();
    } catch (error) {
      console.error("Unable to launch mission minigame", error);
      target.disabled = false;
    }
    return;
  }

  if (action === "reflection-not-now") {
    await finishReflectionMission("");
    return;
  }

  if (action === "reflection-decline") {
    await finishReflectionMission("declined");
    return;
  }

  if (action === "finish-board") {
    await finishBoardMission();
    return;
  }

  if (action === "open-question") {
    await openQuestion(Number(target.dataset.question));
    return;
  }

  if (action === "open-global-reflections") {
    await openGlobalOverview(Number(target.dataset.question));
    return;
  }

  if (action === "load-global-more") {
    target.disabled = true;
    await loadGlobalPage(Number(target.dataset.question));
    return;
  }

  if (action === "carousel-dot") {
    const carouselEl = document.getElementById(target.dataset.carousel);
    carouselEl?.scrollTo({ left: Number(target.dataset.index) * carouselEl.clientWidth, behavior: "smooth" });
    return;
  }

  if (["sequence", "match-left", "match-right", "reveal-choice", "crossword-choice", "move-block", "image-shuffle-tile", "image-shuffle-restart", "image-shuffle-reference"].includes(action)) {
    await handleGameAction(target, action);
    return;
  }

  if (action === "mission-quiz-choice") {
    const mission = state.activeMission;
    if (!mission || mission.type !== "shared" || mission.challengeKind !== "quiz" || state.missionInteraction.attempted) return;
    const optionIndex = Number(target.dataset.option);
    const item = learningByNumber.get(mission.questionNumber).quiz[0];
    state.missionInteraction.selected = optionIndex;
    state.missionInteraction.currentCorrect = optionIndex === item.correct;
    state.missionInteraction.attempted = true;
    state.missionInteraction.finished = true;
    state.missionInteraction.succeeded = state.missionInteraction.currentCorrect;
    saveMissionInteraction();
    await completeTeamAttempt(state.missionInteraction.currentCorrect);
    return;
  }

  if (action === "quiz-choice") {
    const number = Number(target.dataset.question);
    const quizIndex = Number(target.dataset.quiz);
    const optionIndex = Number(target.dataset.option);
    const learning = learningByNumber.get(number);
    const quizState = interactionFor(number).quiz[quizIndex];
    if (quizState.attempted) return;
    quizState.selected = optionIndex;
    quizState.currentCorrect = optionIndex === learning.quiz[quizIndex].correct;
    if (!quizState.attempted) {
      quizState.attempted = true;
      quizState.correct = quizState.currentCorrect;
      if (quizState.correct) grantReward(`quiz:${number}:${quizIndex}`, 10, { type: "quiz", question: number });
    }
    saveInteraction(number);
    rerenderQuestion();
    return;
  }

  if (action === "heart") {
    const number = Number(target.dataset.question);
    target.disabled = true;
    try {
      const result = await giveHeart({
        roomCode: target.dataset.room || state.room,
        questionNumber: number,
        reflectionId: target.dataset.reflection,
      });
      const uid = result.uid;
      if (result.bonus) grantReward(`heart-giver:${number}`, 2, { type: "heart-giver", question: number });
      if (target.dataset.scope === "global") {
        const reflection = state.globalReflections.find((item) => item.id === target.dataset.reflection);
        if (reflection && !reflection.voters.includes(uid)) reflection.voters.push(uid);
        if (state.view === "global") renderGlobalOverview(number);
      } else if (!isFirebaseConfigured()) {
        const reflections = state.reflections.get(number) || [];
        const reflection = reflections.find((item) => item.id === target.dataset.reflection);
        if (reflection && !reflection.voters.includes(uid)) reflection.voters.push(uid);
        updateReflections(number);
      }
    } catch {
      target.disabled = false;
    }
  }
});

async function handleGameAction(target, action) {
  const mission = state.activeMission;
  if (!mission || mission.type !== "shared" || mission.challengeKind !== "game") return;
  const number = mission.questionNumber;
  const gameIndex = mission.challengeIndex;
  const learning = learningByNumber.get(number);
  const game = learning.games[gameIndex];
  const gameState = state.missionInteraction;
  if (gameState.finished || gameState.attempted) return;

  const finish = (correct) => {
    gameState.finished = true;
    gameState.currentCorrect = correct;
    if (!gameState.attempted) {
      gameState.attempted = true;
      gameState.succeeded = correct;
    }
    saveMissionInteraction();
  };

  if (action === "image-shuffle-reference") {
    const puzzleState = imageShuffleStateFor(gameState);
    puzzleState.puzzleReference = !puzzleState.puzzleReference;
    saveMissionInteraction();
    rerenderQuestion();
    return;
  }

  if (action === "image-shuffle-restart") {
    const puzzleState = imageShuffleStateFor(gameState);
    const confirmation = language === "pt" ? "Embaralhar novamente e perder estes movimentos?" : "Shuffle again and lose these moves?";
    if (puzzleState.puzzleMoves > 0 && !window.confirm(confirmation)) return;
    puzzleState.puzzleBoard = shuffleBoard(IMAGE_SHUFFLE_SIZE);
    puzzleState.puzzleMoves = 0;
    puzzleState.puzzleStartedAt = Date.now();
    puzzleState.puzzleReference = false;
    saveMissionInteraction();
    rerenderQuestion();
    return;
  }

  if (action === "sequence") {
    const itemId = target.dataset.item;
    const expected = game.answer[gameState.sequence.length];
    if (itemId === expected) {
      gameState.sequence.push(itemId);
      gameState.message = "";
      if (gameState.sequence.length === game.answer.length) finish(true);
    } else {
      finish(false);
    }
  }

  if (action === "match-left") {
    gameState.activeLeft = Number(target.dataset.pair);
    gameState.message = "";
  }

  if (action === "match-right") {
    const right = Number(target.dataset.pair);
    if (gameState.activeLeft === right) {
      gameState.matched.push(right);
      gameState.activeLeft = null;
      gameState.message = "";
      if (gameState.matched.length === game.pairs.length) finish(true);
    } else {
      gameState.activeLeft = null;
      finish(false);
    }
  }

  if (action === "reveal-choice") {
    const option = Number(target.dataset.option);
    const card = game.cards[gameState.sequence.length];
    if (option !== card.correct) finish(false);
    else {
      gameState.sequence.push(option);
      if (gameState.sequence.length === game.cards.length) finish(true);
    }
  }

  if (action === "crossword-choice") {
    const option = Number(target.dataset.option);
    const clue = game.clues[gameState.sequence.length];
    if (option !== clue.correct) finish(false);
    else {
      gameState.sequence.push(option);
      if (gameState.sequence.length === game.clues.length) finish(true);
    }
  }

  if (action === "move-block") {
    const itemId = target.dataset.item;
    const expected = game.answer[gameState.sequence.length];
    if (itemId !== expected) finish(false);
    else {
      gameState.sequence.push(itemId);
      if (gameState.sequence.length === game.answer.length) finish(true);
    }
  }

  if (action === "image-shuffle-tile") {
    const puzzleState = imageShuffleStateFor(gameState);
    const nextBoard = moveTile(puzzleState.puzzleBoard, Number(target.dataset.cell), IMAGE_SHUFFLE_SIZE);
    if (!nextBoard) return;
    puzzleState.puzzleBoard = nextBoard;
    puzzleState.puzzleMoves += 1;
    if (isSolved(nextBoard, IMAGE_SHUFFLE_SIZE)) finish(true);
  }

  saveMissionInteraction();
  if (gameState.finished) await completeTeamAttempt(gameState.currentCorrect);
  else rerenderQuestion();
}

document.addEventListener("pointerdown", noteMissionActivity, { passive: true });
document.addEventListener("keydown", noteMissionActivity);
document.addEventListener("scroll", noteMissionActivity, { passive: true, capture: true });
window.addEventListener("beforeunload", () => {
  state.activeMinigameController?.destroy();
  cleanupSubscription();
});
if (gameLabId) {
  void import("./minigames/game-lab.js")
    .then(({ startGameLab }) => startGameLab({ mount: app, id: gameLabId, language }))
    .catch((error) => {
      console.error("Unable to open Game Lab", error);
      app.innerHTML = `<main class="minigame-lab-error"><h1>${language === "en" ? "Game Lab could not start" : "O Laboratório de Jogos não pôde iniciar"}</h1><p>${escapeHtml(error.message)}</p></main>`;
    });
} else if (state.profile) renderReturning();
else renderWelcome();
