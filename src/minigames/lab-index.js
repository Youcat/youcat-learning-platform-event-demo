import { bundledMinigameSource, createAppMinigameRegistry } from "./catalog.js";

const FOUNDATION_ENGINE_ID = "foundation-skeleton";

export const PLANNED_MINIGAME_ENGINES = Object.freeze([
  { engineId: "A2", title: { en: "Prune what chokes love", pt: "Pode o que sufoca o amor" } },
  { engineId: "A4", title: { en: "Living Symbols", pt: "Símbolos vivos" } },
  { engineId: "A7", title: { en: "Restore the whole person", pt: "Restaure a pessoa inteira" } },
  { engineId: "B9", title: { en: "Bridge of Fidelity", pt: "Ponte da Fidelidade" } },
  { engineId: "B13", title: { en: "Words that belong together", pt: "Palavras que pertencem uma à outra" } },
  { engineId: "B14", title: { en: "Roots, trunk, branches & fruit", pt: "Raízes, tronco, ramos e fruto" } },
  { engineId: "C20", title: { en: "River of Decisions", pt: "Rio das Decisões" } },
  { engineId: "C22", title: { en: "Magnetic Field", pt: "Campo Magnético" } },
  { engineId: "C23", title: { en: "Compass of Discernment", pt: "Bússola do Discernimento" } },
  { engineId: "C27", title: { en: "Wellspring", pt: "Nascente" } },
  { engineId: "C29", title: { en: "Mirror of Truth", pt: "Espelho da Verdade" } },
  { engineId: "C30", title: { en: "Covenant Rings", pt: "Anéis da Aliança" } },
]);

export const FOUNDATION_LAB_ENTRY = Object.freeze({
  engineId: FOUNDATION_ENGINE_ID,
  title: { en: "Foundation interaction proof", pt: "Prova de interação da fundação" },
  fixture: true,
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizedLanguage(language) {
  return language === "en" ? "en" : "pt";
}

export function minigameLabIndexHref(language = "pt") {
  return `?lab=index&lang=${normalizedLanguage(language)}`;
}

export function buildMinigameLabEntries({
  source = bundledMinigameSource,
  registry = createAppMinigameRegistry(),
  language = "pt",
} = {}) {
  const lang = normalizedLanguage(language);
  const fixtures = source.list();
  const registrations = new Set(
    registry.registrations().map(({ engineId, engineVersion }) => `${engineId}@${engineVersion}`),
  );

  return [...PLANNED_MINIGAME_ENGINES, FOUNDATION_LAB_ENTRY].map((planned) => {
    const fixture = fixtures.find(({ engineId }) => engineId === planned.engineId) || null;
    const registered = Boolean(fixture && registrations.has(`${fixture.engineId}@${fixture.engineVersion}`));
    const title = fixture?.title?.[lang] || planned.title[lang];
    return Object.freeze({
      engineId: planned.engineId,
      fixture: Boolean(planned.fixture),
      fixtureId: fixture?.id || null,
      questionNumber: fixture?.questionNumber || null,
      missionSlot: fixture?.missionSlot ?? null,
      title,
      playable: registered,
      href: registered ? `?lab=${encodeURIComponent(fixture.id)}&lang=${lang}` : null,
    });
  });
}

function entryMarkup(entry, copy) {
  const code = entry.fixture ? copy.fixture : entry.engineId;
  const context = entry.fixture
    ? copy.foundation
    : entry.questionNumber
      ? `${copy.question} ${entry.questionNumber} · ${copy.slot} ${entry.missionSlot + 1}`
      : copy.planned;
  const content = `
    <span class="minigame-index-code">${escapeHtml(code)}</span>
    <span class="minigame-index-copy">
      <strong>${escapeHtml(entry.title)}</strong>
      <small>${escapeHtml(context)}</small>
    </span>`;

  if (entry.playable) {
    return `<li><a class="minigame-index-row" href="${escapeHtml(entry.href)}">${content}<span class="minigame-index-arrow" aria-hidden="true">→</span></a></li>`;
  }
  return `<li><div class="minigame-index-row is-review" aria-disabled="true">${content}<span class="minigame-index-state">${copy.inReview}</span></div></li>`;
}

export function renderGameLabIndex({ mount, language = "pt", source, registry } = {}) {
  if (!mount) throw new TypeError("Game Lab index requires a mount element");
  const lang = normalizedLanguage(language);
  const copy = lang === "en" ? {
    back: "Back to Home",
    kicker: "Test only",
    title: "Test minigames",
    intro: "Open a reviewed fixture. Entries still being reviewed cannot be opened yet.",
    question: "Question",
    slot: "game",
    planned: "Planned engine",
    fixture: "Fixture",
    foundation: "Foundation only · not used in missions",
    inReview: "In review",
  } : {
    back: "Voltar ao Início",
    kicker: "Somente teste",
    title: "Testar minijogos",
    intro: "Abra uma fixture revisada. Entradas ainda em revisão não podem ser abertas.",
    question: "Pergunta",
    slot: "jogo",
    planned: "Engine planejada",
    fixture: "Fixture",
    foundation: "Somente fundação · não usada nas missões",
    inReview: "Em revisão",
  };
  const entries = buildMinigameLabEntries({ source, registry, language: lang });

  mount.innerHTML = `
    <main class="minigame-lab-index">
      <header class="minigame-index-heading">
        <a class="minigame-index-back" href="?lang=${lang}">← ${copy.back}</a>
        <p>${copy.kicker}</p>
        <h1>${copy.title}</h1>
        <p>${copy.intro}</p>
      </header>
      <ul class="minigame-index-list" aria-label="${copy.title}">
        ${entries.map((entry) => entryMarkup(entry, copy)).join("")}
      </ul>
    </main>`;

  if (typeof document !== "undefined") document.documentElement.lang = lang === "en" ? "en" : "pt-BR";
  return entries;
}
