import type { GameModule, GameMountContext } from "@/lib/games/types";
import { triviaConfig } from "@/games/trivia/config";
import { triviaScore } from "@/lib/games/scoring";

const QUESTIONS = [
  {
    q: "Qual é a capital de Portugal?",
    options: ["Porto", "Lisboa", "Coimbra", "Faro"],
    correct: 1,
  },
  {
    q: "Quantos planetas tem o Sistema Solar?",
    options: ["7", "8", "9", "10"],
    correct: 1,
  },
  {
    q: "Em que ano foi descoberto o Brasil?",
    options: ["1492", "1500", "1510", "1600"],
    correct: 1,
  },
  {
    q: "Qual linguagem corre no browser?",
    options: ["Python", "JavaScript", "C++", "Rust"],
    correct: 1,
  },
  {
    q: "O PartyUp é uma...",
    options: ["Loja", "Plataforma de jogos", "Rede social", "App nativa"],
    correct: 1,
  },
];

const game: GameModule = {
  id: "trivia",
  config: triviaConfig,
  mount(ctx: GameMountContext) {
    const { container, sdk } = ctx;
    let index = 0;
    let correctCount = 0;
    const startTime = Date.now();

    container.innerHTML = "";
    container.className =
      "flex flex-col gap-4 w-full max-w-lg mx-auto touch-manipulation";

    const progress = document.createElement("p");
    progress.className = "text-sm text-muted-foreground";
    progress.setAttribute("aria-live", "polite");

    const questionEl = document.createElement("h2");
    questionEl.className = "text-lg font-semibold";

    const optionsEl = document.createElement("div");
    optionsEl.className = "flex flex-col gap-2";
    optionsEl.setAttribute("role", "group");
    optionsEl.setAttribute("aria-label", "Opções de resposta");

    void sdk.startGame();

    function render() {
      if (index >= QUESTIONS.length) {
        const durationMs = Date.now() - startTime;
        const finalScore = triviaScore({
          correct: correctCount,
          total: QUESTIONS.length,
          durationMs,
        });
        questionEl.textContent = `Fim! ${correctCount}/${QUESTIONS.length} corretas · ${finalScore} pontos`;
        optionsEl.innerHTML = "";
        void sdk.endGame({
          score: finalScore,
          durationMs,
          metric: "score",
          achievementHints:
            correctCount === QUESTIONS.length
              ? ["PERFECT_SCORE", "FIRST_WIN"]
              : ["FIRST_WIN"],
        });
        return;
      }

      const current = QUESTIONS[index];
      progress.textContent = `Pergunta ${index + 1} de ${QUESTIONS.length}`;
      questionEl.textContent = current.q;
      optionsEl.innerHTML = "";

      current.options.forEach((opt, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none";
        btn.textContent = opt;
        btn.addEventListener("click", () => {
          if (i === current.correct) correctCount += 1;
          index += 1;
          const liveScore = triviaScore({
            correct: correctCount,
            total: QUESTIONS.length,
            durationMs: Date.now() - startTime,
          });
          void sdk.submitScore({ score: liveScore }).catch(() => undefined);
          render();
        });
        optionsEl.appendChild(btn);
      });
    }

    container.append(progress, questionEl, optionsEl);
    render();

    return () => {
      container.innerHTML = "";
    };
  },
};

export default game;
