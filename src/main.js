import "@fontsource/fira-sans/latin-400.css";
import "@fontsource/fira-sans/latin-500.css";
import "@fontsource/fira-sans/latin-600.css";
import "@fontsource/fira-sans/latin-700.css";
import "@fontsource/fira-sans/latin-800.css";
import "./styles.css";
import officialContent from "./data/official-content.json";
import learningContent from "./data/learning-content.js";
import {
  ensureParticipantSession,
  getGlobalReflections,
  getQuestionReflectionCounts,
  giveHeart,
  isFirebaseConfigured,
  participantUid,
  publishReflection,
  subscribeToRoom,
} from "./firebase.js";

const app = document.querySelector("#app");
const params = new URLSearchParams(window.location.search);
const language = params.get("lang") === "en" ? "en" : "pt";
const initialRoom = normalizeRoom(params.get("room") || "");
const youcatLoveLogo = new URL("./assets/brand/youcat-love-red.svg", import.meta.url).href;

const copy = {
  en: {
    home: "Home",
    welcomeTitle: "YOUCAT Assis",
    name: "Your name",
    namePlaceholder: "How should the group call you?",
    age: "Your age",
    room: "Group code",
    roomPlaceholder: "For example: MESA-04",
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
    games: "Three games",
    game: "Game",
    quoteLocked: "Complete the three games to reveal the quote.",
    quoteReady: "Quote revealed",
    quiz: "Check your understanding",
    answer: "In your own words",
    answerBody: "Explain the heart of this question as you understand it. It will appear in your group feed and in the all-answers overview.",
    answerPlaceholder: "Write your answer here…",
    submit: "Share with my group",
    submitted: "Your answer is now visible to the group.",
    reflections: "Your group’s reflections",
    reflectionsBody: "Give one heart to the answers that help your discussion most.",
    empty: "No one in this group has answered this question yet.",
    loading: "Connecting to the group…",
    localMode: "Local preview: Firebase is not connected yet.",
    liveMode: "Live group feed",
    tryAgain: "Please try again.",
    correct: "Correct",
    incorrect: "Try once more",
    sequenceHelp: "Tap the steps in the right order.",
    matchHelp: "Tap one item on the left, then its match on the right.",
    done: "Completed",
    of: "of",
    hearts: "hearts",
    ownAnswer: "your answer",
  },
  pt: {
    home: "Início",
    welcomeTitle: "YOUCAT Assis",
    name: "Seu nome",
    namePlaceholder: "Como o grupo deve chamar você?",
    age: "Sua idade",
    room: "Código do grupo",
    roomPlaceholder: "Por exemplo: MESA-04",
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
    games: "Três jogos",
    game: "Jogo",
    quoteLocked: "Complete os três jogos para revelar a frase.",
    quoteReady: "Frase revelada",
    quiz: "Verifique a compreensão",
    answer: "Com suas próprias palavras",
    answerBody: "Explique o centro desta pergunta como você o compreende. Ela aparecerá no mural do grupo e na visão geral de todas as respostas.",
    answerPlaceholder: "Escreva sua resposta aqui…",
    submit: "Compartilhar com meu grupo",
    submitted: "Sua resposta agora está visível para o grupo.",
    reflections: "Reflexões do seu grupo",
    reflectionsBody: "Dê um coração às respostas que mais ajudam a conversa do grupo.",
    empty: "Ninguém neste grupo respondeu a esta pergunta ainda.",
    loading: "Conectando ao grupo…",
    localMode: "Prévia local: o Firebase ainda não está conectado.",
    liveMode: "Mural do grupo ao vivo",
    tryAgain: "Tente novamente.",
    correct: "Correto",
    incorrect: "Tente mais uma vez",
    sequenceHelp: "Toque nas etapas na ordem certa.",
    matchHelp: "Toque em um item à esquerda e depois no correspondente à direita.",
    done: "Concluído",
    of: "de",
    hearts: "corações",
    ownAnswer: "sua resposta",
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

const officialByNumber = new Map(officialContent.questions.map((item) => [item.number, item]));
const learningByNumber = new Map(learningContent.map((item) => [item.number, item]));

const state = {
  view: "welcome",
  profile: null,
  room: initialRoom,
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
  submitting: false,
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

function normalizeRoom(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 16);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function interactionFor(number) {
  if (!state.interactions.has(number)) {
    const learning = learningByNumber.get(number);
    state.interactions.set(number, {
      games: learning.games.map((game) => ({
        done: false,
        selected: null,
        sequence: [],
        activeLeft: null,
        matched: [],
        message: "",
      })),
      quiz: learning.quiz.map(() => ({ selected: null, correct: false })),
      answer: "",
      submitted: false,
    });
  }
  return state.interactions.get(number);
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
            <input name="room" type="text" autocomplete="off" maxlength="16" value="${escapeHtml(state.room)}" placeholder="${c("roomPlaceholder")}" required ${initialRoom ? "readonly" : ""} />
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
  state.view = "home";
  state.currentQuestion = null;
  const cards = officialContent.questions.map((item, index) => {
    const official = item.official[language];
    const interaction = interactionFor(item.number);
    const count = state.reflectionCounts.get(item.number);
    return `
      <article class="question-card" style="--card-index:${index}">
        <button type="button" class="question-card-main" data-action="open-question" data-question="${item.number}" aria-label="${escapeHtml(official.question)}">
          <img class="question-card-illustration" src="${questionIllustrations[item.number]}" alt="" />
          <span class="question-card-copy">
            <span class="question-card-meta">
              <span>${c("question")} ${item.number}</span>
              ${interaction.submitted ? `<span class="complete-mark">✓ ${c("completed")}</span>` : ""}
            </span>
            <span class="question-card-title">${escapeHtml(tr(topics[item.number]))}</span>
            <span class="question-card-question">${escapeHtml(official.question)}</span>
          </span>
        </button>
        <button type="button" class="reflection-total" data-action="open-global-reflections" data-question="${item.number}" aria-label="${c("openAllReflections")}: ${c("question")} ${item.number}">
          <strong data-reflection-count="${item.number}">${count ?? "…"}</strong>
          <span>${c("answers")}</span>
        </button>
      </article>
    `;
  }).join("");

  app.innerHTML = `
    <main class="app-shell home-screen">
      <header class="home-heading">
        <p class="brand-kicker">YOUCAT</p>
        <h1>${c("choose")}</h1>
        <span class="room-chip">${c("roomLabel")} ${escapeHtml(state.room)}</span>
      </header>
      <section class="question-list" aria-label="${c("choose")}">${cards}</section>
      ${bottomNavigation(false)}
    </main>
  `;
  window.scrollTo({ top: 0, behavior: "auto" });
  void refreshReflectionCounts();
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

function renderQuestion(number, positions = null) {
  state.view = "question";
  state.currentQuestion = number;
  const official = officialByNumber.get(number).official[language];
  const learning = learningByNumber.get(number);
  const interaction = interactionFor(number);
  const allGamesDone = interaction.games.every((item) => item.done);

  app.innerHTML = `
    <main class="app-shell question-screen">
      <div id="question-feed" class="question-feed">
        <section class="feed-section intro-section" data-section="intro">
          <div class="section-inner">
            <p class="section-kicker">YOUCAT Love Forever ${number}</p>
            <div class="intro-illustration"><img src="${questionIllustrations[number]}" alt="" /></div>
            <h1>${escapeHtml(official.question)}</h1>
            <div class="topic-marker">${escapeHtml(tr(topics[number]))}</div>
            <p class="scroll-hint">${c("introHint")} <span aria-hidden="true">↓</span></p>
          </div>
        </section>

        <section class="feed-section" data-section="reader">
          <div class="section-inner section-with-carousel">
            <p class="section-kicker">1 · ${c("reader")}</p>
            ${renderReaderCarousel(number, official, learning)}
          </div>
        </section>

        <section class="feed-section" data-section="games">
          <div class="section-inner section-with-carousel">
            <p class="section-kicker">2 · ${c("games")}</p>
            ${renderGamesCarousel(number, learning, interaction, allGamesDone)}
          </div>
        </section>

        <section class="feed-section" data-section="quiz">
          <div class="section-inner section-with-carousel">
            <p class="section-kicker">3 · ${c("quiz")}</p>
            ${renderQuizCarousel(number, learning, interaction)}
          </div>
        </section>

        <section class="feed-section answer-section" data-section="answer">
          <div class="section-inner">
            <p class="section-kicker">4 · ${c("answer")}</p>
            <h2>${escapeHtml(tr(learning.reflectionPrompt))}</h2>
            <p>${c("answerBody")}</p>
            <form id="answer-form" class="answer-form">
              <textarea name="answer" maxlength="1200" placeholder="${c("answerPlaceholder")}" ${interaction.submitted ? "disabled" : ""}>${escapeHtml(interaction.answer)}</textarea>
              <div class="answer-form-foot">
                <span id="answer-count">${interaction.answer.length}/1200</span>
                <button class="primary-action" type="submit" ${interaction.submitted || state.submitting ? "disabled" : ""}>${interaction.submitted ? c("submitted") : c("submit")}</button>
              </div>
              <p id="answer-message" class="form-note" role="status">${interaction.submitted ? c("submitted") : ""}</p>
            </form>
          </div>
        </section>

        <section class="feed-section reflections-section" data-section="reflections">
          <div class="section-inner reflections-inner">
            <p class="section-kicker">5 · ${c("reflections")}</p>
            <h2>${c("reflections")}</h2>
            <p>${c("reflectionsBody")}</p>
            <div class="feed-mode ${isFirebaseConfigured() ? "is-live" : "is-local"}">${isFirebaseConfigured() ? c("liveMode") : c("localMode")}</div>
            <div id="reflections-list" class="reflections-list" aria-live="polite">${renderReflectionsList(number)}</div>
          </div>
        </section>
      </div>
      ${bottomNavigation(false)}
    </main>
  `;

  bindCarouselState();
  restorePositions(positions);
}

function renderReaderCarousel(number, official, learning) {
  const panels = [
    `
      <article class="carousel-panel reader-panel">
        <div class="panel-label">${c("loveForever")} · ${number}</div>
        <h2>${escapeHtml(official.question)}</h2>
        <div class="panel-scroll source-text official-text">${renderParagraphs(official.answer, { initial: true })}</div>
      </article>
    `,
    ...learning.deepDive.map((deepDive, index) => `
      <article class="carousel-panel reader-panel deep-dive-panel">
        <div class="panel-label">${c("deepDive")} ${index + 1}</div>
        <p class="source-line">${escapeHtml(deepDive.source)}</p>
        <h2 class="source-document-title ${sourceTitleClass(deepDive.source)}">${escapeHtml(tr(deepDive.title))}</h2>
        ${deepDive.editionNote ? `<p class="source-warning">${escapeHtml(deepDive.editionNote)}</p>` : ""}
        <div class="panel-scroll source-text official-text">
          ${deepDive.question ? `<h3 class="source-question">${escapeHtml(tr(deepDive.question))}</h3>` : ""}
          ${renderParagraphs(tr(deepDive.body), { initial: true, stripLeadingNumber: true })}
        </div>
      </article>
    `),
  ];
  return carousel("reader-carousel", panels, `${c("reader")} ${number}`);
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

function renderGamesCarousel(number, learning, interaction, allGamesDone) {
  const panels = learning.games.map((game, index) => `
    <article class="carousel-panel game-panel">
      <div class="panel-label">${c("game")} ${index + 1} ${interaction.games[index].done ? `<span class="done-label">✓ ${c("done")}</span>` : ""}</div>
      <h2>${escapeHtml(tr(game.prompt))}</h2>
      ${renderGame(number, game, index, interaction.games[index])}
    </article>
  `);

  panels.push(`
    <article class="carousel-panel quote-panel ${allGamesDone ? "is-revealed" : "is-locked"}">
      <div class="panel-label">${allGamesDone ? c("quoteReady") : `${interaction.games.filter((item) => item.done).length} ${c("of")} 3`}</div>
      ${allGamesDone ? `
        <blockquote>“${escapeHtml(tr(learning.saintQuote.text))}”</blockquote>
        <p class="quote-author">${escapeHtml(tr(learning.saintQuote.author))}</p>
        <p class="source-line">${escapeHtml(tr(learning.saintQuote.source))}</p>
      ` : `
        <div class="quote-lock" aria-hidden="true">○ ○ ○</div>
        <h2>${c("quoteLocked")}</h2>
      `}
    </article>
  `);

  return carousel("games-carousel", panels, `${c("games")} ${number}`);
}

function renderGame(number, game, gameIndex, gameState) {
  if (game.type === "sequence") {
    return `
      <p class="game-help">${c("sequenceHelp")}</p>
      <div class="sequence-board">
        ${game.items.map((item) => {
          const selectedIndex = gameState.sequence.indexOf(item.id);
          return `<button type="button" data-action="sequence" data-question="${number}" data-game="${gameIndex}" data-item="${item.id}" class="game-token ${selectedIndex >= 0 ? "is-selected" : ""}" ${gameState.done ? "disabled" : ""}>
            ${selectedIndex >= 0 ? `<span class="token-order">${selectedIndex + 1}</span>` : ""}${escapeHtml(tr(item.label))}
          </button>`;
        }).join("")}
      </div>
      ${gameMessage(gameState)}
    `;
  }

  if (game.type === "match") {
    const rightOrder = [1, 2, 0];
    return `
      <p class="game-help">${c("matchHelp")}</p>
      <div class="match-board">
        <div class="match-column">
          ${game.pairs.map((pair, index) => `<button type="button" class="game-token ${gameState.activeLeft === index ? "is-active" : ""} ${gameState.matched.includes(index) ? "is-matched" : ""}" data-action="match-left" data-question="${number}" data-game="${gameIndex}" data-pair="${index}" ${gameState.matched.includes(index) ? "disabled" : ""}>${escapeHtml(tr(pair[0]))}</button>`).join("")}
        </div>
        <div class="match-column">
          ${rightOrder.map((index) => `<button type="button" class="game-token ${gameState.matched.includes(index) ? "is-matched" : ""}" data-action="match-right" data-question="${number}" data-game="${gameIndex}" data-pair="${index}" ${gameState.matched.includes(index) ? "disabled" : ""}>${escapeHtml(tr(game.pairs[index][1]))}</button>`).join("")}
        </div>
      </div>
      ${gameMessage(gameState)}
    `;
  }

  return `
    <div class="choice-board">
      ${game.options.map((option, index) => `<button type="button" class="choice-option ${gameState.selected === index ? (index === game.correct ? "is-correct" : "is-wrong") : ""}" data-action="game-choice" data-question="${number}" data-game="${gameIndex}" data-option="${index}" ${gameState.done ? "disabled" : ""}>${escapeHtml(tr(option))}</button>`).join("")}
    </div>
    ${gameMessage(gameState)}
  `;
}

function gameMessage(gameState) {
  if (gameState.done) return `<p class="game-message is-correct">✓ ${c("correct")}</p>`;
  if (gameState.message) return `<p class="game-message is-wrong">${escapeHtml(gameState.message)}</p>`;
  return '<p class="game-message" aria-hidden="true">&nbsp;</p>';
}

function renderQuizCarousel(number, learning, interaction) {
  const panels = learning.quiz.map((item, quizIndex) => {
    const quizState = interaction.quiz[quizIndex];
    return `
      <article class="carousel-panel quiz-panel">
        <div class="panel-label">${quizIndex + 1} ${c("of")} ${learning.quiz.length} ${quizState.correct ? `<span class="done-label">✓ ${c("correct")}</span>` : ""}</div>
        <h2>${escapeHtml(tr(item.prompt))}</h2>
        <div class="choice-board">
          ${item.options.map((option, optionIndex) => `<button type="button" class="choice-option ${quizState.selected === optionIndex ? (optionIndex === item.correct ? "is-correct" : "is-wrong") : ""}" data-action="quiz-choice" data-question="${number}" data-quiz="${quizIndex}" data-option="${optionIndex}" ${quizState.correct ? "disabled" : ""}>${escapeHtml(tr(option))}</button>`).join("")}
        </div>
        ${quizState.selected === null ? "" : `<p class="game-message ${quizState.correct ? "is-correct" : "is-wrong"}">${quizState.correct ? `✓ ${c("correct")}` : c("incorrect")}</p>`}
      </article>
    `;
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
  return reflections.map((reflection, index) => {
    const voters = reflection.voters || [];
    const isOwn = reflection.authorUid === uid;
    const hasHearted = voters.includes(uid);
    const room = showRoom && reflection.roomCode
      ? `<span class="reflection-room">· ${c("roomLabel")} ${escapeHtml(reflection.roomCode)}</span>`
      : "";
    return `
      <article class="reflection-card ${index === 0 && voters.length ? "is-leading" : ""}">
        <div class="reflection-copy">
          <p class="reflection-author">${escapeHtml(reflection.name)}, ${Number(reflection.age)} ${room} ${isOwn ? `<span>· ${c("ownAnswer")}</span>` : ""}</p>
          <p>${escapeHtml(reflection.text)}</p>
        </div>
        <button type="button" class="heart-button ${hasHearted ? "is-hearted" : ""}" data-action="heart" data-reflection="${escapeHtml(reflection.id)}" data-question="${number}" data-room="${escapeHtml(reflection.roomCode || "")}" data-scope="${showRoom ? "global" : "room"}" ${hasHearted || isOwn ? "disabled" : ""} aria-label="${voters.length} ${c("hearts")}">
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

async function openQuestion(number) {
  cleanupSubscription();
  state.feedStatus = isFirebaseConfigured() ? "loading" : "ready";
  state.feedError = "";
  renderQuestion(number);

  if (isFirebaseConfigured()) {
    const unsubscribe = await subscribeToRoom(
      state.room,
      number,
      (reflections) => {
        state.reflections.set(number, reflections);
        state.feedStatus = "ready";
        const ownReflection = reflections.find((reflection) => reflection.authorUid === participantUid());
        const interaction = interactionFor(number);
        if (ownReflection && !interaction.submitted) {
          const positions = capturePositions();
          interaction.answer = ownReflection.text;
          interaction.submitted = true;
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
  }
}

function updateReflections(number) {
  if (state.currentQuestion !== number) return;
  const list = document.querySelector("#reflections-list");
  if (list) list.innerHTML = renderReflectionsList(number);
}

function cleanupSubscription() {
  if (state.unsubscribe) state.unsubscribe();
  state.unsubscribe = null;
}

app.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (event.target.id === "welcome-form") {
    const form = new FormData(event.target);
    const name = String(form.get("name") || "").trim();
    const age = Number(form.get("age"));
    const room = normalizeRoom(form.get("room"));
    const welcomeError = document.querySelector("#welcome-error");
    if (!name || age < 18 || age > 120 || room.length < 3) {
      welcomeError.textContent = language === "pt" ? "Preencha nome, idade (18+) e um código de grupo válido." : "Enter a name, an age of 18+, and a valid group code.";
      return;
    }

    try {
      await ensureParticipantSession();
      state.profile = { name, age };
      state.room = room;
      renderHome();
    } catch (error) {
      console.error("Unable to join Firebase group", error);
      welcomeError.textContent = language === "pt" ? "Não foi possível entrar no grupo. Tente novamente." : "Could not join the group. Please try again.";
    }
    return;
  }

  if (event.target.id === "answer-form") {
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
      if (!isFirebaseConfigured()) {
        const local = state.reflections.get(number) || [];
        state.reflections.set(number, [{ ...result, id: result.id }, ...local]);
      }
    } catch (error) {
      console.error("Unable to publish reflection", error);
      interaction.submitted = false;
      interaction.answer = text;
      state.feedError = c("tryAgain");
    } finally {
      state.submitting = false;
      renderQuestion(number, positions);
    }
  }
});

app.addEventListener("input", (event) => {
  if (event.target.name !== "answer" || !state.currentQuestion) return;
  const interaction = interactionFor(state.currentQuestion);
  interaction.answer = event.target.value;
  const counter = document.querySelector("#answer-count");
  if (counter) counter.textContent = `${event.target.value.length}/1200`;
});

app.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "home") {
    if (state.profile) renderHome();
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

  if (["sequence", "match-left", "match-right", "game-choice"].includes(action)) {
    handleGameAction(target, action);
    return;
  }

  if (action === "quiz-choice") {
    const number = Number(target.dataset.question);
    const quizIndex = Number(target.dataset.quiz);
    const optionIndex = Number(target.dataset.option);
    const learning = learningByNumber.get(number);
    const quizState = interactionFor(number).quiz[quizIndex];
    quizState.selected = optionIndex;
    quizState.correct = optionIndex === learning.quiz[quizIndex].correct;
    rerenderQuestion();
    return;
  }

  if (action === "heart") {
    const number = Number(target.dataset.question);
    target.disabled = true;
    try {
      const uid = await giveHeart({
        roomCode: target.dataset.room || state.room,
        questionNumber: number,
        reflectionId: target.dataset.reflection,
      });
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

function handleGameAction(target, action) {
  const number = Number(target.dataset.question);
  const gameIndex = Number(target.dataset.game);
  const learning = learningByNumber.get(number);
  const game = learning.games[gameIndex];
  const gameState = interactionFor(number).games[gameIndex];

  if (action === "sequence") {
    const itemId = target.dataset.item;
    const expected = game.answer[gameState.sequence.length];
    if (itemId === expected) {
      gameState.sequence.push(itemId);
      gameState.message = "";
      if (gameState.sequence.length === game.answer.length) gameState.done = true;
    } else {
      gameState.sequence = [];
      gameState.message = c("incorrect");
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
      if (gameState.matched.length === game.pairs.length) gameState.done = true;
    } else {
      gameState.activeLeft = null;
      gameState.message = c("incorrect");
    }
  }

  if (action === "game-choice") {
    const option = Number(target.dataset.option);
    gameState.selected = option;
    gameState.done = option === game.correct;
    gameState.message = gameState.done ? "" : c("incorrect");
  }

  rerenderQuestion();
}

window.addEventListener("beforeunload", cleanupSubscription);
renderWelcome();
