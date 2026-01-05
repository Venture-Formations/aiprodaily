-- Migration: Fix function search paths for security
-- This addresses the "function_search_path_mutable" security warnings
-- by setting an immutable search_path on all functions

-- 1. update_updated_at_column (generic trigger function)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. update_directory_updated_at (tools directory)
CREATE OR REPLACE FUNCTION public.update_directory_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. update_ai_app_modules_updated_at
CREATE OR REPLACE FUNCTION public.update_ai_app_modules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4. update_prompt_modules_updated_at
CREATE OR REPLACE FUNCTION public.update_prompt_modules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5. update_poll_modules_updated_at
CREATE OR REPLACE FUNCTION public.update_poll_modules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 6. get_newsletter_by_subdomain
-- Note: Returns 'publications' type (row type from newsletters table)
CREATE OR REPLACE FUNCTION public.get_newsletter_by_subdomain(subdomain_input TEXT)
RETURNS public.publications
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN (SELECT * FROM public.newsletters WHERE subdomain = subdomain_input AND is_active = true);
END;
$$;

-- 7. get_newsletter_setting
CREATE OR REPLACE FUNCTION public.get_newsletter_setting(
  newsletter_id_input UUID,
  key_input TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT value
    FROM public.newsletter_settings
    WHERE newsletter_id = newsletter_id_input
    AND key = key_input
  );
END;
$$;
