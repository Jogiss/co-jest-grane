# 🔒 Zabezpieczenia Co Jest Grane?

## ⚠️ KRYTYCZNE — zrób to w Supabase Dashboard!

### 1. Włącz RLS na WSZYSTKICH tabelach
W Supabase Dashboard → Table Editor → każda tabela → kliknij "Enable RLS"

Tabele do zabezpieczenia:
- `game_results`
- `wyniki`
- `Piosenki` (read-only)
- `leaderboard_view` (view - read-only)
- `community_events`
- `community_event_songs`
- `event_songs`
- `events`
- `user_progress`
- `multiplayer_rooms`
- `aktualnosci`
- `global_alerts`
- `song_suggestions`
- `bajki_suggestions`
- `game_suggestions`

### 2. Polityki RLS (SQL do uruchomienia w SQL Editor)

```sql
-- ====== GAME_RESULTS ======
-- Każdy może DODAWAĆ wyniki (INSERT), NIKT nie może UPDATE/DELETE
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert results" ON game_results
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read results" ON game_results
  FOR SELECT USING (true);

-- BRAK POLICY NA UPDATE I DELETE = nikt nie może modyfikować ani usuwać!

-- ====== WYNIKI (rozkład prób) ======
ALTER TABLE wyniki ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert" ON wyniki
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read" ON wyniki
  FOR SELECT USING (true);

-- ====== PIOSENKI (tylko odczyt) ======
ALTER TABLE "Piosenki" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read only" ON "Piosenki"
  FOR SELECT USING (true);

-- ====== COMMUNITY_EVENTS ======
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active" ON community_events
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create" ON community_events
  FOR INSERT WITH CHECK (true);

-- Tylko twórca może update swój event (ale NIE status!)
CREATE POLICY "Creator can update own" ON community_events
  FOR UPDATE USING (creator_id = current_setting('request.jwt.claims')::json->>'sub')
  WITH CHECK (creator_id = current_setting('request.jwt.claims')::json->>'sub');

-- ====== COMMUNITY_EVENT_SONGS ======
ALTER TABLE community_event_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read" ON community_event_songs
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert" ON community_event_songs
  FOR INSERT WITH CHECK (true);

-- ====== USER_PROGRESS ======
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can read own" ON user_progress
  FOR SELECT USING (true);

CREATE POLICY "User can insert own" ON user_progress
  FOR INSERT WITH CHECK (true);

CREATE POLICY "User can update own" ON user_progress
  FOR UPDATE USING (true);

-- ====== EVENTS (twórcy - read only) ======
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read only" ON events
  FOR SELECT USING (true);

ALTER TABLE event_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read only" ON event_songs
  FOR SELECT USING (true);

-- ====== AKTUALNOSCI, GLOBAL_ALERTS (read only) ======
ALTER TABLE aktualnosci ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read only" ON aktualnosci FOR SELECT USING (true);

ALTER TABLE global_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read only" ON global_alerts FOR SELECT USING (true);

-- ====== SUGGESTIONS (read only) ======
ALTER TABLE song_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read only" ON song_suggestions FOR SELECT USING (true);

ALTER TABLE bajki_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read only" ON bajki_suggestions FOR SELECT USING (true);

ALTER TABLE game_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read only" ON game_suggestions FOR SELECT USING (true);
```

### 3. Rate Limiting (Supabase Edge Functions)
W Supabase Dashboard → Settings → API → Rate Limiting:
- Ustaw limit na **100 requests/minutę** per IP

### 4. Storage Bucket
Jeśli masz bucket z audio:
- Ustaw jako **public** (do odczytu)
- NIE pozwalaj na upload bez autoryzacji
- W Supabase → Storage → Policies:
  - SELECT: `true` (każdy może słuchać)
  - INSERT/UPDATE/DELETE: `false` lub tylko admin

### 5. Leaderboard View
`leaderboard_view` to prawdopodobnie VIEW (nie tabela) — viewy nie potrzebują RLS,
ale upewnij się że bazowe tabele (`game_results`) mają INSERT-only.

**Kluczowe**: leaderboard bazuje na SUMIE z `game_results`. Skoro nikt nie może 
UPDATE ani DELETE z `game_results`, to nikt nie może "wyczyścić" rankingu.
Troll mógł to zrobić tylko jeśli RLS był wyłączony!

### 6. Ochrona przed botami pobierającymi ikony
W Netlify → `netlify.toml`:
```toml
[[headers]]
  for = "/icon.png"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/favicon.svg"  
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 7. Netlify Rate Limiting
W Netlify → Site Settings → Domain → poszukaj "Rate Limiting" lub użyj Netlify Edge Functions.
Alternatywnie: Cloudflare przed Netlify jako reverse proxy z DDoS protection (darmowy plan).
