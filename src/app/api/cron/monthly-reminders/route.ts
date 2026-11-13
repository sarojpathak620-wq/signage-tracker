import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  return handleCronJob(request);
}

export async function POST(request: Request) {
  return handleCronJob(request);
}

async function handleCronJob(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Optional verification if CRON_SECRET is configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In development or local testing allow execution with notice
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
      }
    }

    const supabase = createAdminClient();
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const currentDay = new Date().getDate();

    // 1. Fetch active signages
    const { data: signages, error: signageErr } = await supabase
      .from('signages')
      .select('*, unit:units(*), area:areas(*), assigned_profile:profiles(*)')
      .eq('is_active', true);

    if (signageErr || !signages) {
      return NextResponse.json({ 
        success: false, 
        error: signageErr?.message || 'Failed to query signages' 
      }, { status: 500 });
    }

    // 2. Fetch updates for current month
    const { data: updates } = await supabase
      .from('signage_updates')
      .select('signage_id')
      .eq('month', currentMonth);

    const updatedSignageIds = new Set(updates?.map((u: any) => u.signage_id) || []);
    const pendingSignages = signages.filter((s: any) => !updatedSignageIds.has(s.id));

    // 3. Fetch supervisors
    const { data: supervisors } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'supervisor');

    let remindersSent = 0;
    let escalationsSent = 0;
    const executionDetails: string[] = [];

    for (const signage of pendingSignages) {
      const unitName = signage.unit?.name || 'Unit';
      const areaName = signage.area?.name || 'Area';
      const bdName = signage.assigned_profile?.full_name || 'Unassigned';

      // Stage 1: Send reminder to assigned BD Executive
      if (signage.assigned_to) {
        await supabase.from('notifications').insert({
          to_user: signage.assigned_to,
          type: 'reminder',
          title: `Monthly Inspection Reminder (${areaName})`,
          message: `Reminder: Monthly photo inspection pending for signage at ${areaName}, ${signage.address} (${unitName}). Please capture photo via camera.`,
          unit_id: signage.unit_id,
          area_id: signage.area_id,
        });
        remindersSent++;
        executionDetails.push(`[Reminder] Sent to BD ${bdName} for ${areaName} (${unitName})`);
      }

      // Stage 2: Escalate to Supervisor with Unit and Area name
      if (currentDay >= 20 && supervisors) {
        for (const sup of supervisors) {
          await supabase.from('notifications').insert({
            to_user: sup.id,
            type: 'escalation',
            title: `Signage Escalation: ${unitName} - ${areaName}`,
            message: `ESCALATION: Overdue signage inspection in Unit: "${unitName}", Area: "${areaName}". Address: ${signage.address}. Assigned BD: ${bdName}.`,
            unit_id: signage.unit_id,
            area_id: signage.area_id,
          });
          escalationsSent++;
          executionDetails.push(`[Escalation] Sent to Supervisor ${sup.full_name} for Unit "${unitName}", Area "${areaName}"`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      month: currentMonth,
      totalTracked: signages.length,
      pendingCount: pendingSignages.length,
      remindersSent,
      escalationsSent,
      executionDetails,
    });
  } catch (err: any) {
    console.error('Cron job error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
