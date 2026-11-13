-- Signage Tracker Initial Schema
-- Run this in your Supabase SQL Editor

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. UNITS TABLE
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. AREAS TABLE
CREATE TABLE IF NOT EXISTS public.areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PROFILES TABLE (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'bd_executive', 'supervisor')),
    phone TEXT,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. SIGNAGES TABLE
CREATE TABLE IF NOT EXISTS public.signages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    area_id UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Hoarding', 'Wall Paint', 'Poster', 'Board', 'Flex', 'Other')),
    size TEXT,
    installed_date DATE DEFAULT CURRENT_DATE,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. SIGNAGE UPDATES TABLE
CREATE TABLE IF NOT EXISTS public.signage_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signage_id UUID NOT NULL REFERENCES public.signages(id) ON DELETE CASCADE,
    month DATE NOT NULL, -- First day of month (YYYY-MM-01)
    photo_path TEXT NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('Good', 'Needs Repair', 'Damaged', 'Missing')),
    remarks TEXT,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    distance_from_site_m NUMERIC(10, 2),
    location_mismatch BOOLEAN NOT NULL DEFAULT false,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_signage_month UNIQUE(signage_id, month)
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'reminder', 'escalation', 'condition_alert'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. APP SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. INDEXES
CREATE INDEX IF NOT EXISTS idx_signages_unit ON public.signages(unit_id);
CREATE INDEX IF NOT EXISTS idx_signages_area ON public.signages(area_id);
CREATE INDEX IF NOT EXISTS idx_signages_assigned ON public.signages(assigned_to);
CREATE INDEX IF NOT EXISTS idx_signages_active ON public.signages(is_active);
CREATE INDEX IF NOT EXISTS idx_updates_signage_month ON public.signage_updates(signage_id, month);
CREATE INDEX IF NOT EXISTS idx_notifications_to_user ON public.notifications(to_user, is_read);

-- 10. CURRENT MONTH STATUS VIEW
CREATE OR REPLACE VIEW public.signage_status_current_month AS
WITH current_month_start AS (
    SELECT date_trunc('month', CURRENT_DATE)::DATE AS m_start
),
current_settings AS (
    SELECT COALESCE((value->>'deadline_day')::INTEGER, 25) AS deadline_day
    FROM public.app_settings
    WHERE key = 'monthly_deadline'
    UNION ALL
    SELECT 25 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'monthly_deadline')
    LIMIT 1
)
SELECT 
    s.id AS signage_id,
    s.unit_id,
    u.name AS unit_name,
    u.city AS unit_city,
    s.area_id,
    a.name AS area_name,
    s.address,
    s.latitude,
    s.longitude,
    s.type,
    s.size,
    s.installed_date,
    s.assigned_to,
    p.full_name AS assigned_to_name,
    p.phone AS assigned_to_phone,
    s.is_active,
    s.created_at,
    u_curr.id AS update_id,
    u_curr.photo_path,
    u_curr.condition,
    u_curr.remarks,
    u_curr.uploaded_at,
    u_curr.location_mismatch,
    u_curr.distance_from_site_m,
    CASE 
        WHEN u_curr.id IS NOT NULL THEN 'Updated'
        WHEN EXTRACT(DAY FROM CURRENT_DATE) > (SELECT deadline_day FROM current_settings) THEN 'Overdue'
        ELSE 'Pending'
    END AS status,
    COALESCE(
        u_curr.condition,
        (
            SELECT condition 
            FROM public.signage_updates prev 
            WHERE prev.signage_id = s.id 
            ORDER BY prev.uploaded_at DESC 
            LIMIT 1
        ),
        'Good'
    ) AS last_condition
FROM public.signages s
CROSS JOIN current_month_start cms
JOIN public.units u ON u.id = s.unit_id
JOIN public.areas a ON a.id = s.area_id
LEFT JOIN public.profiles p ON p.id = s.assigned_to
LEFT JOIN public.signage_updates u_curr 
    ON u_curr.signage_id = s.id 
    AND u_curr.month = cms.m_start
WHERE s.is_active = true;

-- 11. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signage_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- UNITS policies
CREATE POLICY "units_select_authenticated" ON public.units
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "units_admin_all" ON public.units
    FOR ALL TO authenticated
    USING (public.get_auth_role() = 'admin')
    WITH CHECK (public.get_auth_role() = 'admin');

-- AREAS policies
CREATE POLICY "areas_select_authenticated" ON public.areas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "areas_admin_all" ON public.areas
    FOR ALL TO authenticated
    USING (public.get_auth_role() = 'admin')
    WITH CHECK (public.get_auth_role() = 'admin');

-- PROFILES policies
CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_self" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.get_auth_role() = 'admin')
    WITH CHECK (id = auth.uid() OR public.get_auth_role() = 'admin');

CREATE POLICY "profiles_admin_insert" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.get_auth_role() = 'admin' OR id = auth.uid());

CREATE POLICY "profiles_admin_delete" ON public.profiles
    FOR DELETE TO authenticated
    USING (public.get_auth_role() = 'admin');

-- SIGNAGES policies
CREATE POLICY "signages_select" ON public.signages
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() IN ('admin', 'supervisor') 
        OR (public.get_auth_role() = 'bd_executive' AND assigned_to = auth.uid())
    );

CREATE POLICY "signages_insert" ON public.signages
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_auth_role() = 'admin'
        OR (public.get_auth_role() = 'bd_executive' AND assigned_to = auth.uid())
    );

CREATE POLICY "signages_update" ON public.signages
    FOR UPDATE TO authenticated
    USING (
        public.get_auth_role() = 'admin'
        OR (public.get_auth_role() = 'bd_executive' AND assigned_to = auth.uid())
    )
    WITH CHECK (
        public.get_auth_role() = 'admin'
        OR (public.get_auth_role() = 'bd_executive' AND assigned_to = auth.uid())
    );

CREATE POLICY "signages_delete" ON public.signages
    FOR DELETE TO authenticated
    USING (public.get_auth_role() = 'admin');

-- SIGNAGE UPDATES policies
CREATE POLICY "signage_updates_select" ON public.signage_updates
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() IN ('admin', 'supervisor')
        OR (
            public.get_auth_role() = 'bd_executive' AND 
            EXISTS (
                SELECT 1 FROM public.signages s 
                WHERE s.id = signage_updates.signage_id AND s.assigned_to = auth.uid()
            )
        )
    );

CREATE POLICY "signage_updates_insert" ON public.signage_updates
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_auth_role() = 'admin'
        OR (
            public.get_auth_role() = 'bd_executive' AND
            EXISTS (
                SELECT 1 FROM public.signages s 
                WHERE s.id = signage_updates.signage_id AND s.assigned_to = auth.uid()
            )
        )
    );

-- Prevent more than one update per month (allow replacing only on same day)
CREATE POLICY "signage_updates_update_same_day" ON public.signage_updates
    FOR UPDATE TO authenticated
    USING (
        (public.get_auth_role() = 'admin')
        OR (
            uploaded_by = auth.uid() 
            AND uploaded_at::DATE = CURRENT_DATE
        )
    );

-- NOTIFICATIONS policies
CREATE POLICY "notifications_select" ON public.notifications
    FOR SELECT TO authenticated
    USING (to_user = auth.uid() OR public.get_auth_role() = 'admin');

CREATE POLICY "notifications_update" ON public.notifications
    FOR UPDATE TO authenticated
    USING (to_user = auth.uid())
    WITH CHECK (to_user = auth.uid());

CREATE POLICY "notifications_insert" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- APP SETTINGS policies
CREATE POLICY "app_settings_select" ON public.app_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_settings_admin_all" ON public.app_settings
    FOR ALL TO authenticated
    USING (public.get_auth_role() = 'admin')
    WITH CHECK (public.get_auth_role() = 'admin');

-- 12. TRIGGER ON AUTH.USERS TO SYNC PROFILE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, phone, unit_id)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'role', 'bd_executive'),
        new.raw_user_meta_data->>'phone',
        NULLIF(new.raw_user_meta_data->>'unit_id', '')::UUID
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        unit_id = EXCLUDED.unit_id;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 13. STORAGE BUCKET CONFIGURATION (signage-photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('signage-photos', 'signage-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "signage_photos_authenticated_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'signage-photos');

CREATE POLICY "signage_photos_authenticated_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'signage-photos');

CREATE POLICY "signage_photos_authenticated_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'signage-photos');
