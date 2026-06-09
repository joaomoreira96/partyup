import { describe, expect, it } from "vitest";
import { validateScoreForServer } from "@/services/score-validation.service";

describe("validateScoreForServer", () => {
  it("rejects negative scores", () => {
    const result = validateScoreForServer({
      score: -10,
      durationMs: 1000,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects impossible memory scores", () => {
    const result = validateScoreForServer({
      score: 999,
      durationMs: 5000,
      moduleId: "memory",
      metric: "score",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("impossible_score");
  });

  it("accepts valid reaction points", () => {
    const result = validateScoreForServer({
      score: 180,
      durationMs: 280,
      moduleId: "reaction",
      metric: "score",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects reaction score above module limit", () => {
    const result = validateScoreForServer({
      score: 500,
      durationMs: 500,
      moduleId: "reaction",
      metric: "score",
    });
    expect(result.valid).toBe(false);
  });
});
