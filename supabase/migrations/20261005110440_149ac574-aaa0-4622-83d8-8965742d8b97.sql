REVOKE ALL ON FUNCTION public.my_bookings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_bookings() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_bookings() TO authenticated, service_role;