-- Additional platform features: history, snapshots, users, exceptions, and dynamic school config.

CREATE OR REPLACE FUNCTION public.is_admin_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'erik.espemyr@falkoping.se'
$$;

-- Dynamic school settings (classes, halls, rooms, weekdays)
CREATE TABLE IF NOT EXISTS public.school_settings (
  id text PRIMARY KEY,
  settings jsonb NOT NULL,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view school settings" ON public.school_settings;
DROP POLICY IF EXISTS "Admins can write school settings" ON public.school_settings;

CREATE POLICY "Anyone can view school settings"
ON public.school_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can write school settings"
ON public.school_settings FOR ALL TO authenticated
USING (public.is_admin_manager())
WITH CHECK (public.is_admin_manager());

DROP TRIGGER IF EXISTS update_school_settings_updated_at ON public.school_settings;
CREATE TRIGGER update_school_settings_updated_at
BEFORE UPDATE ON public.school_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.school_settings (id, settings, updated_by)
VALUES (
  'default',
  jsonb_build_object(
    'classes', jsonb_build_array('7A', '7F', '8B', '8C', '8H'),
    'weekDays', jsonb_build_array('Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'),
    'halls', jsonb_build_array('Gy-sal', 'Freja A', 'Freja B'),
    'changingRooms', jsonb_build_array('1&2', '3&4', '5&6')
  ),
  'seed'
)
ON CONFLICT (id) DO NOTHING;

-- Calendar exceptions for special days (holiday, cancelled events etc)
CREATE TABLE IF NOT EXISTS public.calendar_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
  day text NOT NULL,
  class_name text,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  cancel_lesson boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view calendar exceptions" ON public.calendar_exceptions;
DROP POLICY IF EXISTS "Admins can write calendar exceptions" ON public.calendar_exceptions;

CREATE POLICY "Anyone can view calendar exceptions"
ON public.calendar_exceptions FOR SELECT
USING (true);

CREATE POLICY "Admins can write calendar exceptions"
ON public.calendar_exceptions FOR ALL TO authenticated
USING (public.is_admin_manager())
WITH CHECK (public.is_admin_manager());

DROP TRIGGER IF EXISTS update_calendar_exceptions_updated_at ON public.calendar_exceptions;
CREATE TRIGGER update_calendar_exceptions_updated_at
BEFORE UPDATE ON public.calendar_exceptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Application-level admin users (owner/editor/viewer by email)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can manage admin users" ON public.admin_users;

CREATE POLICY "Admins can view admin users"
ON public.admin_users FOR SELECT TO authenticated
USING (public.is_admin_manager());

CREATE POLICY "Admins can manage admin users"
ON public.admin_users FOR ALL TO authenticated
USING (public.is_admin_manager())
WITH CHECK (public.is_admin_manager());

DROP TRIGGER IF EXISTS update_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER update_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.admin_users (email, role, active)
VALUES ('erik.espemyr@falkoping.se', 'owner', true)
ON CONFLICT (email) DO NOTHING;

-- Admin change log for audit and notifications
CREATE TABLE IF NOT EXISTS public.admin_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  scope text NOT NULL,
  action text NOT NULL,
  summary text NOT NULL,
  actor_email text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view admin change log" ON public.admin_change_log;
DROP POLICY IF EXISTS "Admins can insert admin change log" ON public.admin_change_log;
DROP POLICY IF EXISTS "Admins can manage admin change log" ON public.admin_change_log;

CREATE POLICY "Anyone can view admin change log"
ON public.admin_change_log FOR SELECT
USING (true);

CREATE POLICY "Admins can insert admin change log"
ON public.admin_change_log FOR INSERT TO authenticated
WITH CHECK (public.is_admin_manager());

CREATE POLICY "Admins can manage admin change log"
ON public.admin_change_log FOR UPDATE TO authenticated
USING (public.is_admin_manager())
WITH CHECK (public.is_admin_manager());

-- Admin snapshots for undo/restore
CREATE TABLE IF NOT EXISTS public.admin_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  scope text NOT NULL,
  summary text NOT NULL,
  actor_email text,
  payload jsonb NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view snapshots" ON public.admin_snapshots;
DROP POLICY IF EXISTS "Admins can insert snapshots" ON public.admin_snapshots;
DROP POLICY IF EXISTS "Admins can delete snapshots" ON public.admin_snapshots;

CREATE POLICY "Admins can view snapshots"
ON public.admin_snapshots FOR SELECT TO authenticated
USING (public.is_admin_manager());

CREATE POLICY "Admins can insert snapshots"
ON public.admin_snapshots FOR INSERT TO authenticated
WITH CHECK (public.is_admin_manager());

CREATE POLICY "Admins can delete snapshots"
ON public.admin_snapshots FOR DELETE TO authenticated
USING (public.is_admin_manager());
