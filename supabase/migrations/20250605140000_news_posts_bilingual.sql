-- News bilíngues: título e conteúdo em inglês

truncate table public.news_posts;

alter table public.news_posts
  add column if not exists title_en text not null default '',
  add column if not exists content_en text not null default '';

alter table public.news_posts
  alter column title_en drop default,
  alter column content_en drop default;
