import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Profile } from "@/types/platform";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileHeader({
  profile,
  subtitle,
}: {
  profile: Pick<Profile, "display_name" | "username" | "avatar_url" | "bio">;
  subtitle?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:text-left">
      <Avatar className="size-20 ring-2 ring-primary/30 sm:size-24">
        <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="bg-secondary text-lg text-secondary-foreground">
          {initials(profile.display_name || "PU")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h1 className="text-2xl font-bold sm:text-3xl">{profile.display_name}</h1>
        <p
          className={
            profile.username
              ? "mt-1 font-medium text-primary"
              : "mt-1 text-sm text-amber-600 dark:text-amber-400"
          }
        >
          {profile.username ? (
            <>@{profile.username}</>
          ) : (
            <>Tag de jogador por definir — configura abaixo</>
          )}
        </p>
        {profile.bio && (
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">{profile.bio}</p>
        )}
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
