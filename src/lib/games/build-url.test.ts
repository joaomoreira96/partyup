import { describe, expect, it } from "vitest";
import { getBuildOrigin, getGameBuildsPublicUrl } from "@/lib/games/build-url";

describe("build-url", () => {
  it("builds public storage URL", () => {
    const url = getGameBuildsPublicUrl("partyup-sandbox/1.0.0/build/index.html");
    expect(url).toContain("/storage/v1/object/public/game-builds/partyup-sandbox/1.0.0/build/index.html");
  });

  it("extracts origin from build URL", () => {
    const origin = getBuildOrigin("https://example.supabase.co/storage/v1/object/public/game-builds/x/index.html");
    expect(origin).toBe("https://example.supabase.co");
  });
});
