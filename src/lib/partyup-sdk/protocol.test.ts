import { describe, expect, it } from "vitest";
import {
  isPartyUpSdkMessage,
  parsePartyUpSdkMessage,
  PARTYUP_SDK_SOURCE,
} from "@/lib/partyup-sdk/protocol";

describe("partyup-sdk protocol", () => {
  it("accepts valid SDK messages", () => {
    const msg = {
      source: PARTYUP_SDK_SOURCE,
      type: "READY",
      payload: {},
    };
    expect(isPartyUpSdkMessage(msg)).toBe(true);
    expect(parsePartyUpSdkMessage(msg)).toEqual(msg);
  });

  it("rejects foreign messages", () => {
    expect(isPartyUpSdkMessage(null)).toBe(false);
    expect(isPartyUpSdkMessage({ source: "other", type: "READY" })).toBe(false);
    expect(parsePartyUpSdkMessage({ foo: 1 })).toBeNull();
  });
});
