export type Direction = "up" | "down" | "left" | "right";

export type GamePhase = "IDLE" | "READY" | "PLAYING" | "PAUSED" | "GAME_OVER";

export type Cell = {
  x: number;
  y: number;
};

export type SnakeGameState = {
  phase: GamePhase;
  snake: Cell[];
  direction: Direction;
  pendingDirection: Direction | null;
  food: Cell;
  score: number;
  tickMs: number;
  foodsEaten: number;
};

export type SnakeSnapshot = SnakeGameState & {
  gridSize: number;
};
