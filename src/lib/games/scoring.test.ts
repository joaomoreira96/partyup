import { describe, expect, it } from "vitest";
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
      triviaScore({ correct: 5, total: 5, durationMs: 30_000 })
    ).toBeGreaterThan(220);
    expect(triviaScore({ correct: 2, total: 5, durationMs: 60_000 })).toBeLessThan(120);
  });
});
