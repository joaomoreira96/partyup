import type { GameModule, GameMountContext } from "@/lib/games/types";
import { reactionConfig } from "@/games/reaction/config";

const game: GameModule = {
  id: "reaction",
  config: reactionConfig,
  mount(ctx: GameMountContext) {
    const { container, sdk } = ctx;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let startWait = 0;
    let state: "idle" | "waiting" | "ready" | "done" = "idle";

    container.innerHTML = "";
    container.className =
      "flex flex-col items-center gap-4 w-full max-w-md mx-auto touch-manipulation";

    const panel = document.createElement("button");
    panel.type = "button";
    panel.className =
      "w-full min-h-[200px] rounded-xl border-2 font-semibold text-lg transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none";
    panel.setAttribute("aria-describedby", "reaction-hint");

    const hint = document.createElement("p");
    hint.id = "reaction-hint";
    hint.className = "text-center text-muted-foreground text-sm";
    hint.textContent =
      "Clica para começar. Espera pelo verde e reage o mais rápido possível.";

    const live = document.createElement("p");
    live.className = "sr-only";
    live.setAttribute("aria-live", "polite");

    function setPanel(color: string, label: string) {
      panel.style.backgroundColor = color;
      panel.textContent = label;
      live.textContent = label;
    }

    function cleanupTimers() {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
    }

    function startRound() {
      cleanupTimers();
      state = "waiting";
      setPanel("#334155", "Espera...");
      panel.disabled = false;
      const delay = 1500 + Math.random() * 3000;

      timeoutId = setTimeout(() => {
        state = "ready";
        startWait = Date.now();
        setPanel("#22c55e", "CLICA!");
      }, delay);
    }

    void sdk.startGame();

    panel.addEventListener("click", () => {
      if (state === "idle" || state === "done") {
        state = "waiting";
        startRound();
        return;
      }

      if (state === "waiting") {
        cleanupTimers();
        state = "done";
        setPanel("#ef4444", "Cedo demais! Clica para tentar de novo.");
        return;
      }

      if (state === "ready") {
        const reactionMs = Date.now() - startWait;
        state = "done";
        cleanupTimers();
        setPanel("#8b5cf6", `${reactionMs} ms`);
        void sdk.endGame({
          score: reactionMs,
          durationMs: reactionMs,
          metric: "time",
          achievementHints: reactionMs < 300 ? ["SPEED_RUN"] : undefined,
        });
        hint.textContent =
          "Menor tempo = melhor. Regista-te para o ranking oficial.";
      }
    });

    setPanel("#64748b", "Clica para começar");
    container.append(panel, hint, live);

    return () => {
      cleanupTimers();
      container.innerHTML = "";
    };
  },
};

export default game;
