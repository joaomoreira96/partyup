import { Calendar, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  formatMemberSince,
} from "@/services/public-profile.service";
import type { Profile } from "@/types/platform";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PublicProfileHeader({
  profile,
  showCountry,
}: {
  profile: Profile;
  showCountry: boolean;
}) {
  const memberSince = formatMemberSince(profile.created_at);

  return (
    <header className="party-card flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start sm:p-8">
      <Avatar className="size-24 ring-2 ring-primary/40 sm:size-28">
        <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="bg-secondary text-xl text-secondary-foreground">
          {initials(profile.display_name || "PU")}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {profile.display_name}
        </h1>
        <p className="mt-1 text-lg font-medium text-primary">@{profile.username}</p>

        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground sm:justify-start">
          {showCountry && profile.country ? (
            <li className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {profile.country}
            </li>
          ) : null}
          <li className="flex items-center gap-1.5">
            <Calendar className="size-3.5 shrink-0" aria-hidden />
            Membro desde {memberSince}
          </li>
        </ul>

        {profile.bio ? (
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-foreground/90">
            {profile.bio}
          </p>
        ) : null}
      </div>
    </header>
  );
}
