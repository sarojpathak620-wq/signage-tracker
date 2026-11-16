'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Clock, AlertTriangle, LogOut } from 'lucide-react';

// Total inactivity limit: 30 minutes (1,800,000 ms)
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
// Warning triggers 1 minute before logout: 29 minutes (1,740,000 ms)
const WARNING_THRESHOLD_MS = 29 * 60 * 1000;

export function InactivityWatcher() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  const lastActivityRef = useRef<number>(Date.now());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep alive / Stay Logged In handler
  const handleStayLoggedIn = () => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setSecondsRemaining(60);
  };

  const handleManualSignOut = async () => {
    setShowWarning(false);
    await logout();
    router.push('/login');
  };

  useEffect(() => {
    // Only monitor inactivity when user is logged in and not already on auth/login pages
    if (!user || pathname === '/login' || pathname === '/reset-password') {
      setShowWarning(false);
      return;
    }

    // Reset activity timer when mounting or route changes
    lastActivityRef.current = Date.now();

    // Event listeners to detect user activity (clicks, taps, typing, scrolling)
    const events = ['mousedown', 'click', 'touchstart', 'keydown', 'scroll'];
    const handleUserInteraction = () => {
      // If warning modal is not visible, record regular activity
      if (!showWarning) {
        lastActivityRef.current = Date.now();
      }
    };

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    // Check inactivity every 1000 ms
    checkIntervalRef.current = setInterval(async () => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        // 30 minutes expired: log out and redirect to Sign In page
        clearInterval(checkIntervalRef.current!);
        setShowWarning(false);
        try {
          await logout();
        } catch (err) {
          console.error('Inactivity auto-logout error:', err);
        }
        router.push('/login');
      } else if (elapsed >= WARNING_THRESHOLD_MS) {
        // In the final 60 seconds: show warning dialog with countdown
        setShowWarning(true);
        const remainingMs = INACTIVITY_TIMEOUT_MS - elapsed;
        const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
        setSecondsRemaining(remainingSeconds);
      } else {
        if (showWarning) {
          setShowWarning(false);
        }
      }
    }, 1000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [user, pathname, showWarning, logout, router]);

  if (!showWarning || !user) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-amber-200 text-center space-y-4 animate-in zoom-in-95 duration-150">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
          <Clock className="w-7 h-7 animate-pulse text-amber-600" />
        </div>

        <div>
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Session Timeout</span>
          </span>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            You&apos;ll be signed out soon due to inactivity
          </h3>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            No activity has been detected for 29 minutes. For security, your session will automatically end in:
          </p>
          <div className="mt-3 font-mono font-black text-2xl text-amber-600">
            {secondsRemaining}s
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleStayLoggedIn}
            className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-sm font-bold shadow-md shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>Stay Logged In</span>
          </button>

          <button
            type="button"
            onClick={handleManualSignOut}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
