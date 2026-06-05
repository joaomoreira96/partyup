type AdminOverviewProps = {
  gamesCount: number;
  roomsCount: number;
  usersCount: number;
};

export function AdminOverview({ gamesCount, roomsCount, usersCount }: AdminOverviewProps) {
  const cards = [
    { label: "Jogos publicados", value: gamesCount },
    { label: "Salas ativas", value: roomsCount },
    { label: "Utilizadores", value: usersCount },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {cards.map(({ label, value }) => (
        <div key={label} className="rounded-xl border p-6">
          <p className="text-3xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      ))}
    </section>
  );
}
