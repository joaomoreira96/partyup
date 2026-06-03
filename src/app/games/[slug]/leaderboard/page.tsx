import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyLeaderboardRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/rankings/${slug}`);
}
