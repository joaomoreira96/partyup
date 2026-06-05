import { createRoot } from "react-dom/client";
import { createElement } from "react";
import type { GameModule, GameMountContext } from "@/lib/games/types";
import { snakeConfig } from "@/games/snake/config";
import { Game } from "@/games/snake/Game";

const game: GameModule = {
  id: "snake",
  config: snakeConfig,
  mount(ctx: GameMountContext) {
    const root = createRoot(ctx.container);
    root.render(
      createElement(Game, {
        sdk: ctx.sdk,
        gameId: ctx.sdk.getGameId(),
        userId: ctx.userId,
        isGuest: ctx.isGuest,
      })
    );

    return () => {
      queueMicrotask(() => {
        root.unmount();
      });
    };
  },
};

export default game;
