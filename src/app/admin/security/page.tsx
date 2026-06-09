import { SecurityOverviewPanel } from "@/features/admin/components/security-overview";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Segurança",
  path: "/admin/security",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default function AdminSecurityPage() {
  return (
    <div>
      <h2 className="text-lg font-semibold">Security Overview</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Monitorização de abuso, rate limits e flags automáticas.
      </p>
      <div className="mt-6">
        <SecurityOverviewPanel />
      </div>
    </div>
  );
}
