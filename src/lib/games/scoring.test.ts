import { describe, expect, it } from "vitest";
import { TRIVIA_POOL_SIZE, TRIVIA_QUESTIONS_PER_GAME } from "@/games/trivia/constants";
import { pickTriviaQuestions } from "@/games/trivia/pick-questions";
import { TRIVIA_QUESTION_POOL } from "@/games/trivia/questions";
import { memoryScore, reactionScore, triviaScore } from "@/lib/games/scoring";

describe("game scoring", () => {
  it("reactionScore matches duel scale", () => {
    expect(reactionScore(200)).toBe(200);
    expect(reactionScore(500)).toBe(125);
  });

  it("memoryScore rewards fast perfect runs", () => {
    expect(memoryScore({ moves: 6, durationMs: 15_000, pairCount: 6 })).toBeGreaterThan(200);
    expect(memoryScore({ moves: 15, durationMs: 90_000, pairCount: 6 })).toBeLessThan(100);
  });

  it("triviaScore scales correct answers and speed", () => {
    expect(
      triviaScore({ correct: 10, total: 10, durationMs: 30_000 })
    ).toBeGreaterThan(220);
    expect(triviaScore({ correct: 4, total: 10, durationMs: 60_000 })).toBeLessThan(120);
  });
});

describe("trivia question pool", () => {
  it("has 200 questions in the pool", () => {
    expect(TRIVIA_QUESTION_POOL).toHaveLength(TRIVIA_POOL_SIZE);
  });

  it("picks 10 unique questions per session", () => {
    const picked = pickTriviaQuestions(TRIVIA_QUESTION_POOL, TRIVIA_QUESTIONS_PER_GAME);
    expect(picked).toHaveLength(TRIVIA_QUESTIONS_PER_GAME);
    expect(new Set(picked.map((q) => q.q)).size).toBe(TRIVIA_QUESTIONS_PER_GAME);
  });
});
