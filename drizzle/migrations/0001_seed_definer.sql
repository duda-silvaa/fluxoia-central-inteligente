ALTER FUNCTION public.seed_demo_data() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.seed_demo_data() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reset_demo_data() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.seed_demo_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;