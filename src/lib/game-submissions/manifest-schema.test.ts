import { describe, expect, it } from "vitest";
import { parseGameManifest } from "@/lib/game-submissions/manifest-schema";

describe("parseGameManifest", () => {
  it("accepts a valid manifest", () => {
    const result = parseGameManifest({
      name: "PartyUp Sandbox",
      slug: "partyup-sandbox",
      version: "1.0.0",
      author: "PartyUp",
      description: "Test game",
      sdkVersion: "1.0",
      minPlayers: 1,
      maxPlayers: 1,
      supportsDesktop: true,
      supportsTablet: true,
      supportsMobile: true,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects unsupported sdkVersion", () => {
    const result = parseGameManifest({
      name: "X",
      slug: "x",
      version: "1.0.0",
      author: "A",
      sdkVersion: "9.0",
      minPlayers: 1,
      maxPlayers: 1,
      supportsDesktop: true,
      supportsTablet: true,
      supportsMobile: true,
    });

    expect(result.ok).toBe(false);
  });
});
