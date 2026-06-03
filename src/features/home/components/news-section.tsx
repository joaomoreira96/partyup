import { SectionHeading } from "@/components/design/section-heading";

const NEWS = [
  {
    title: "PartyUp lançado",
    date: "Jun 2026",
    excerpt:
      "Plataforma social de jogos no browser — entra e joga em segundos, sem instalar nada.",
  },
  {
    title: "Multiplayer por link",
    date: "Em breve",
    excerpt:
      "Cria uma sala, partilha o código e joga com amigos no lobby em tempo real.",
  },
  {
    title: "Novos jogos",
    date: "Contínuo",
    excerpt:
      "Módulos independentes — novos jogos sem alterar a plataforma.",
  },
];

export function NewsSection() {
  return (
    <section className="party-section" aria-labelledby="news-heading">
      <SectionHeading id="news-heading" title="Novidades" />
      <ul className="grid gap-4 sm:grid-cols-3">
        {NEWS.map((item) => (
          <li
            key={item.title}
            className="party-card-premium flex flex-col gap-2 p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              {item.date}
            </p>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {item.excerpt}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
