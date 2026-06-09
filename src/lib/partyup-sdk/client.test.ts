import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createPartyUpSDK } from "@/lib/partyup-sdk/client";
import { PartyUpSdkError } from "@/lib/partyup-sdk/types";

describe("PartyUpSDK", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("transitions lifecycle on construction", () => {
    const states: string[] = [];
    const sdk = createPartyUpSDK({
      gameId: "g1",
      gameSlug: "memoria-classica",
      moduleId: "memory",
      user: { displayName: "Test", isGuest: true },
      onLifecycleChange: (s) => states.push(s),
    });

    expect(sdk.getLifecycleState()).toBe("READY");
    expect(states).toContain("LOAD");
    expect(states).toContain("READY");
  });

  it("forbids games from creating rooms", async () => {
    const sdk = createPartyUpSDK({
      gameId: "g1",
      gameSlug: "memoria-classica",
      moduleId: "memory",
      user: { displayName: "Test", isGuest: false, id: "u1" },
    });

    await expect(sdk.createRoom()).rejects.toBeInstanceOf(PartyUpSdkError);
  });

  it("rejects invalid submitScore", async () => {
    const sdk = createPartyUpSDK({
      gameId: "g1",
      gameSlug: "memoria-classica",
      moduleId: "memory",
      user: { displayName: "Test", isGuest: false, id: "u1" },
      maxScore: 1000,
    });

    await expect(sdk.submitScore({ score: -5 })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("reportScore updates UI without calling the API", () => {
    const scores: number[] = [];
    const sdk = createPartyUpSDK({
      gameId: "g1",
      gameSlug: "snake",
      moduleId: "snake",
      user: { displayName: "Test", isGuest: false, id: "u1" },
      onScoreUpdate: (score) => scores.push(score),
    });

    sdk.reportScore(3);
    sdk.reportScore(7);

    expect(scores).toEqual([3, 7]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls startGame API and moves to PLAYING", async () => {
    const sdk = createPartyUpSDK({
      gameId: "g1",
      gameSlug: "memoria-classica",
      moduleId: "memory",
      user: { displayName: "Test", isGuest: true },
    });

    await sdk.startGame();
    expect(sdk.getLifecycleState()).toBe("PLAYING");
    expect(fetch).toHaveBeenCalledWith(
      "/api/sdk/game/start",
      expect.objectContaining({ method: "POST" })
    );
  });
});
