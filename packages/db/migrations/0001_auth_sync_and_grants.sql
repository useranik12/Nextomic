-- Keeps public.users and public.user_meta in step with Supabase Auth, and closes the builder schema.

-- A new auth account gets its profile row and its backend-controlled meta row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_user_id bigint;
BEGIN
  INSERT INTO public.users (user_uid, email, phone, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.phone, ''),
    NULLIF(NEW.raw_user_meta_data ->> 'first_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'last_name', '')
  )
  RETURNING user_id INTO new_user_id;

  INSERT INTO public.user_meta (user_id) VALUES (new_user_id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- An email or phone change in Auth is copied to the profile.
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email,
      phone = NULLIF(NEW.phone, ''),
      updated_on = now()
  WHERE user_uid = NEW.id;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_updated() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, phone ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_updated();
--> statement-breakpoint
-- The builder reaches its own schema only through the server (the database owner role).
REVOKE ALL ON SCHEMA nextomic_builder FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA nextomic_builder FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA nextomic_builder FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA nextomic_builder REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA nextomic_builder REVOKE ALL ON SEQUENCES FROM anon, authenticated;
--> statement-breakpoint
-- Account meta is backend-controlled: even a policy written later cannot let a client change it.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_meta FROM anon, authenticated;
