export const GROUPS = [
  ["Assis-Sao-Jose", "São José", "lírio"],
  ["Assis-Sao-Francisco", "São Francisco", "pássaro"],
  ["Assis-Santa-Clara", "Santa Clara", "custódia"],
  ["Assis-Santo-Antonio", "Santo Antônio", "lírio e livro"],
  ["Assis-Sao-Joao-Paulo", "São João Paulo II", "cruz"],
  ["Assis-Santa-Teresa-de-Calcuta", "Santa Teresa de Calcutá", "coração"],
  ["Assis-Sao-Pedro", "São Pedro", "chaves"],
  ["Assis-Sao-Paulo", "São Paulo", "espada e livro"],
  ["Assis-Santa-Rita", "Santa Rita", "rosa"],
  ["Assis-Sao-Bento", "São Bento", "cruz e livro"],
  ["Assis-Santa-Teresinha", "Santa Teresinha", "rosas"],
  ["Assis-Sao-Joao-Bosco", "São João Bosco", "estrelas"],
  ["Assis-Santa-Faustina", "Santa Faustina", "raios"],
  ["Assis-Santo-Agostinho", "Santo Agostinho", "coração e livro"],
  ["Assis-Santa-Monica", "Santa Mônica", "lágrima"],
  ["Assis-Sao-Padre-Pio", "São Padre Pio", "cruz"],
  ["Assis-Santa-Catarina", "Santa Catarina de Sena", "lírio"],
  ["Assis-Sao-Domingos", "São Domingos", "estrela"],
  ["Assis-Santa-Gianna", "Santa Gianna", "criança"],
  ["Assis-Sao-Maximiliano-Kolbe", "São Maximiliano Kolbe", "coroas"],
].map(([code, saint, symbol], index) => ({ code, saint, symbol, index }));

export const GROUP_CODES = new Set(GROUPS.map((group) => group.code));

export function groupByCode(code) {
  return GROUPS.find((group) => group.code === code) || GROUPS[0];
}

export function normalizeGroup(value) {
  const normalized = String(value || "").trim();
  return GROUP_CODES.has(normalized) ? normalized : "";
}

export function groupDisplayName(value) {
  const code = typeof value === "object" ? value?.code : value;
  return String(code || "").replace(/^Assis-/, "");
}

export function displayNameForLeaderboard(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Participante";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
