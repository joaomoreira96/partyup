import type { GameModule, GameMountContext } from "@/lib/games/types";
import { memoryConfig } from "@/games/memory/config";
import { memoryScore } from "@/lib/games/scoring";

const EMOJIS = ["🎮", "🎯", "🎲", "🎪", "🎨", "🎭", "🎸", "🎺"];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const game: GameModule = {
  id: "memory",
  config: memoryConfig,
  mount(ctx: GameMountContext) {
    const { container, sdk } = ctx;
    const startTime = Date.now();
    let moves = 0;
    let matched = 0;
    let first: HTMLButtonElement | null = null;
    let locked = false;
    let started = false;

    const pairs = shuffle(EMOJIS.slice(0, 6));
    const deck = shuffle([...pairs, ...pairs]);

    container.innerHTML = "";
    container.className =
      "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 max-w-md mx-auto w-full touch-manipulation";

    const status = document.createElement("p");
    status.className = "sr-only";
    status.setAttribute("aria-live", "polite");
    container.parentElement?.prepend(status);

    void sdk.startGame().then(() => {
      started = true;
      status.textContent = "Jogo de memória iniciado. Encontra os pares.";
    });

    function currentScore() {
      return memoryScore({
        moves,
        durationMs: Date.now() - startTime,
        pairCount: pairs.length,
      });
    }

    function updateScore() {
      const score = currentScore();
      void sdk.submitScore({ score }).catch(() => {
        sdk.emit("SCORE_SUBMITTED", { score, pending: true });
      });
    }

    deck.forEach((emoji, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "aspect-square rounded-xl border-2 border-primary/20 bg-card text-2xl font-bold transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100";
      btn.setAttribute("aria-label", `Carta ${index + 1}, virada`);
      btn.dataset.emoji = emoji;
      btn.textContent = "?";

      btn.addEventListener("click", () => {
        if (!started || locked || btn.classList.contains("matched") || btn === first)
          return;

        btn.textContent = emoji;
        btn.setAttribute("aria-label", `Carta ${index + 1}, ${emoji}`);

        if (!first) {
          first = btn;
          return;
        }

        locked = true;
        moves += 1;

        if (first.dataset.emoji === btn.dataset.emoji) {
          btn.classList.add("matched", "border-primary");
          first.classList.add("matched", "border-primary");
          matched += 1;
          first = null;
          locked = false;
          updateScore();

          if (matched === pairs.length) {
            const durationMs = Date.now() - startTime;
            const finalScore = memoryScore({
              moves,
              durationMs,
              pairCount: pairs.length,
            });
            status.textContent = `Vitória em ${moves} jogadas! ${finalScore} pontos.`;
            void sdk.endGame({
              score: finalScore,
              durationMs,
              metric: "score",
              achievementHints: ["FIRST_WIN"],
            });
          }
        } else {
          setTimeout(() => {
            btn.textContent = "?";
            btn.setAttribute("aria-label", `Carta ${index + 1}, virada`);
            if (first) {
              first.textContent = "?";
              first.setAttribute("aria-label", "Carta virada");
            }
            first = null;
            locked = false;
          }, 700);
        }
      });

      container.appendChild(btn);
    });

    return () => {
      container.innerHTML = "";
      status.remove();
    };
  },
};

export default game;
