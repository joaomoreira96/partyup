export interface TriviaQuestion {
  q: string;
  q_en: string;
  options: [string, string, string, string];
  options_en: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
}

export type TriviaWrongAnswer = {
  question: Pick<TriviaQuestion, "q" | "options" | "correct">;
  pickedIndex: number;
};
