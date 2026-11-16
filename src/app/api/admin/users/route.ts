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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ message: 'Missing userId parameter' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, message: 'Deleted in demo mode' });
    }

    const adminClient = createAdminClient();

    // 1. Safety check: prevent deleting the last remaining admin
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (targetProfile?.role === 'admin') {
      const { count: adminCount } = await adminClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      if ((adminCount ?? 0) <= 1) {
        return NextResponse.json(
          { message: 'Cannot delete the last remaining admin account.' },
          { status: 400 }
        );
      }
    }

    // 2. Unassign all signages currently assigned to this user (set assigned_to = NULL, not deleted)
    const { error: unassignError } = await adminClient
      .from('signages')
      .update({ assigned_to: null })
      .eq('assigned_to', userId);

    if (unassignError) {
      console.warn('Could not unassign signages:', unassignError);
    }

    // 3. Clean up notifications for this user
    try {
      await adminClient.from('notifications').delete().eq('to_user', userId);
    } catch (notifErr) {
      console.warn('Could not clean notifications:', notifErr);
    }

    // 4. Try unlinking uploaded_by on signage_updates if column is nullable
    // (This guarantees past updates and photos are NEVER deleted when profile is deleted)
    try {
      await adminClient
        .from('signage_updates')
        .update({ uploaded_by: null })
        .eq('uploaded_by', userId);
    } catch (updateErr) {
      console.warn('Could not unlink uploaded_by on signage_updates:', updateErr);
    }

    // 5. Delete profile record
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      return NextResponse.json({ message: profileError.message }, { status: 400 });
    }

    // 6. Delete user from Supabase Auth
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    if (authError) {
      console.warn('Auth user delete warning:', authError);
      // Profile already deleted
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('Delete user error:', err);
    return NextResponse.json({ message: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
