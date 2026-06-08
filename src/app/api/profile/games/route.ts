import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { getProfileGames } from "@/services/stats.service";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const games = await getProfileGames(user.id);
  return NextResponse.json(games);
}
