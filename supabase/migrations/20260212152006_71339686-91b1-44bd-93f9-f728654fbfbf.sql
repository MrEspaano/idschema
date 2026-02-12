
-- 1. Table for fixed class+day→hall mapping
CREATE TABLE public.class_day_halls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL,
  day text NOT NULL,
  hall text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_name, day)
);

ALTER TABLE public.class_day_halls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view class_day_halls" ON public.class_day_halls FOR SELECT USING (true);
CREATE POLICY "Admins can insert class_day_halls" ON public.class_day_halls FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update class_day_halls" ON public.class_day_halls FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete class_day_halls" ON public.class_day_halls FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_class_day_halls_updated_at BEFORE UPDATE ON public.class_day_halls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Table for changing room codes (the "code document")
CREATE TABLE public.changing_room_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number integer NOT NULL,
  day text NOT NULL,
  changing_room text NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(week_number, day, changing_room)
);

ALTER TABLE public.changing_room_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view changing_room_codes" ON public.changing_room_codes FOR SELECT USING (true);
CREATE POLICY "Admins can insert changing_room_codes" ON public.changing_room_codes FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update changing_room_codes" ON public.changing_room_codes FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete changing_room_codes" ON public.changing_room_codes FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_changing_room_codes_updated_at BEFORE UPDATE ON public.changing_room_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add is_theory column to weekly_schedules
ALTER TABLE public.weekly_schedules ADD COLUMN IF NOT EXISTS is_theory boolean NOT NULL DEFAULT false;

-- 4. Seed the fixed class+day→hall data
INSERT INTO public.class_day_halls (class_name, day, hall) VALUES
  ('7A', 'Måndag', 'Gy-sal'),
  ('7A', 'Onsdag', 'Freja A'),
  ('7A', 'Torsdag', 'Freja B'),
  ('7F', 'Tisdag', 'Gy-sal'),
  ('7F', 'Onsdag', 'Freja B'),
  ('7F', 'Fredag', 'Freja B'),
  ('8B', 'Måndag', 'Gy-sal'),
  ('8B', 'Tisdag', 'Freja A'),
  ('8B', 'Torsdag', 'Freja B'),
  ('8C', 'Måndag', 'Gy-sal'),
  ('8C', 'Onsdag', 'Freja B'),
  ('8C', 'Fredag', 'Freja B'),
  ('8H', 'Måndag', 'Gy-sal'),
  ('8H', 'Tisdag', 'Freja A'),
  ('8H', 'Fredag', 'Freja B');
