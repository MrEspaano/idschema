
-- Enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Weekly schedules table
CREATE TABLE public.weekly_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INTEGER NOT NULL,
  class_name TEXT NOT NULL,
  day TEXT NOT NULL,
  activity TEXT NOT NULL,
  hall TEXT NOT NULL DEFAULT '',
  changing_room TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL DEFAULT '',
  cancelled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;

-- Term planning table
CREATE TABLE public.term_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weeks TEXT NOT NULL,
  area TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_assessment BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT 'teal',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.term_plans ENABLE ROW LEVEL SECURITY;

-- RLS: user_roles - only admins can read
CREATE POLICY "Admins can view roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: weekly_schedules - public read, admin write
CREATE POLICY "Anyone can view schedules" ON public.weekly_schedules
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert schedules" ON public.weekly_schedules
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update schedules" ON public.weekly_schedules
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete schedules" ON public.weekly_schedules
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: term_plans - public read, admin write
CREATE POLICY "Anyone can view term plans" ON public.term_plans
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert term plans" ON public.term_plans
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update term plans" ON public.term_plans
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete term plans" ON public.term_plans
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_weekly_schedules_updated_at
  BEFORE UPDATE ON public.weekly_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_term_plans_updated_at
  BEFORE UPDATE ON public.term_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
