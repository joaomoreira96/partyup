# PartyUp — Design System (Documento 04)

## Cores (dark mode principal)

| Token | Hex | Uso |
|-------|-----|-----|
| background | `#0F172A` | Fundo da app |
| surface | `#1E293B` | Cards, inputs |
| surface-hover | `#334155` | Hover |
| primary | `#3B82F6` | CTAs principais |
| secondary | `#8B5CF6` | Destaques de marca |
| accent | `#F59E0B` | Featured, rankings |
| success | `#22C55E` | Estados positivos |
| error | `#EF4444` | Erros (sempre com ícone + texto) |

## Tipografia

- **Inter** (Google Fonts)
- H1: hero / landing
- H2: secções (`SectionHeading`)
- H3: cards e jogos

## Espaçamento

Múltiplos de 4px: 4, 8, 12, 16, 24, 32, 48, 64

## Radius

- Padrão: `12px` (`--radius-md`)
- Premium: `16px` (`--radius-premium`)

## Classes utilitárias

- `.party-card` — card padrão
- `.party-card-premium` — card destacado
- `.party-card-featured` — jogos em destaque
- `.party-section` — secção da home

## Componentes

- `src/components/design/` — podium, profile header, section heading
- `src/lib/design/tokens.ts` — referência de cores

## Acessibilidade

- WCAG AA: contraste em `--muted-foreground`
- Focus ring obrigatório (`:focus-visible`)
- `prefers-reduced-motion` em `globals.css`
- Erros: ícone + texto + cor
