-- Verifier les deux comptes admin
SELECT id, email, is_admin
FROM public.membres
WHERE email IN (
  'charlene-sauzeau@live.fr',
  'clubdeplage.piriacsurmer@hotmail.com',
  'charlenesauzeau@mac.com'
);

-- Si is_admin est NULL ou false, corriger avec :
-- UPDATE public.membres
-- SET is_admin = true
-- WHERE email IN (
--   'charlene-sauzeau@live.fr',
--   'clubdeplage.piriacsurmer@hotmail.com',
--   'charlenesauzeau@mac.com'
-- );
