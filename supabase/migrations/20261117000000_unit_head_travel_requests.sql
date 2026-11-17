-- ==============================================================================
-- UNIT HEAD (SUPERVISOR) SCOPING & TRAVEL REQUESTS MIGRATION
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- 1. HELPER FUNCTION: Get authenticated user's assigned hospital unit
CREATE OR REPLACE FUNCTION public.get_auth_unit_id()
RETURNS UUID AS $$
    SELECT unit_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. CREATE TABLE: travel_requests
CREATE TABLE IF NOT EXISTS public.travel_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bd_executive_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    total_distance_km NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CREATE TABLE: travel_request_stops
CREATE TABLE IF NOT EXISTS public.travel_request_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    travel_request_id UUID NOT NULL REFERENCES public.travel_requests(id) ON DELETE CASCADE,
    signage_id UUID NOT NULL REFERENCES public.signages(id) ON DELETE CASCADE,
    signage_update_id UUID REFERENCES public.signage_updates(id) ON DELETE SET NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    distance_from_previous_km NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- 4. CREATE INDEXES FOR FAST LOOKUPS & UNIQUE MONTHLY CLAIMS
CREATE INDEX IF NOT EXISTS idx_travel_requests_unit ON public.travel_requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_travel_requests_bd ON public.travel_requests(bd_executive_id);
CREATE INDEX IF NOT EXISTS idx_travel_requests_status ON public.travel_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_requests_bd_month ON public.travel_requests(bd_executive_id, month);
CREATE INDEX IF NOT EXISTS idx_travel_request_stops_req ON public.travel_request_stops(travel_request_id);

-- 5. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.travel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_request_stops ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES FOR travel_requests
DROP POLICY IF EXISTS "travel_requests_select" ON public.travel_requests;
CREATE POLICY "travel_requests_select" ON public.travel_requests
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() = 'admin'
        OR (public.get_auth_role() = 'supervisor' AND unit_id = public.get_auth_unit_id())
        OR (public.get_auth_role() = 'bd_executive' AND bd_executive_id = auth.uid())
    );

DROP POLICY IF EXISTS "travel_requests_insert_bd" ON public.travel_requests;
CREATE POLICY "travel_requests_insert_bd" ON public.travel_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_auth_role() = 'admin'
        OR (public.get_auth_role() = 'bd_executive' AND bd_executive_id = auth.uid())
    );

DROP POLICY IF EXISTS "travel_requests_update" ON public.travel_requests;
CREATE POLICY "travel_requests_update" ON public.travel_requests
    FOR UPDATE TO authenticated
    USING (
        public.get_auth_role() = 'admin'
        OR (public.get_auth_role() = 'supervisor' AND unit_id = public.get_auth_unit_id())
    )
    WITH CHECK (
        public.get_auth_role() = 'admin'
        OR (public.get_auth_role() = 'supervisor' AND unit_id = public.get_auth_unit_id())
    );

DROP POLICY IF EXISTS "travel_requests_delete_admin" ON public.travel_requests;
CREATE POLICY "travel_requests_delete_admin" ON public.travel_requests
    FOR DELETE TO authenticated
    USING (public.get_auth_role() = 'admin');

-- 7. RLS POLICIES FOR travel_request_stops
DROP POLICY IF EXISTS "travel_request_stops_select" ON public.travel_request_stops;
CREATE POLICY "travel_request_stops_select" ON public.travel_request_stops
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.travel_requests tr
            WHERE tr.id = travel_request_stops.travel_request_id
            AND (
                (public.get_auth_role() = 'supervisor' AND tr.unit_id = public.get_auth_unit_id())
                OR (public.get_auth_role() = 'bd_executive' AND tr.bd_executive_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "travel_request_stops_insert" ON public.travel_request_stops;
CREATE POLICY "travel_request_stops_insert" ON public.travel_request_stops
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_auth_role() = 'admin'
        OR EXISTS (
            SELECT 1 FROM public.travel_requests tr
            WHERE tr.id = travel_request_stops.travel_request_id
            AND tr.bd_executive_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "travel_request_stops_delete" ON public.travel_request_stops;
CREATE POLICY "travel_request_stops_delete" ON public.travel_request_stops
    FOR DELETE TO authenticated
    USING (public.get_auth_role() = 'admin');

-- 8. UPDATE SIGNAGES SELECT POLICY: SCOPE SUPERVISOR TO ASSIGNED UNIT ONLY
DROP POLICY IF EXISTS "signages_select" ON public.signages;
CREATE POLICY "signages_select" ON public.signages
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() = 'admin'
        OR (public.get_auth_role() = 'supervisor' AND unit_id = public.get_auth_unit_id())
        OR (public.get_auth_role() = 'bd_executive' AND assigned_to = auth.uid())
    );

-- 9. UPDATE SIGNAGE_UPDATES SELECT POLICY: SCOPE SUPERVISOR TO ASSIGNED UNIT ONLY
DROP POLICY IF EXISTS "signage_updates_select" ON public.signage_updates;
CREATE POLICY "signage_updates_select" ON public.signage_updates
    FOR SELECT TO authenticated
    USING (
        public.get_auth_role() = 'admin'
        OR (
            public.get_auth_role() = 'supervisor' 
            AND EXISTS (
                SELECT 1 FROM public.signages s 
                WHERE s.id = signage_updates.signage_id 
                AND s.unit_id = public.get_auth_unit_id()
            )
        )
        OR (
            public.get_auth_role() = 'bd_executive' 
            AND uploaded_by = auth.uid()
        )
    );
