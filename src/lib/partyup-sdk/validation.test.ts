import { describe, expect, it } from "vitest";
import {
  validateEndGamePayload,
  validateScore,
  validateSubmitScorePayload,
} from "@/lib/partyup-sdk/validation";

describe("validateScore", () => {
  it("rejects negative scores", () => {
    const result = validateScore(-1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("negative");
  });

  it("rejects non-finite scores", () => {
    const result = validateScore(Number.NaN);
    expect(result.ok).toBe(false);
  });

  it("accepts valid score within limits", () => {
    const result = validateScore(1500, { maxScore: 10_000 });
    expect(result.ok).toBe(true);
  });

  it("rejects scores above max", () => {
    const result = validateScore(99_999, { maxScore: 1000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("above_max");
  });
});

describe("validateEndGamePayload", () => {
  it("rejects invalid duration", () => {
    const result = validateEndGamePayload({
      score: 100,
      durationMs: -1,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts valid end payload", () => {
    const result = validateEndGamePayload({
      score: 500,
      durationMs: 12_000,
    });
    expect(result.ok).toBe(true);
  });
});

describe("validateSubmitScorePayload", () => {
  it("validates score field", () => {
    const result = validateSubmitScorePayload({ score: 42 });
    expect(result.ok).toBe(true);
  });
});
