-- Seed Data for Signage Tracker
-- Run this in your Supabase SQL Editor after running the migration

-- Clean previous seed data if re-running
DELETE FROM public.signage_updates;
DELETE FROM public.signages;
DELETE FROM public.areas;
DELETE FROM public.units;
DELETE FROM public.app_settings;

-- 1. App Settings
INSERT INTO public.app_settings (key, value)
VALUES 
    ('monthly_deadline', '{"deadline_day": 25}'::jsonb),
    ('reminder_days', '{"days": [20, 28]}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Units (3 Units)
INSERT INTO public.units (id, name, city)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'City Hospital Central', 'Bangalore'),
    ('22222222-2222-2222-2222-222222222222', 'City Hospital North', 'Bangalore'),
    ('33333333-3333-3333-3333-333333333333', 'City Hospital South', 'Bangalore')
ON CONFLICT (id) DO NOTHING;

-- 3. Areas (4 Areas per Unit = 12 Areas)
INSERT INTO public.areas (id, unit_id, name)
VALUES
    -- Unit 1: Central
    ('10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'MG Road'),
    ('10000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Shivaji Nagar'),
    ('10000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Brigade Road'),
    ('10000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Richmond Town'),
    
    -- Unit 2: North
    ('20000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Hebbal Flyover'),
    ('20000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Yelahanka New Town'),
    ('20000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Sahakar Nagar'),
    ('20000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'RT Nagar Main Rd'),

    -- Unit 3: South
    ('30000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Jayanagar 4th Block'),
    ('30000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'JP Nagar Phase 2'),
    ('30000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'BTM Layout Ring Rd'),
    ('30000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'Bannerghatta Rd Junction')
ON CONFLICT (id) DO NOTHING;

-- 4. Sample Profiles
-- Note: When using Supabase Auth, you can create these users in the Auth tab or let the app register them.
-- Here we insert profiles with deterministic IDs for reference.
INSERT INTO public.profiles (id, full_name, role, phone, unit_id)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Dr. Arvind Sharma (Admin)', 'admin', '+91 98450 11223', '11111111-1111-1111-1111-111111111111'),
    ('b0000000-0000-0000-0000-000000000001', 'Vikram Sethi (Supervisor)', 'supervisor', '+91 98450 44556', NULL),
    ('c0000000-0000-0000-0000-000000000001', 'Rajesh Kumar (BD Exec 1)', 'bd_executive', '+91 98450 77889', '11111111-1111-1111-1111-111111111111'),
    ('c0000000-0000-0000-0000-000000000002', 'Priya Menon (BD Exec 2)', 'bd_executive', '+91 98450 99001', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    unit_id = EXCLUDED.unit_id;

-- 5. 20 Signages distributed across units & areas
INSERT INTO public.signages (id, unit_id, area_id, address, latitude, longitude, type, size, installed_date, assigned_to, is_active)
VALUES
    -- Unit 1: Central (Assigned to Rajesh Kumar)
    ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'Trinity Circle, Opp Metro Pillar 114, MG Road', 12.973400, 77.619100, 'Hoarding', '20x10 ft', '2025-01-15', 'c0000000-0000-0000-0000-000000000001', true),
    ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000001', 'Anil Kumble Circle Billboard, MG Road', 12.975200, 77.606800, 'Board', '15x8 ft', '2025-02-01', 'c0000000-0000-0000-0000-000000000001', true),
    ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000002', 'Bus Stand Compound Wall, Shivaji Nagar', 12.985600, 77.606300, 'Wall Paint', '30x12 ft', '2025-01-20', 'c0000000-0000-0000-0000-000000000001', true),
    ('50000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000002', 'Russell Market Corner Display, Shivaji Nagar', 12.984000, 77.603400, 'Flex', '10x6 ft', '2025-03-10', 'c0000000-0000-0000-0000-000000000001', true),
    ('50000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000003', 'Rex Theater Junction, Brigade Road', 12.971800, 77.607400, 'Hoarding', '25x12 ft', '2025-02-14', 'c0000000-0000-0000-0000-000000000001', true),
    ('50000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000003', 'Near Cauvery Emporium, Brigade Road', 12.974000, 77.608000, 'Poster', '6x4 ft', '2025-04-01', 'c0000000-0000-0000-0000-000000000001', true),
    ('50000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000004', 'Richmond Circle Gantry Board', 12.964200, 77.599800, 'Board', '20x8 ft', '2025-01-10', 'c0000000-0000-0000-0000-000000000001', true),

    -- Unit 2: North (Assigned to Priya Menon)
    ('50000000-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', '20000000-0000-0000-0000-000000000001', 'Hebbal Esteem Mall Flyover Pillar', 13.038200, 77.591900, 'Hoarding', '30x15 ft', '2025-01-05', 'c0000000-0000-0000-0000-000000000002', true),
    ('50000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', '20000000-0000-0000-0000-000000000001', 'Hebbal Kempapura Junction Arch', 13.045000, 77.597500, 'Flex', '18x10 ft', '2025-02-18', 'c0000000-0000-0000-0000-000000000002', true),
    ('50000000-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', '20000000-0000-0000-0000-000000000002', 'Yelahanka Police Station Circle', 13.100700, 77.596300, 'Board', '12x6 ft', '2025-03-01', 'c0000000-0000-0000-0000-000000000002', true),
    ('50000000-0000-0000-0000-000000000011', '22222222-2222-2222-2222-222222222222', '20000000-0000-0000-0000-000000000002', 'NES Bus Stop Side Wall, Yelahanka', 13.098000, 77.593000, 'Wall Paint', '40x12 ft', '2025-02-10', 'c0000000-0000-0000-0000-000000000002', true),
    ('50000000-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', '20000000-0000-0000-0000-000000000003', 'Sahakar Nagar Main Road 60ft Entrance', 13.062000, 77.585500, 'Hoarding', '20x10 ft', '2025-01-25', 'c0000000-0000-0000-0000-000000000002', true),
    ('50000000-0000-0000-0000-000000000013', '22222222-2222-2222-2222-222222222222', '20000000-0000-0000-0000-000000000004', 'RT Nagar Post Office Opposite Billboard', 13.023800, 77.594600, 'Board', '15x8 ft', '2025-02-28', 'c0000000-0000-0000-0000-000000000002', true),
    ('50000000-0000-0000-0000-000000000014', '22222222-2222-2222-2222-222222222222', '20000000-0000-0000-0000-000000000004', 'Dinnur Main Road Wall, RT Nagar', 13.026500, 77.591200, 'Wall Paint', '25x10 ft', '2025-03-15', 'c0000000-0000-0000-0000-000000000002', true),

    -- Unit 3: South (Split assignment)
    ('50000000-0000-0000-0000-000000000015', '33333333-3333-3333-3333-333333333333', '30000000-0000-0000-0000-000000000001', 'Jayanagar 4th Block Complex Facing Arch', 12.929800, 77.583300, 'Hoarding', '25x12 ft', '2025-01-12', 'c0000000-0000-0000-0000-000000000001', true),
    ('50000000-0000-0000-0000-000000000016', '33333333-3333-3333-3333-333333333333', '30000000-0000-0000-0000-000000000001', 'Cool Joint Corner Pillar, Jayanagar', 12.926200, 77.584000, 'Poster', '8x4 ft', '2025-03-05', 'c0000000-0000-0000-0000-000000000001', true),
    ('50000000-0000-0000-0000-000000000017', '33333333-3333-3333-3333-333333333333', '30000000-0000-0000-0000-000000000002', 'JP Nagar Underpass Gantry', 12.909000, 77.588000, 'Board', '20x6 ft', '2025-02-05', 'c0000000-0000-0000-0000-000000000002', true),
    ('50000000-0000-0000-0000-000000000018', '33333333-3333-3333-3333-333333333333', '30000000-0000-0000-0000-000000000003', 'Udupi Garden Signal, BTM Ring Road', 12.916800, 77.610100, 'Hoarding', '30x15 ft', '2025-01-18', 'c0000000-0000-0000-0000-000000000002', true),
    ('50000000-0000-0000-0000-000000000019', '33333333-3333-3333-3333-333333333333', '30000000-0000-0000-0000-000000000003', 'Madiwala Lake Road Compound Wall, BTM', 12.912500, 77.615000, 'Wall Paint', '35x10 ft', '2025-02-22', 'c0000000-0000-0000-0000-000000000001', true),
    ('50000000-0000-0000-0000-000000000020', '33333333-3333-3333-3333-333333333333', '30000000-0000-0000-0000-000000000004', 'Meenakshi Mall Flyover Bannerghatta Rd', 12.875500, 77.595800, 'Flex', '20x10 ft', '2025-03-20', 'c0000000-0000-0000-0000-000000000002', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Sample Initial Monthly Updates (Current Month)
INSERT INTO public.signage_updates (
    signage_id, month, photo_path, condition, remarks, 
    latitude, longitude, distance_from_site_m, location_mismatch, uploaded_by, uploaded_at
)
VALUES
    (
        '50000000-0000-0000-0000-000000000001', 
        date_trunc('month', CURRENT_DATE)::DATE,
        'samples/trinity_hoarding_oct.jpg',
        'Good',
        'Clean and clearly visible from Trinity signal.',
        12.973410, 77.619120, 2.5, false,
        'c0000000-0000-0000-0000-000000000001',
        CURRENT_DATE - INTERVAL '3 days'
    ),
    (
        '50000000-0000-0000-0000-000000000003', 
        date_trunc('month', CURRENT_DATE)::DATE,
        'samples/shivajinagar_wall_oct.jpg',
        'Needs Repair',
        'Left corner paint peeling due to monsoon moisture.',
        12.985650, 77.606280, 6.1, false,
        'c0000000-0000-0000-0000-000000000001',
        CURRENT_DATE - INTERVAL '2 days'
    ),
    (
        '50000000-0000-0000-0000-000000000008', 
        date_trunc('month', CURRENT_DATE)::DATE,
        'samples/hebbal_hoarding_oct.jpg',
        'Good',
        'High visibility, spotlights functioning at night.',
        13.038220, 77.591890, 3.2, false,
        'c0000000-0000-0000-0000-000000000002',
        CURRENT_DATE - INTERVAL '1 day'
    ),
    (
        '50000000-0000-0000-0000-000000000010', 
        date_trunc('month', CURRENT_DATE)::DATE,
        'samples/yelahanka_board_oct.jpg',
        'Damaged',
        'Fallen branch damaged iron frame. Immediate repair required.',
        13.100680, 77.596290, 4.0, false,
        'c0000000-0000-0000-0000-000000000002',
        CURRENT_DATE - INTERVAL '4 days'
    ),
    (
        '50000000-0000-0000-0000-000000000018', 
        date_trunc('month', CURRENT_DATE)::DATE,
        'samples/btm_hoarding_oct.jpg',
        'Missing',
        'Signage flex was removed by civic road widening works.',
        12.916850, 77.610050, 8.4, false,
        'c0000000-0000-0000-0000-000000000002',
        CURRENT_DATE - INTERVAL '5 days'
    )
ON CONFLICT (signage_id, month) DO UPDATE SET
    condition = EXCLUDED.condition,
    remarks = EXCLUDED.remarks;
