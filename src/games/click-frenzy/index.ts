import { createRoot } from "react-dom/client";
import { createElement } from "react";
import type { GameModule, GameMountContext } from "@/lib/games/types";
import { clickFrenzyConfig } from "@/games/click-frenzy/config";
import { Game } from "@/games/click-frenzy/Game";

const game: GameModule = {
  id: "click-frenzy",
  config: clickFrenzyConfig,
  mount(ctx: GameMountContext) {
    const roomCode = ctx.roomId ?? "";

    const root = createRoot(ctx.container);
    root.render(
      createElement(Game, {
        roomCode,
        gameId: ctx.sdk.getGameId(),
        userId: ctx.userId,
        isGuest: ctx.isGuest,
        sdk: ctx.sdk,
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
