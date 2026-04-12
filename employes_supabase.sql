-- ==================================================
-- FNCP Club de Plage -- Table employes -- Saison 2026
-- Supabase > SQL Editor > coller > Run
-- ==================================================


-- 1. CREATION DE LA TABLE
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

COMMENT ON TABLE  public.employes             IS 'Equipe FNCP saison 2026';
COMMENT ON COLUMN public.employes.poste       IS 'maitre_nageur | animateur | admin';
COMMENT ON COLUMN public.employes.jours       IS 'Jours de presence : lun mar mer jeu ven sam';
COMMENT ON COLUMN public.employes.statut      IS 'actif | conge | absent';


-- 2. TRIGGER updated_at automatique
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


-- 4. ROW LEVEL SECURITY
-- ==================================================
-- Lecture  : utilisateurs authentifies uniquement
-- Ecriture : admins uniquement (par email)
-- IMPORTANT : remplacez les emails ci-dessous par vos vrais emails admin
-- ==================================================

ALTER TABLE public.employes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employes_select_authenticated" ON public.employes;
DROP POLICY IF EXISTS "employes_insert_admin"         ON public.employes;
DROP POLICY IF EXISTS "employes_update_admin"         ON public.employes;
DROP POLICY IF EXISTS "employes_delete_admin"         ON public.employes;

CREATE POLICY "employes_select_authenticated"
  ON public.employes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "employes_insert_admin"
  ON public.employes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'admin@fncp.fr',
      'direction@fncp.fr'
    )
  );

CREATE POLICY "employes_update_admin"
  ON public.employes
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'admin@fncp.fr',
      'direction@fncp.fr'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'admin@fncp.fr',
      'direction@fncp.fr'
    )
  );

CREATE POLICY "employes_delete_admin"
  ON public.employes
  FOR DELETE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'admin@fncp.fr',
      'direction@fncp.fr'
    )
  );


-- 5. DONNEES DE TEST (optionnel)
-- ==================================================
-- Decommentez ce bloc pour tester immediatement
-- ==================================================

/*
INSERT INTO public.employes
  (prenom, nom, poste, email, telephone, contrat, date_debut, date_fin,
   jours, horaires_matin, horaires_apmidi, statut, notes)
VALUES
  ('Julien', 'MARTINEZ', 'maitre_nageur', 'j.martinez@fncp.fr', '06 11 22 33 44',
   'Saisonnier', '2026-07-06', '2026-08-22',
   ARRAY['lun','mar','mer','jeu','ven','sam'], TRUE, TRUE, 'actif',
   'BEESAN + PSE1. Referent securite bassin.'),

  ('Camille', 'DUPONT', 'maitre_nageur', 'c.dupont@fncp.fr', '06 22 33 44 55',
   'Saisonnier', '2026-07-06', '2026-08-22',
   ARRAY['lun','mar','jeu','ven','sam'], TRUE, FALSE, 'actif',
   'BEESAN. Specialiste ecole de natation enfants.'),

  ('Thomas', 'BERGER', 'maitre_nageur', 't.berger@fncp.fr', '06 33 44 55 66',
   'CDD', '2026-07-13', '2026-08-22',
   ARRAY['mer','jeu','ven','sam'], FALSE, TRUE, 'actif', NULL),

  ('Lea', 'FONTAINE', 'animateur', 'l.fontaine@fncp.fr', '06 44 55 66 77',
   'Saisonnier', '2026-07-06', '2026-08-22',
   ARRAY['lun','mar','mer','jeu','ven'], TRUE, TRUE, 'actif',
   'Animatrice Club de Plage. BAFA obtenu.'),

  ('Hugo', 'MARTIN', 'animateur', 'h.martin@fncp.fr', '06 55 66 77 88',
   'Saisonnier', '2026-07-06', '2026-08-22',
   ARRAY['lun','mer','ven','sam'], FALSE, TRUE, 'actif', NULL),

  ('Ines', 'LEBRUN', 'animateur', 'i.lebrun@fncp.fr', '06 66 77 88 99',
   'Vacataire', '2026-07-20', '2026-08-15',
   ARRAY['lun','mar','jeu','sam'], TRUE, TRUE, 'conge',
   'Conge du 28 juillet au 3 aout.'),

  ('Sophie', 'RENAUD', 'admin', 's.renaud@fncp.fr', '06 77 88 99 00',
   'CDI', '2026-07-01', '2026-08-31',
   ARRAY['lun','mar','mer','jeu','ven'], TRUE, TRUE, 'actif',
   'Responsable administrative. Gestion inscriptions et caisse.'),

  ('Marc', 'GIRAUD', 'admin', 'm.giraud@fncp.fr', '06 88 99 00 11',
   'Saisonnier', '2026-07-06', '2026-08-22',
   ARRAY['lun','mer','ven'], TRUE, FALSE, 'actif',
   'Accueil et billetterie matin.');
*/


-- 6. VERIFICATION (lancer apres execution)
-- ==================================================
-- SELECT * FROM public.employes ORDER BY nom;
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'employes';
