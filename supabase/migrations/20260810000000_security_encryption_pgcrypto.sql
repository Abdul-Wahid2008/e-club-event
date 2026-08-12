-- Migration: Security Hardening & PGCrypto AES Encryption Setup
-- Enable pgcrypto extension for symmetric AES-256 encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Helper function for AES-256 encryption (pgp_sym_encrypt wrapper)
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(
  raw_text TEXT,
  passphrase TEXT DEFAULT current_setting('app.settings.encryption_key', true)
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF raw_text IS NULL OR raw_text = '' THEN
    RETURN raw_text;
  END IF;
  
  -- Use default secret if setting not set
  IF passphrase IS NULL OR passphrase = '' THEN
    passphrase := 'default_pitch_under_pressure_aes_key_2026';
  END IF;

  RETURN encode(pgp_sym_encrypt(raw_text, passphrase, 'cipher-algo=aes256'), 'base64');
END;
$$;

-- 2. Helper function for AES-256 decryption (pgp_sym_decrypt wrapper)
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(
  cipher_text TEXT,
  passphrase TEXT DEFAULT current_setting('app.settings.encryption_key', true)
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF cipher_text IS NULL OR cipher_text = '' THEN
    RETURN cipher_text;
  END IF;

  IF passphrase IS NULL OR passphrase = '' THEN
    passphrase := 'default_pitch_under_pressure_aes_key_2026';
  END IF;

  RETURN pgp_sym_decrypt(decode(cipher_text, 'base64'), passphrase);
EXCEPTION WHEN OTHERS THEN
  -- Return placeholder or null on decryption failure
  RETURN '[Encrypted Data]';
END;
$$;

-- 3. Add encrypted_note column to score_audit_log for sensitive audit trail protection
ALTER TABLE public.score_audit_log
ADD COLUMN IF NOT EXISTS encrypted_note TEXT;

-- 4. Secure RLS policies verification
-- Ensure score_audit_log can only be read/written by authorised roles
DROP POLICY IF EXISTS "Public read audit log" ON public.score_audit_log;
CREATE POLICY "Organiser read audit log" ON public.score_audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organiser')
);

-- Revoke dangerous direct permissions
REVOKE EXECUTE ON FUNCTION public.encrypt_sensitive_data(TEXT, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION public.decrypt_sensitive_data(TEXT, TEXT) FROM public;

GRANT EXECUTE ON FUNCTION public.encrypt_sensitive_data(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_sensitive_data(TEXT, TEXT) TO authenticated, service_role;
