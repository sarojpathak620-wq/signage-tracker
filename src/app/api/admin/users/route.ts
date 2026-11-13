import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, full_name, role, phone, unit_id } = body;

    if (!email || !role || !full_name) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        id: crypto.randomUUID(),
        email,
        full_name,
        role,
        phone,
        unit_id,
        created_at: new Date().toISOString(),
      });
    }

    const adminClient = createAdminClient();

    // 1. Create auth user with service role
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: password || 'TempPass123!',
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        phone,
        unit_id,
      },
    });

    if (authError || !authUser.user) {
      return NextResponse.json({ message: authError?.message || 'Failed to create user' }, { status: 400 });
    }

    // 2. Ensure profile exists (in case trigger was delayed)
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        full_name,
        role,
        phone: phone || null,
        unit_id: unit_id || null,
      })
      .select('*, unit:units(*)')
      .single();

    if (profileError) {
      return NextResponse.json({ message: profileError.message }, { status: 400 });
    }

    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
