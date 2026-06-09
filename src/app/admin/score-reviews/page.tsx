import { ScoreReviewManager } from "@/features/admin/components/score-review-manager";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Score Reviews",
  path: "/admin/score-reviews",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default function AdminScoreReviewsPage() {
  return <ScoreReviewManager />;
}
