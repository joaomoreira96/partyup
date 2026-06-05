import { describe, expect, it } from "vitest";
import {
  createInitialSnake,
  createInitialState,
  queueDirection,
  randomFoodCell,
  resetForNewRound,
  setPhase,
  tick,
} from "@/games/snake/SnakeEngine";
import { FOOD_SCORE, GRID_SIZE, INITIAL_SNAKE_LENGTH } from "@/games/snake/constants";

describe("SnakeEngine", () => {
  it("creates a centered snake with three segments", () => {
    const snake = createInitialSnake();
    expect(snake).toHaveLength(INITIAL_SNAKE_LENGTH);
    const center = Math.floor(GRID_SIZE / 2);
    expect(snake[0]).toEqual({ x: center, y: center });
  });

  it("ignores opposite direction changes", () => {
    const state = setPhase(createInitialState(), "PLAYING");
    const next = queueDirection(state, "left");
    expect(next.pendingDirection).toBeNull();
  });

  it("increases score when eating food", () => {
    let state = setPhase(createInitialState(), "PLAYING");
    state = {
      ...state,
      snake: [{ x: 5, y: 5 }],
      food: { x: 6, y: 5 },
      direction: "right",
    };

    const result = tick(state);
    expect(result.kind).toBe("playing");
    expect(result.state.score).toBe(FOOD_SCORE);
    expect(result.state.snake).toHaveLength(2);
  });

  it("ends the game on wall collision", () => {
    let state = setPhase(createInitialState(), "PLAYING");
    state = {
      ...state,
      snake: [{ x: GRID_SIZE - 1, y: 10 }],
      direction: "right",
    };

    const result = tick(state);
    expect(result.kind).toBe("game_over");
    expect(result.state.phase).toBe("GAME_OVER");
  });

  it("places food on a free cell", () => {
    const snake = createInitialSnake();
    const food = randomFoodCell(snake);
    const occupied = snake.some((cell) => cell.x === food.x && cell.y === food.y);
    expect(occupied).toBe(false);
  });

  it("resets state for a new round", () => {
    const state = resetForNewRound();
    expect(state.phase).toBe("READY");
    expect(state.score).toBe(0);
    expect(state.snake).toHaveLength(INITIAL_SNAKE_LENGTH);
  });
});
