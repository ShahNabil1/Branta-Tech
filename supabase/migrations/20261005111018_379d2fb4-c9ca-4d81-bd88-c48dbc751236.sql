DROP INDEX IF EXISTS public.bookings_active_start_unique;
ALTER TABLE public.bookings
  ADD COLUMN booking_end_at timestamptz;
UPDATE public.bookings SET booking_end_at = requested_start_at + (duration_minutes * interval '1 minute');
ALTER TABLE public.bookings ALTER COLUMN booking_end_at SET NOT NULL;
CREATE OR REPLACE FUNCTION public.set_booking_end_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN NEW.booking_end_at := NEW.requested_start_at + (NEW.duration_minutes * interval '1 minute'); RETURN NEW; END $$;
CREATE TRIGGER bookings_set_end_at BEFORE INSERT OR UPDATE OF requested_start_at, duration_minutes ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_booking_end_at();
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_active_time_no_overlap
  EXCLUDE USING gist (
    tstzrange(requested_start_at, booking_end_at, '[)') WITH &&
  )
  WHERE (status IN ('requested', 'confirmed', 'reschedule_requested'));
