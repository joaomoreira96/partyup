import type { Locale } from "@/i18n/config";
import type { TriviaQuestion } from "@/games/trivia/types";

export function localizeTriviaQuestion(
  question: TriviaQuestion,
  locale: Locale
): Pick<TriviaQuestion, "q" | "options" | "correct"> {
  if (locale === "en") {
    return {
      q: question.q_en || question.q,
      options: question.options_en || question.options,
      correct: question.correct,
    };
  }
  return {
    q: question.q,
    options: question.options,
    correct: question.correct,
  };
}
