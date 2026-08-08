-- Naprawa constrainta kategorii dla community_events
-- Uruchom w Supabase SQL Editor

ALTER TABLE community_events
DROP CONSTRAINT IF EXISTS community_events_category_check;

ALTER TABLE community_events
ADD CONSTRAINT community_events_category_check
CHECK (category IN ('music', 'cartoon', 'game', 'other', 'country'));

-- Opcjonalnie: sprawdź czy constraint został poprawnie ustawiony
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'community_events'::regclass
  AND contype = 'c';
