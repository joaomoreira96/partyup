import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ username: string }>;
}

/** Redireciona para o perfil público canónico */
export default async function LegacyPublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  redirect(`/players/${username}`);
}
