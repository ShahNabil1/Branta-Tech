ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_interest text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_reference text,
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS public_notes text;

UPDATE public.bookings
SET booking_reference = 'BR-' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE booking_reference IS NULL;

ALTER TABLE public.bookings ALTER COLUMN booking_reference SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_reference_unique ON public.bookings (booking_reference);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_start_unique ON public.bookings (requested_start_at)
WHERE status IN ('requested', 'confirmed', 'reschedule_requested');

CREATE TABLE public.booking_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_rule_day_valid CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT booking_rule_time_valid CHECK (end_time > start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_availability_rules TO authenticated;
GRANT ALL ON public.booking_availability_rules TO service_role;
ALTER TABLE public.booking_availability_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales read availability rules" ON public.booking_availability_rules FOR SELECT TO authenticated USING (private.is_sales_admin());
CREATE POLICY "Sales create availability rules" ON public.booking_availability_rules FOR INSERT TO authenticated WITH CHECK (private.is_sales_admin());
CREATE POLICY "Sales update availability rules" ON public.booking_availability_rules FOR UPDATE TO authenticated USING (private.is_sales_admin()) WITH CHECK (private.is_sales_admin());
CREATE POLICY "Sales delete availability rules" ON public.booking_availability_rules FOR DELETE TO authenticated USING (private.is_sales_admin());
CREATE TRIGGER booking_availability_rules_updated_at BEFORE UPDATE ON public.booking_availability_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.booking_availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_date date NOT NULL,
  kind text NOT NULL,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_exception_kind_valid CHECK (kind IN ('blocked', 'available')),
  CONSTRAINT booking_exception_time_pair CHECK ((start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_availability_exceptions TO authenticated;
GRANT ALL ON public.booking_availability_exceptions TO service_role;
ALTER TABLE public.booking_availability_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales read availability exceptions" ON public.booking_availability_exceptions FOR SELECT TO authenticated USING (private.is_sales_admin());
CREATE POLICY "Sales create availability exceptions" ON public.booking_availability_exceptions FOR INSERT TO authenticated WITH CHECK (private.is_sales_admin());
CREATE POLICY "Sales update availability exceptions" ON public.booking_availability_exceptions FOR UPDATE TO authenticated USING (private.is_sales_admin()) WITH CHECK (private.is_sales_admin());
CREATE POLICY "Sales delete availability exceptions" ON public.booking_availability_exceptions FOR DELETE TO authenticated USING (private.is_sales_admin());
CREATE TRIGGER booking_availability_exceptions_updated_at BEFORE UPDATE ON public.booking_availability_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.booking_availability_rules (day_of_week, start_time, end_time, sort_order)
SELECT d, time '10:00', time '18:00', d
FROM unnest(ARRAY[0,1,2,3,4]) AS d
WHERE NOT EXISTS (SELECT 1 FROM public.booking_availability_rules);

INSERT INTO public.site_settings (setting_group, settings)
VALUES (
  'booking',
  jsonb_build_object(
    'timezone', 'Asia/Dhaka',
    'duration_minutes', 30,
    'buffer_minutes', 15,
    'minimum_notice_hours', 12,
    'maximum_advance_days', 30,
    'instant_confirmation', false,
    'services', jsonb_build_array('AI Commercial','AI Content','AI Photography','Branding & Creative','Website','E-commerce','Software','AI Automation','Something Else'),
    'intro_media', jsonb_build_array(jsonb_build_object('id','booking-intro','type','vimeo','url','https://vimeo.com/1232979935?share=copy&fl=sv&fe=ci','poster_url','','alt','Branta team in a discovery call','label','This is what working with Branta feels like.','caption','','enabled',true,'sort_order',0,'autoplay',true,'muted',true,'loop',true,'aspect','16:9','position','center')),
    'process_media', '[]'::jsonb
  )
)
ON CONFLICT (setting_group) DO UPDATE SET settings = public.site_settings.settings || excluded.settings;

DROP FUNCTION public.my_bookings();
CREATE FUNCTION public.my_bookings()
RETURNS TABLE(id uuid, created_at timestamptz, topic text, requested_start_at timestamptz, timezone text, status text, duration_minutes integer, booking_reference text, meeting_url text, public_notes text, service_interest text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT b.id, b.created_at, b.topic, b.requested_start_at, b.timezone, b.status,
         b.duration_minutes, b.booking_reference,
         CASE WHEN b.status = 'confirmed' THEN b.meeting_url ELSE NULL END,
         b.public_notes, b.service_interest
  FROM public.bookings b
  WHERE b.client_user_id = auth.uid()
  ORDER BY b.requested_start_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.my_bookings() TO authenticated;

CREATE OR REPLACE FUNCTION public.booking_reference_default()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.booking_reference IS NULL OR NEW.booking_reference = '' THEN
    NEW.booking_reference := 'BR-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER bookings_reference_before_insert BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.booking_reference_default();