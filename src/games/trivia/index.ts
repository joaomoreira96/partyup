import type { GameModule, GameMountContext } from "@/lib/games/types";
import { createGameMountI18n } from "@/lib/games/mount-i18n";
import { TRIVIA_QUESTIONS_PER_GAME } from "@/games/trivia/constants";
import { triviaConfig } from "@/games/trivia/config";
import { localizeTriviaQuestion } from "@/games/trivia/localize-question";
import { pickTriviaQuestions } from "@/games/trivia/pick-questions";
import { TRIVIA_QUESTION_POOL } from "@/games/trivia/questions";
import type { TriviaQuestion, TriviaWrongAnswer } from "@/games/trivia/types";
import { triviaScore } from "@/lib/games/scoring";

type LocalizedQuestion = Pick<TriviaQuestion, "q" | "options" | "correct">;

function renderWrongAnswerReview(
  container: HTMLElement,
  wrongAnswers: TriviaWrongAnswer[],
  t: ReturnType<typeof createGameMountI18n>["t"]
) {
  if (wrongAnswers.length === 0) {
    const perfect = document.createElement("p");
    perfect.className = "text-sm text-muted-foreground";
    perfect.textContent = t("gameModules.trivia.reviewPerfect");
    container.appendChild(perfect);
    return;
  }

  const heading = document.createElement("h3");
  heading.className = "text-base font-semibold";
  heading.textContent = t("gameModules.trivia.reviewTitle");

  const hint = document.createElement("p");
  hint.className = "mt-1 text-sm text-muted-foreground";
  hint.textContent = t("gameModules.trivia.reviewHint");

  const list = document.createElement("ul");
  list.className =
    "mt-3 flex max-h-[min(52vh,22rem)] flex-col gap-3 overflow-y-auto overscroll-contain pr-1 -mr-1";
  list.setAttribute("aria-label", t("gameModules.trivia.reviewListAria"));

  wrongAnswers.forEach(({ question, pickedIndex }, reviewIndex) => {
    const item = document.createElement("li");
    item.className = "rounded-xl border border-border bg-muted/30 p-3 sm:p-4 text-sm";

    const q = document.createElement("p");
    q.className = "font-medium leading-snug";
    q.textContent = `${reviewIndex + 1}. ${question.q}`;

    const wrong = document.createElement("p");
    wrong.className = "mt-2 text-destructive";
    wrong.innerHTML = `<span class="font-normal text-muted-foreground">${t("gameModules.trivia.yourAnswer")} </span>${question.options[pickedIndex]}`;

    const right = document.createElement("p");
    right.className = "mt-1 font-medium text-emerald-600 dark:text-emerald-400";
    right.innerHTML = `<span class="font-normal text-muted-foreground">${t("gameModules.trivia.correctAnswer")} </span>${question.options[question.correct]}`;

    item.append(q, wrong, right);
    list.appendChild(item);
  });

  container.append(heading, hint, list);
}

const game: GameModule = {
  id: "trivia",
  config: triviaConfig,
  mount(ctx: GameMountContext) {
    const { container, sdk, locale } = ctx;
    const { t } = createGameMountI18n(locale);

    const pool = TRIVIA_QUESTION_POOL.map((q) =>
      localizeTriviaQuestion(q, locale)
    );
    const questions: LocalizedQuestion[] = pickTriviaQuestions(
      pool,
      TRIVIA_QUESTIONS_PER_GAME
    );
    const total = questions.length;

    let index = 0;
    let correctCount = 0;
    const wrongAnswers: Array<{ question: LocalizedQuestion; pickedIndex: number }> = [];
    const startTime = Date.now();

    container.innerHTML = "";
    container.className =
      "flex w-full max-w-lg flex-col gap-4 px-1 touch-manipulation sm:px-0";

    const progress = document.createElement("p");
    progress.className = "text-sm text-muted-foreground";
    progress.setAttribute("aria-live", "polite");

    const questionEl = document.createElement("h2");
    questionEl.className = "text-base font-semibold leading-snug sm:text-lg";

    const optionsEl = document.createElement("div");
    optionsEl.className = "flex flex-col gap-2 sm:gap-2.5";
    optionsEl.setAttribute("role", "group");
    optionsEl.setAttribute("aria-label", t("gameModules.trivia.optionsAria"));

    const reviewEl = document.createElement("div");
    reviewEl.className = "hidden";

    void sdk.startGame();

    function renderResults() {
      const durationMs = Date.now() - startTime;
      const finalScore = triviaScore({
        correct: correctCount,
        total,
        durationMs,
      });

      progress.textContent = t("gameModules.trivia.gameOver");
      questionEl.textContent = t("gameModules.trivia.scoreSummary", {
        correct: correctCount,
        total,
        score: finalScore,
      });
      optionsEl.innerHTML = "";
      optionsEl.className = "hidden";
      reviewEl.className = "block";
      reviewEl.innerHTML = "";
      renderWrongAnswerReview(reviewEl, wrongAnswers, t);

      void sdk.endGame({
        score: finalScore,
        durationMs,
        metric: "score",
        achievementHints:
          correctCount === total ? ["PERFECT_SCORE", "FIRST_WIN"] : ["FIRST_WIN"],
      });
    }

    function renderQuestion() {
      reviewEl.className = "hidden";
      optionsEl.className = "flex flex-col gap-2 sm:gap-2.5";

      const current = questions[index];
      progress.textContent = t("gameModules.trivia.progress", {
        current: index + 1,
        total,
      });
      questionEl.textContent = current.q;
      optionsEl.innerHTML = "";

      current.options.forEach((opt, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "min-h-11 rounded-xl border px-4 py-3 text-left text-sm sm:text-base transition-colors hover:bg-accent active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100 touch-manipulation";
        btn.textContent = opt;
        btn.addEventListener("click", () => {
          if (i !== current.correct) {
            wrongAnswers.push({ question: current, pickedIndex: i });
          } else {
            correctCount += 1;
          }

          index += 1;
          sdk.reportScore(
            triviaScore({
              correct: correctCount,
              total,
              durationMs: Date.now() - startTime,
            })
          );

          if (index >= total) {
            renderResults();
          } else {
            renderQuestion();
          }
        });
        optionsEl.appendChild(btn);
      });
    }

    container.append(progress, questionEl, optionsEl, reviewEl);
    renderQuestion();

    return () => {
      container.innerHTML = "";
    };
  },
};

export default game;
