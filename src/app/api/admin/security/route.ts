import { NextResponse } from "next/server";
import { isAdmin } from "@/services/auth.service";
import {
  getSecurityOverview,
  listFlaggedUsers,
} from "@/services/admin-security.service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
  }

  const [overview, flags] = await Promise.all([
    getSecurityOverview(),
    listFlaggedUsers(),
  ]);

  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentEvents } = await supabase
    .from("security_events")
    .select("id, event_type, severity, user_id, created_at, metadata")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    overview,
    flags,
    recentEvents: recentEvents ?? [],
  });
}
