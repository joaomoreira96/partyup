import type { GameModule, GameMountContext } from "@/lib/games/types";
import { createGameMountI18n } from "@/lib/games/mount-i18n";
import { reactionConfig } from "@/games/reaction/config";
import { reactionScore } from "@/lib/games/scoring";

const game: GameModule = {
  id: "reaction",
  config: reactionConfig,
  mount(ctx: GameMountContext) {
    const { container, sdk, locale } = ctx;
    const { t } = createGameMountI18n(locale);
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
    hint.textContent = t("gameModules.reaction.hint");

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
      setPanel("#334155", t("gameModules.reaction.wait"));
      panel.disabled = false;
      const delay = 1500 + Math.random() * 3000;

      timeoutId = setTimeout(() => {
        state = "ready";
        startWait = Date.now();
        setPanel("#22c55e", t("gameModules.reaction.click"));
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
        setPanel("#ef4444", t("gameModules.reaction.tooEarly"));
        return;
      }

      if (state === "ready") {
        const reactionMs = Date.now() - startWait;
        const points = reactionScore(reactionMs);
        state = "done";
        cleanupTimers();
        setPanel(
          "#8b5cf6",
          t("gameModules.reaction.pointsMs", { points, ms: reactionMs })
        );
        void sdk.endGame({
          score: points,
          durationMs: reactionMs,
          metric: "score",
          achievementHints: reactionMs < 300 ? ["SPEED_RUN"] : undefined,
        });
        hint.textContent = t("gameModules.reaction.resultHint");
      }
    });

    setPanel("#64748b", t("gameModules.reaction.clickToStart"));
    container.append(panel, hint, live);

    return () => {
      cleanupTimers();
      container.innerHTML = "";
    };
  },
};

export default game;
