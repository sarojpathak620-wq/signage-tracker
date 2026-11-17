import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, requestId } = body;

    if (!requestId || !action) {
      return NextResponse.json({ message: 'Missing required parameters' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Signage Tracker <onboarding@resend.dev>';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://signage-tracker-three.vercel.app'));

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, message: 'Notification processed in demo mode' });
    }

    const adminClient = createAdminClient();

    // Fetch the travel request with details
    const { data: travelReq, error: reqErr } = await adminClient
      .from('travel_requests')
      .select('*, unit:units(*), stops:travel_request_stops(*)')
      .eq('id', requestId)
      .single();

    if (reqErr || !travelReq) {
      return NextResponse.json({ message: 'Travel request not found' }, { status: 404 });
    }

    // 1. Get BD Executive profile and email
    const { data: bdProfile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', travelReq.bd_executive_id)
      .single();

    let bdEmail = bdProfile?.email;
    if (!bdEmail) {
      try {
        const { data: authUser } = await adminClient.auth.admin.getUserById(travelReq.bd_executive_id);
        bdEmail = authUser?.user?.email;
      } catch (e) {
        console.warn('Could not fetch BD auth user email:', e);
      }
    }

    // 2. Handle Action: 'submitted' (Notify Unit Head)
    if (action === 'submitted') {
      // Find Unit Head(s) for this unit
      const { data: unitHeads } = await adminClient
        .from('profiles')
        .select('*')
        .eq('role', 'supervisor')
        .eq('unit_id', travelReq.unit_id);

      const targetHeads = (unitHeads && unitHeads.length > 0) ? unitHeads : [];
      const recipientEmails: string[] = [];

      for (const uh of targetHeads) {
        if (uh.email) {
          recipientEmails.push(uh.email);
        } else {
          try {
            const { data: authUh } = await adminClient.auth.admin.getUserById(uh.id);
            if (authUh?.user?.email) recipientEmails.push(authUh.user.email);
          } catch (e) {}
        }
      }

      // In-app notification for each Unit Head
      for (const uh of targetHeads) {
        await adminClient.from('notifications').insert({
          to_user: uh.id,
          type: 'travel_request_submitted',
          title: 'New Travel Request Submitted',
          message: `${bdProfile?.full_name || 'BD Executive'} submitted a travel claim for ${travelReq.month} (${Number(travelReq.total_distance_km).toFixed(1)} km across ${travelReq.stops?.length || 0} stops).`,
          unit_id: travelReq.unit_id,
        });
      }

      // If no Unit Head email found, fallback to admins
      if (recipientEmails.length === 0) {
        const { data: admins } = await adminClient.from('profiles').select('id, email').eq('role', 'admin');
        if (admins) {
          for (const adm of admins) {
            try {
              const { data: admAuth } = await adminClient.auth.admin.getUserById(adm.id);
              if (admAuth?.user?.email) recipientEmails.push(admAuth.user.email);
            } catch (e) {}
          }
        }
      }

      if (recipientEmails.length > 0 && resendApiKey && resendApiKey !== 're_placeholder') {
        try {
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 16px;">
              <div style="background: #0f172a; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px; text-align: left;">
                <h1 style="color: #ffffff; font-size: 18px; margin: 0; font-weight: 700;">Hospital BD Signage Tracker</h1>
                <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">Travel &amp; Distance Reimbursement Portal</p>
              </div>

              <div style="background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="display: inline-block; padding: 4px 10px; background: #eff6ff; color: #1d4ed8; font-weight: 600; font-size: 12px; border-radius: 6px; margin-bottom: 12px;">
                  New Travel Request
                </div>
                <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">Inspection Mileage Review Required</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
                  A new monthly travel reimbursement request has been submitted by <strong>${bdProfile?.full_name || 'BD Executive'}</strong> for hospital unit <strong>${travelReq.unit?.name || 'Assigned Unit'}</strong>.
                </p>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b;">BD Executive:</td>
                    <td style="padding: 10px 0; font-weight: 600; color: #0f172a; text-align: right;">${bdProfile?.full_name || 'BD Executive'}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b;">Month Period:</td>
                    <td style="padding: 10px 0; font-weight: 600; color: #0f172a; text-align: right;">${travelReq.month}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b;">Total Straight-line Distance:</td>
                    <td style="padding: 10px 0; font-weight: 700; color: #2563eb; text-align: right; font-size: 16px;">${Number(travelReq.total_distance_km).toFixed(1)} KM</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b;">Visited Signage Stops:</td>
                    <td style="padding: 10px 0; font-weight: 600; color: #0f172a; text-align: right;">${travelReq.stops?.length || 0} locations</td>
                  </tr>
                </table>

                <div style="text-align: center; margin-top: 24px;">
                  <a href="${appUrl}/supervisor" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
                    Review &amp; Approve on Unit Head Portal &rarr;
                  </a>
                </div>
              </div>

              <div style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 11px;">
                Hospital Signage BD Monitoring System • Automated notification
              </div>
            </div>
          `;

          const resendResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromEmail,
              to: recipientEmails,
              subject: `New Field Travel Reimbursement Request - ${bdProfile?.full_name || 'BD Executive'} (${travelReq.month})`,
              html: emailHtml,
            }),
          });

          const resendData = await resendResp.json();
          return NextResponse.json({ success: true, emailSent: true, data: resendData });
        } catch (mailErr: any) {
          console.warn('Resend send email error:', mailErr);
          return NextResponse.json({ success: true, emailSent: false, error: mailErr.message });
        }
      }

      return NextResponse.json({ success: true, emailSent: false, note: 'Resend key not live or in test mode' });
    }

    // 3. Handle Action: 'reviewed' (Notify BD Executive)
    if (action === 'reviewed') {
      const isApproved = travelReq.status === 'approved';
      const statusTitle = isApproved ? 'Approved' : 'Rejected';
      const statusColor = isApproved ? '#059669' : '#dc2626';
      const statusBg = isApproved ? '#ecfdf5' : '#fef2f2';

      // In-app notification for BD Executive
      await adminClient.from('notifications').insert({
        to_user: travelReq.bd_executive_id,
        type: `travel_request_${travelReq.status}`,
        title: `Travel Request ${statusTitle}`,
        message: `Your travel request for ${travelReq.month} (${Number(travelReq.total_distance_km).toFixed(1)} km) has been ${statusTitle} by your Unit Head.${travelReq.review_comment ? ` Remarks: "${travelReq.review_comment}"` : ''}`,
        unit_id: travelReq.unit_id,
      });

      if (bdEmail && resendApiKey && resendApiKey !== 're_placeholder') {
        try {
          const emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 16px;">
              <div style="background: #0f172a; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px; text-align: left;">
                <h1 style="color: #ffffff; font-size: 18px; margin: 0; font-weight: 700;">Hospital BD Signage Tracker</h1>
                <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">Travel &amp; Distance Reimbursement Portal</p>
              </div>

              <div style="background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="display: inline-block; padding: 4px 10px; background: ${statusBg}; color: ${statusColor}; font-weight: 700; font-size: 12px; border-radius: 6px; margin-bottom: 12px; text-transform: uppercase;">
                  ${statusTitle}
                </div>
                <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">Travel Request Decision</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
                  Hello ${bdProfile?.full_name || 'BD Executive'}, your travel reimbursement request for <strong>${travelReq.month}</strong> has been <strong>${statusTitle.toLowerCase()}</strong> by your Unit Head.
                </p>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b;">Month Period:</td>
                    <td style="padding: 10px 0; font-weight: 600; color: #0f172a; text-align: right;">${travelReq.month}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b;">Claimed Distance:</td>
                    <td style="padding: 10px 0; font-weight: 700; color: #0f172a; text-align: right;">${Number(travelReq.total_distance_km).toFixed(1)} KM</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b;">Decision:</td>
                    <td style="padding: 10px 0; font-weight: 700; color: ${statusColor}; text-align: right;">${statusTitle}</td>
                  </tr>
                  ${travelReq.review_comment ? `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 0; color: #64748b;">Unit Head Remarks:</td>
                    <td style="padding: 10px 0; font-weight: 600; color: #334155; text-align: right; font-style: italic;">"${travelReq.review_comment}"</td>
                  </tr>` : ''}
                </table>

                <div style="text-align: center; margin-top: 24px;">
                  <a href="${appUrl}/bd" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
                    Open BD Executive Portal &rarr;
                  </a>
                </div>
              </div>

              <div style="text-align: center; margin-top: 16px; color: #94a3b8; font-size: 11px;">
                Hospital Signage BD Monitoring System • Automated notification
              </div>
            </div>
          `;

          const resendResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [bdEmail],
              subject: `Travel Request ${statusTitle} - ${travelReq.month} Inspection Mileage`,
              html: emailHtml,
            }),
          });

          const resendData = await resendResp.json();
          return NextResponse.json({ success: true, emailSent: true, data: resendData });
        } catch (mailErr: any) {
          console.warn('Resend send email error to BD executive:', mailErr);
          return NextResponse.json({ success: true, emailSent: false, error: mailErr.message });
        }
      }

      return NextResponse.json({ success: true, emailSent: false, note: 'Resend key not live or in test mode' });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Travel request notify error:', err);
    return NextResponse.json({ message: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
