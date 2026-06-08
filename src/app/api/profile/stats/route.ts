import { NextResponse } from "next/server";
import { getSessionUser } from "@/services/auth.service";
import { getProfileStatsSummary } from "@/services/stats.service";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getProfileStatsSummary(user.id);
  return NextResponse.json(summary);
}
