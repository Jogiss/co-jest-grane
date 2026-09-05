-- ============================================================
-- LEKKI RANKING OKRESOWY (tydzień / miesiąc)
-- Uruchom w Supabase → SQL Editor
-- ============================================================
-- Dlaczego to jest bezpieczne dla limitów (inaczej niż game_results):
--   • 1 WIERSZ na gracza na okres — upsert nadpisuje, nie dopisuje
--     1000 graczy ≈ 1000 wierszy/tydzień + 1000/miesiąc (vs. setki tysięcy)
--   • aplikacja zapisuje maks. raz na 60 s i tylko gdy punkty się zmieniły
--   • odczyt to TOP 10 (limit 10) + jeden COUNT — kilka kB
--   • stare okresy kasujesz jednym DELETE (sekcja 4)
-- ============================================================

-- 1) TABELA
create table if not exists period_scores (
  user_id     text    not null,
  nickname    text    not null,
  period_type text    not null check (period_type in ('week', 'month')),
  period_key  text    not null,               -- '2026-W24' albo '2026-06'
  points      integer not null default 0 check (points >= 0 and points <= 100000),
  games       integer not null default 0 check (games  >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, period_type, period_key)
);

-- Indeks pod TOP 10 (sortowanie po punktach w danym okresie)
create index if not exists period_scores_board_idx
  on period_scores (period_type, period_key, points desc);

-- 2) RLS — każdy może czytać i zapisywać SWÓJ wiersz, nikt nie kasuje cudzych
alter table period_scores enable row level security;

drop policy if exists "Anyone can read scores"   on period_scores;
drop policy if exists "Anyone can insert score"  on period_scores;
drop policy if exists "Anyone can update score"  on period_scores;

create policy "Anyone can read scores"  on period_scores for select using (true);
create policy "Anyone can insert score" on period_scores for insert with check (true);
create policy "Anyone can update score" on period_scores for update using (true) with check (true);
-- BRAK policy na DELETE = nikt z zewnątrz nie wyczyści rankingu (tylko Ty z Dashboardu)

-- 3) PODGLĄD: aktualny TOP 10 tygodnia (do sprawdzenia w Dashboardzie)
-- select nickname, points, games from period_scores
-- where period_type = 'week'
--   and period_key  = to_char(now(), 'IYYY') || '-W' || to_char(now(), 'IW')
-- order by points desc limit 10;

-- 4) SPRZĄTANIE starych okresów.
--    UWAGA: aplikacja ma ARCHIWUM rankingów (przeglądanie zakończonych
--    tygodni/miesięcy). Sprzątaj dopiero po ROKU, żeby historia została:
delete from period_scores
where updated_at < now() - interval '1 year';

-- 5) OPCJONALNIE: automatyczne sprzątanie co miesiąc (wymaga pg_cron)
--    Supabase → Database → Extensions → włącz "pg_cron", potem:
-- select cron.schedule(
--   'purge-old-period-scores',
--   '0 4 1 * *',                                  -- 1. dnia miesiąca o 4:00
--   $$delete from period_scores where updated_at < now() - interval '1 year'$$
-- );

-- 6) RESET rankingu (gdybyś kiedyś chciał wyczyścić wszystko)
-- truncate table period_scores;
