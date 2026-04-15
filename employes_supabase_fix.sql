-- ==================================================
-- FNCP -- Table employes -- Version corrigee
-- ==================================================

-- 1. TABLE
-- ==================================================

CREATE TABLE IF NOT EXISTS public.employes (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  prenom           TEXT         NOT NULL,
  nom              TEXT         NOT NULL,
  poste            TEXT         NOT NULL DEFAULT 'animateur'
                   CHECK (poste IN ('maitre_nageur', 'animateur', 'admin')),
  email            TEXT,
  telephone        TEXT,
  contrat          TEXT         NOT NULL DEFAULT 'Saisonnier'
                   CHECK (contrat IN ('CDI', 'CDD', 'Saisonnier', 'Vacataire', 'Stagiaire')),
  date_debut       DATE,
  date_fin         DATE,
  jours            TEXT[]       NOT NULL DEFAULT '{}',
  horaires_matin   BOOLEAN      NOT NULL DEFAULT FALSE,
  horaires_apmidi  BOOLEAN      NOT NULL DEFAULT FALSE,
  statut           TEXT         NOT NULL DEFAULT 'actif'
                   CHECK (statut IN ('actif', 'conge', 'absent')),
  notes            TEXT,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);


-- 2. TRIGGER updated_at
-- ==================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employes_updated_at ON public.employes;
CREATE TRIGGER employes_updated_at
  BEFORE UPDATE ON public.employes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3. INDEX
-- ==================================================

CREATE INDEX IF NOT EXISTS idx_employes_nom    ON public.employes (nom);
CREATE INDEX IF NOT EXISTS idx_employes_poste  ON public.employes (poste);
CREATE INDEX IF NOT EXISTS idx_employes_statut ON public.employes (statut);


-- 4. RLS -- acces total aux utilisateurs authentifies
-- ==================================================
-- Strategie simple : tout utilisateur authentifie peut
-- lire et ecrire. La protection se fait cote application
-- (seul l'admin voit l'onglet Equipe).
-- ==================================================

ALTER TABLE public.employes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employes_all_authenticated" ON public.employes;

CREATE POLICY "employes_all_authenticated"
  ON public.employes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
