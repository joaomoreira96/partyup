import {
  FOOD_SCORE,
  GRID_SIZE,
  INITIAL_SNAKE_LENGTH,
  INITIAL_TICK_MS,
  MIN_TICK_MS,
  TICK_DECREASE_PER_FOOD,
} from "@/games/snake/constants";
import type { Cell, Direction, GamePhase, SnakeGameState } from "@/games/snake/types";

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function cellsEqual(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

function isOpposite(a: Direction, b: Direction): boolean {
  return OPPOSITE[a] === b;
}

export function createInitialSnake(): Cell[] {
  const center = Math.floor(GRID_SIZE / 2);
  return Array.from({ length: INITIAL_SNAKE_LENGTH }, (_, index) => ({
    x: center - index,
    y: center,
  }));
}

export function randomFoodCell(snake: Cell[]): Cell {
  const occupied = new Set(snake.map((cell) => `${cell.x},${cell.y}`));
  const free: Cell[] = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) free.push({ x, y });
    }
  }

  if (free.length === 0) {
    return { x: 0, y: 0 };
  }

  return free[Math.floor(Math.random() * free.length)]!;
}

export function createInitialState(): SnakeGameState {
  const snake = createInitialSnake();
  return {
    phase: "IDLE",
    snake,
    direction: "right",
    pendingDirection: null,
    food: randomFoodCell(snake),
    score: 0,
    tickMs: INITIAL_TICK_MS,
    foodsEaten: 0,
  };
}

export function setPhase(state: SnakeGameState, phase: GamePhase): SnakeGameState {
  return { ...state, phase };
}

export function queueDirection(
  state: SnakeGameState,
  next: Direction
): SnakeGameState {
  if (state.phase !== "PLAYING") return state;

  const current = state.pendingDirection ?? state.direction;
  if (isOpposite(current, next)) return state;

  return { ...state, pendingDirection: next };
}

function stepHead(head: Cell, direction: Direction): Cell {
  switch (direction) {
    case "up":
      return { x: head.x, y: head.y - 1 };
    case "down":
      return { x: head.x, y: head.y + 1 };
    case "left":
      return { x: head.x - 1, y: head.y };
    case "right":
      return { x: head.x + 1, y: head.y };
  }
}

function isOutOfBounds(cell: Cell): boolean {
  return cell.x < 0 || cell.y < 0 || cell.x >= GRID_SIZE || cell.y >= GRID_SIZE;
}

export type TickResult =
  | { kind: "playing"; state: SnakeGameState }
  | { kind: "game_over"; state: SnakeGameState };

export function tick(state: SnakeGameState): TickResult {
  if (state.phase !== "PLAYING") {
    return { kind: "playing", state };
  }

  const direction = state.pendingDirection ?? state.direction;
  const head = state.snake[0]!;
  const nextHead = stepHead(head, direction);

  if (isOutOfBounds(nextHead)) {
    return {
      kind: "game_over",
      state: { ...state, direction, pendingDirection: null, phase: "GAME_OVER" },
    };
  }

  const willEat = cellsEqual(nextHead, state.food);
  const bodyToCheck = willEat ? state.snake : state.snake.slice(0, -1);
  if (bodyToCheck.some((segment) => cellsEqual(segment, nextHead))) {
    return {
      kind: "game_over",
      state: { ...state, direction, pendingDirection: null, phase: "GAME_OVER" },
    };
  }

  const snake = [nextHead, ...state.snake];
  if (!willEat) {
    snake.pop();
  }

  if (!willEat) {
    return {
      kind: "playing",
      state: {
        ...state,
        snake,
        direction,
        pendingDirection: null,
      },
    };
  }

  const foodsEaten = state.foodsEaten + 1;
  const score = state.score + FOOD_SCORE;
  const tickMs = Math.max(
    MIN_TICK_MS,
    state.tickMs - TICK_DECREASE_PER_FOOD
  );

  return {
    kind: "playing",
    state: {
      ...state,
      snake,
      direction,
      pendingDirection: null,
      food: randomFoodCell(snake),
      score,
      foodsEaten,
      tickMs,
    },
  };
}

export function resetForNewRound(): SnakeGameState {
  const snake = createInitialSnake();
  return {
    phase: "READY",
    snake,
    direction: "right",
    pendingDirection: null,
    food: randomFoodCell(snake),
    score: 0,
    tickMs: INITIAL_TICK_MS,
    foodsEaten: 0,
  };
}
