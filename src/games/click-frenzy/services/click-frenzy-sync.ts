import { getGuestName } from "@/lib/guest";
import type { ClickFrenzyMetadata } from "@/lib/rooms/click-frenzy-state";

type ActionResponse = {
  ok?: boolean;
  error?: string;
  detail?: string;
  playUrl?: string;
  metadata?: ClickFrenzyMetadata;
};

async function postAction(
  body: Record<string, unknown>
): Promise<{ ok: boolean; data: ActionResponse }> {
  try {
    const res = await fetch("/api/games/click-frenzy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as ActionResponse;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "network" } };
  }
}

export function startClickFrenzy(code: string, playerId: string | null) {
  return postAction({
    code,
    action: "start",
    playerId,
    guestName: getGuestName(),
  });
}

export function submitClickFrenzyScore(
  code: string,
  playerId: string,
  clicks: number,
  lastClickAt: number
) {
  return postAction({
    code,
    action: "submit",
    playerId,
    clicks,
    lastClickAt,
  });
}

export function finishClickFrenzy(code: string) {
  return postAction({ code, action: "finish" });
}

export function resetClickFrenzy(code: string) {
  return postAction({ code, action: "reset" });
}
