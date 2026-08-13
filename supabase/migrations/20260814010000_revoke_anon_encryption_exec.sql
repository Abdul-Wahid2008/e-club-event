-- Migration: Explicitly revoke encrypt/decrypt execute from anon
--
-- Verification during pre-event testing found that the anon (unauthenticated)
-- key could still call encrypt_sensitive_data / decrypt_sensitive_data after
-- 20260810000000's `REVOKE EXECUTE ... FROM public`. Supabase grants
-- `anon`/`authenticated` direct EXECUTE on all functions in `public` when the
-- schema is exposed via PostgREST, which is a separate grant from the
-- pseudo-role `public` and survives a `REVOKE ... FROM public`. Revoking
-- from `anon` explicitly closes that gap.

REVOKE EXECUTE ON FUNCTION public.encrypt_sensitive_data(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_sensitive_data(TEXT, TEXT) FROM anon;
