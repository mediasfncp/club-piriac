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
      'charlene-sauzeau@live.fr',
      'clubdeplage.piriacsurmer@hotmail.com'
    )
  );

CREATE POLICY "employes_update_admin"
  ON public.employes
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'charlene-sauzeau@live.fr',
      'clubdeplage.piriacsurmer@hotmail.com'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'charlene-sauzeau@live.fr',
      'clubdeplage.piriacsurmer@hotmail.com'
    )
  );

CREATE POLICY "employes_delete_admin"
  ON public.employes
  FOR DELETE
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'charlene-sauzeau@live.fr',
      'clubdeplage.piriacsurmer@hotmail.com'
    )
  );
