-- Place aliases table: maps user-typed landmark names to canonical transit stop names
-- Admins can add rows via Supabase Dashboard without touching code.
-- The app queries this as a fallback when a place isn't in the hardcoded list.

CREATE TABLE IF NOT EXISTS public.place_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,        -- what the user types, e.g. "sm city makati"
  maps_to TEXT NOT NULL,           -- canonical stop name in route index, e.g. "ayala mrt"
  category TEXT,                   -- optional: "mall", "hospital", "university", "area"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique on the normalised query so there are no duplicate aliases
CREATE UNIQUE INDEX idx_place_aliases_query ON public.place_aliases (lower(trim(query_text)));

-- Fast trigram search for fuzzy admin lookups
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_place_aliases_trgm ON public.place_aliases USING GIN (lower(query_text) gin_trgm_ops);

-- RLS: anyone can read, only service role can write (managed via Supabase Dashboard)
ALTER TABLE public.place_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Place aliases are publicly readable" ON public.place_aliases FOR SELECT USING (true);

-- ─── Seed with the most common PH landmarks ───────────────────────────────────
INSERT INTO public.place_aliases (query_text, maps_to, category) VALUES
  -- Stations (direct names)
  ('cubao', 'cubao mrt', 'station'),
  ('baclaran', 'baclaran lrt', 'station'),
  ('monumento', 'monumento lrt', 'station'),
  ('recto', 'recto lrt', 'station'),
  ('katipunan', 'katipunan lrt', 'station'),
  ('taft', 'taft ave mrt', 'station'),
  -- Malls
  ('sm north', 'north avenue mrt', 'mall'),
  ('sm north edsa', 'north avenue mrt', 'mall'),
  ('trinoma', 'north avenue mrt', 'mall'),
  ('sm makati', 'ayala mrt', 'mall'),
  ('sm city makati', 'ayala mrt', 'mall'),
  ('sm aura', 'market market', 'mall'),
  ('sm fairview', 'fairview terraces', 'mall'),
  ('sm city fairview', 'fairview terraces', 'mall'),
  ('sm san lazaro', 'tayuman lrt', 'mall'),
  ('sm sta mesa', 'pureza lrt', 'mall'),
  ('sm centerpoint', 'cubao mrt', 'mall'),
  ('robinsons galleria', 'ortigas mrt', 'mall'),
  ('robinsons magnolia', 'cubao mrt', 'mall'),
  ('robinsons manila', 'pedro gil lrt', 'mall'),
  ('megamall', 'ortigas mrt', 'mall'),
  ('sm megamall', 'ortigas mrt', 'mall'),
  ('market market', 'market market', 'mall'),
  ('glorietta', 'ayala mrt', 'mall'),
  ('greenbelt', 'ayala mrt', 'mall'),
  ('gateway', 'cubao mrt', 'mall'),
  ('eastwood', 'cubao mrt', 'mall'),
  -- Areas / barangays
  ('makati', 'ayala mrt', 'area'),
  ('bgc', 'market market', 'area'),
  ('taguig', 'market market', 'area'),
  ('ortigas', 'ortigas mrt', 'area'),
  ('quiapo', 'carriedo lrt', 'area'),
  ('divisoria', 'tutuban pnr', 'area'),
  ('intramuros', 'central terminal lrt', 'area'),
  ('malate', 'vito cruz lrt', 'area'),
  ('ermita', 'pedro gil lrt', 'area'),
  ('pasay', 'taft ave mrt', 'area'),
  ('mandaluyong', 'shaw mrt', 'area'),
  ('fairview', 'fairview terraces', 'area'),
  ('commonwealth', 'commonwealth', 'area'),
  ('bagong silangan', 'commonwealth', 'area'),
  ('batasan', 'commonwealth', 'area'),
  ('alabang', 'alabang', 'area'),
  ('marikina', 'marikina', 'area'),
  ('antipolo', 'antipolo', 'area'),
  ('cainta', 'cainta junction', 'area'),
  -- Landmarks / schools
  ('ateneo', 'admu gate 3.5 overpass', 'university'),
  ('admu', 'admu gate 3.5 overpass', 'university'),
  ('up diliman', 'uptc jeep station', 'university'),
  ('up', 'uptc jeep station', 'university'),
  ('dlsu', 'vito cruz lrt', 'university'),
  ('la salle', 'vito cruz lrt', 'university'),
  ('ust', 'espana pnr', 'university'),
  ('feu', 'tayuman lrt', 'university'),
  ('mapua', 'doroteo jose lrt', 'university'),
  ('pgh', 'pedro gil lrt', 'hospital'),
  ('medical city', 'ortigas mrt', 'hospital'),
  ('st lukes', 'ortigas mrt', 'hospital'),
  ('moa', 'taft ave mrt', 'landmark'),
  ('mall of asia', 'taft ave mrt', 'landmark')
ON CONFLICT (lower(trim(query_text))) DO NOTHING;
