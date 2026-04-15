-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "employes_select_authenticated" ON public.employes;
DROP POLICY IF EXISTS "employes_insert_admin"         ON public.employes;
DROP POLICY IF EXISTS "employes_update_admin"         ON public.employes;
DROP POLICY IF EXISTS "employes_delete_admin"         ON public.employes;
DROP POLICY IF EXISTS "employes_all_authenticated"    ON public.employes;

-- Lecture : tous les authentifies
CREATE POLICY "employes_select_authenticated"
  ON public.employes
  FOR SELECT
  TO authenticated
  USING (true);

-- Ecriture : les deux emails admins
CREATE POLICY "employes_insert_admin"
  ON public.employes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email') = ANY(ARRAY[
      'charlene-sauzeau@live.fr',
      'clubdeplage.piriacsurmer@hotmail.com'
    ])
  );

CREATE POLICY "employes_update_admin"
  ON public.employes
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = ANY(ARRAY[
      'charlene-sauzeau@live.fr',
      'clubdeplage.piriacsurmer@hotmail.com'
    ])
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = ANY(ARRAY[
      'charlene-sauzeau@live.fr',
      'clubdeplage.piriacsurmer@hotmail.com'
    ])
  );

CREATE POLICY "employes_delete_admin"
  ON public.employes
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = ANY(ARRAY[
      'charlene-sauzeau@live.fr',
      'clubdeplage.piriacsurmer@hotmail.com'
    ])
  );
