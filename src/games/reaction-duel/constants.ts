export const REACTION_DUEL_SLUG = "reaction-duel";

export const COPY = {
  title: "Reaction Duel",
  waiting: "À espera do adversário...",
  countdown: "Prepara-te",
  red: "Espera...",
  green: "CLICK NOW!",
  clicked: "Clicaste!",
  clickedHint: "À espera dos outros jogadores…",
  tooEarly: "Too Early",
  results: "Resultados",
  winner: "Vencedor",
  you: "Tu",
  opponent: "Adversário",
  playAgain: "Jogar Novamente",
  backToCatalog: "Voltar ao Catálogo",
  noRoom: "Entra numa sala multiplayer para jogar.",
} as const;

export function clickedProgress(submitted: number, needed: number): string {
  return `À espera dos outros jogadores… (${submitted}/${needed})`;
}
