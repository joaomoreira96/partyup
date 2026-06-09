import { describe, expect, it } from "vitest";
import { validateScoreForServer } from "@/services/score-validation.service";

describe("validateScoreForServer", () => {
  it("rejects negative scores", () => {
    const result = validateScoreForServer({
      score: -10,
      durationMs: 1000,
    });
    expect(result.outcome).toBe("hard_reject");
  });

  it("rejects impossible memory scores", () => {
    const result = validateScoreForServer({
      score: 999,
      durationMs: 5000,
      moduleId: "memory",
      metric: "score",
    });
    expect(result.outcome).toBe("hard_reject");
    expect(result.error).toBe("impossible_score");
  });

  it("accepts valid reaction points", () => {
    const result = validateScoreForServer({
      score: 180,
      durationMs: 280,
      moduleId: "reaction",
      metric: "score",
    });
    expect(result.outcome).toBe("valid");
  });

  it("rejects sub-10ms reaction time", () => {
    const result = validateScoreForServer({
      score: 5,
      durationMs: 500,
      moduleId: "reaction",
      metric: "time",
    });
    expect(result.outcome).toBe("hard_reject");
  });

  it("rejects impossible click-frenzy burst", () => {
    const result = validateScoreForServer({
      score: 2500,
      durationMs: 10_000,
      moduleId: "click-frenzy",
    });
    expect(result.outcome).toBe("hard_reject");
  });
});
