-- Verifier exactement ce qui est en base
SELECT id, email, is_admin
FROM public.membres
WHERE email ILIKE '%hotmail%'
   OR email ILIKE '%clubdeplage%';
