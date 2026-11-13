-- Migration: Scheduled Monthly Compliance Reminder & Escalation Job
-- Runs periodically to detect signages not updated in current month,
-- sends reminders to assigned BD Executives, and escalates overdue signages
-- to Supervisors with the Unit Name and Area Name.

-- Enable pg_cron if available
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.run_monthly_signage_reminders()
RETURNS TABLE (
    reminders_sent INTEGER,
    escalations_sent INTEGER
) AS $$
DECLARE
    curr_month DATE := date_trunc('month', CURRENT_DATE)::DATE;
    curr_day INTEGER := EXTRACT(DAY FROM CURRENT_DATE)::INTEGER;
    deadline_day INTEGER := 25;
    r_count INTEGER := 0;
    e_count INTEGER := 0;
    signage_record RECORD;
    sup_record RECORD;
BEGIN
    -- Read configured deadline if present
    SELECT COALESCE((value->>'deadline_day')::INTEGER, 25)
    INTO deadline_day
    FROM public.app_settings
    WHERE key = 'monthly_deadline';

    -- Loop through active signages not updated in the current month
    FOR signage_record IN
        SELECT 
            s.id AS signage_id,
            s.unit_id,
            u.name AS unit_name,
            s.area_id,
            a.name AS area_name,
            s.address,
            s.assigned_to,
            p.full_name AS bd_name
        FROM public.signages s
        JOIN public.units u ON u.id = s.unit_id
        JOIN public.areas a ON a.id = s.area_id
        LEFT JOIN public.profiles p ON p.id = s.assigned_to
        WHERE s.is_active = true
          AND NOT EXISTS (
              SELECT 1 
              FROM public.signage_updates up 
              WHERE up.signage_id = s.id 
                AND up.month = curr_month
          )
    LOOP
        -- 1. SEND REMINDER TO BD EXECUTIVE (if assigned and not already sent today)
        IF signage_record.assigned_to IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.notifications n
                WHERE n.to_user = signage_record.assigned_to
                  AND n.unit_id = signage_record.unit_id
                  AND n.area_id = signage_record.area_id
                  AND n.type = 'reminder'
                  AND n.sent_at::DATE = CURRENT_DATE
            ) THEN
                INSERT INTO public.notifications (
                    to_user, type, title, message, unit_id, area_id
                ) VALUES (
                    signage_record.assigned_to,
                    'reminder',
                    'Monthly Inspection Reminder (' || signage_record.area_name || ')',
                    'Reminder: Monthly photo inspection pending for signage at ' || signage_record.area_name || ', ' || signage_record.address || ' (' || signage_record.unit_name || '). Please capture photo via camera.',
                    signage_record.unit_id,
                    signage_record.area_id
                );
                r_count := r_count + 1;
            END IF;
        END IF;

        -- 2. ESCALATE TO ALL SUPERVISORS WITH UNIT AND AREA NAME
        -- Triggered if current day >= deadline (e.g. 25th) or approaching deadline (day >= 20)
        IF curr_day >= 20 THEN
            FOR sup_record IN
                SELECT id FROM public.profiles WHERE role = 'supervisor'
            LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM public.notifications n
                    WHERE n.to_user = sup_record.id
                      AND n.unit_id = signage_record.unit_id
                      AND n.area_id = signage_record.area_id
                      AND n.type = 'escalation'
                      AND n.sent_at::DATE = CURRENT_DATE
                ) THEN
                    INSERT INTO public.notifications (
                        to_user, type, title, message, unit_id, area_id
                    ) VALUES (
                        sup_record.id,
                        'escalation',
                        'Signage Escalation: ' || signage_record.unit_name || ' - ' || signage_record.area_name,
                        'ESCALATION: Overdue signage inspection in Unit: "' || signage_record.unit_name || '", Area: "' || signage_record.area_name || '". Address: ' || signage_record.address || '. Assigned BD: ' || COALESCE(signage_record.bd_name, 'Unassigned') || '.',
                        signage_record.unit_id,
                        signage_record.area_id
                    );
                    e_count := e_count + 1;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RETURN QUERY SELECT r_count, e_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule job using pg_cron at 09:00 AM on 20th and 25th of every month
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'monthly-signage-reminder-cron',
            '0 9 20,25 * *',
            'SELECT public.run_monthly_signage_reminders();'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not enabled or lacks permissions. Use Next.js API route /api/cron/monthly-reminders instead.';
END $$;
