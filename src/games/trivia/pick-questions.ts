import type { TriviaQuestion } from "@/games/trivia/types";

type PickableQuestion = Pick<TriviaQuestion, "q" | "options" | "correct">;

/** Seleciona `count` perguntas aleatórias sem repetição (Fisher–Yates parcial). */
export function pickTriviaQuestions<T extends PickableQuestion>(
  pool: readonly T[],
  count: number
): T[] {
  if (count <= 0 || pool.length === 0) return [];
  const take = Math.min(count, pool.length);
  const copy = [...pool];

  for (let i = copy.length - 1; i > copy.length - take - 1; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.slice(copy.length - take);
}
