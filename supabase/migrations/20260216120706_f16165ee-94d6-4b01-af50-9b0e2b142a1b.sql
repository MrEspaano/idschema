
-- Drop all restrictive policies and recreate as permissive for class_day_halls
DROP POLICY IF EXISTS "Admins can delete class_day_halls" ON public.class_day_halls;
DROP POLICY IF EXISTS "Admins can insert class_day_halls" ON public.class_day_halls;
DROP POLICY IF EXISTS "Admins can update class_day_halls" ON public.class_day_halls;
DROP POLICY IF EXISTS "Anyone can view class_day_halls" ON public.class_day_halls;

CREATE POLICY "Anyone can view class_day_halls" ON public.class_day_halls FOR SELECT USING (true);
CREATE POLICY "Admins can insert class_day_halls" ON public.class_day_halls FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update class_day_halls" ON public.class_day_halls FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete class_day_halls" ON public.class_day_halls FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix same issue on changing_room_codes
DROP POLICY IF EXISTS "Admins can delete changing_room_codes" ON public.changing_room_codes;
DROP POLICY IF EXISTS "Admins can insert changing_room_codes" ON public.changing_room_codes;
DROP POLICY IF EXISTS "Admins can update changing_room_codes" ON public.changing_room_codes;
DROP POLICY IF EXISTS "Anyone can view changing_room_codes" ON public.changing_room_codes;

CREATE POLICY "Anyone can view changing_room_codes" ON public.changing_room_codes FOR SELECT USING (true);
CREATE POLICY "Admins can insert changing_room_codes" ON public.changing_room_codes FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update changing_room_codes" ON public.changing_room_codes FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete changing_room_codes" ON public.changing_room_codes FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix same issue on weekly_schedules
DROP POLICY IF EXISTS "Admins can delete schedules" ON public.weekly_schedules;
DROP POLICY IF EXISTS "Admins can insert schedules" ON public.weekly_schedules;
DROP POLICY IF EXISTS "Admins can update schedules" ON public.weekly_schedules;
DROP POLICY IF EXISTS "Anyone can view schedules" ON public.weekly_schedules;

CREATE POLICY "Anyone can view schedules" ON public.weekly_schedules FOR SELECT USING (true);
CREATE POLICY "Admins can insert schedules" ON public.weekly_schedules FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update schedules" ON public.weekly_schedules FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete schedules" ON public.weekly_schedules FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix same issue on term_plans
DROP POLICY IF EXISTS "Admins can delete term plans" ON public.term_plans;
DROP POLICY IF EXISTS "Admins can insert term plans" ON public.term_plans;
DROP POLICY IF EXISTS "Admins can update term plans" ON public.term_plans;
DROP POLICY IF EXISTS "Anyone can view term plans" ON public.term_plans;

CREATE POLICY "Anyone can view term plans" ON public.term_plans FOR SELECT USING (true);
CREATE POLICY "Admins can insert term plans" ON public.term_plans FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update term plans" ON public.term_plans FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete term plans" ON public.term_plans FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
