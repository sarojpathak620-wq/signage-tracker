'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Building2, Lock, Eye, EyeOff, 
  ArrowRight, CheckCircle2, AlertCircle, ShieldCheck 
} from 'lucide-react';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    async function checkAuthSession() {
      // 1. If URL has PKCE code parameter, exchange it for session
      const code = searchParams?.get('code');
      if (code) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError && data.session) {
            if (isMounted) {
              setHasValidSession(true);
              setVerifyingSession(false);
            }
            return;
          }
        } catch (e) {
          console.warn('Code exchange error:', e);
        }
      }

      // 2. Check current session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (isMounted) {
          setHasValidSession(true);
          setVerifyingSession(false);
        }
        return;
      }

      // 3. Wait briefly for hash-based auth recovery tokens (e.g. #access_token=...)
      const timeout = setTimeout(() => {
        if (isMounted) {
          setVerifyingSession(false);
        }
      }, 1500);

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session || event === 'PASSWORD_RECOVERY') {
          clearTimeout(timeout);
          if (isMounted) {
            setHasValidSession(true);
            setVerifyingSession(false);
          }
        }
      });

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    }

    checkAuthSession();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      
      // Update user password in Supabase Auth
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSuccess(true);

      // Fetch user profile to route directly by role
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, unit:units(*)')
          .eq('id', data.user.id)
          .single();

        setTimeout(() => {
          if (profile?.role === 'admin') {
            router.push('/');
          } else if (profile?.role === 'bd_executive') {
            router.push('/bd');
          } else if (profile?.role === 'supervisor') {
            router.push('/supervisor');
          } else {
            router.push('/');
          }
        }, 1200);
      } else {
        setTimeout(() => {
          router.push('/login');
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try requesting a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Hospital Brand Badge */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
            <Building2 className="w-9 h-9" />
          </div>
        </div>
        <h2 className="mt-5 text-center text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Reset Your Password
        </h2>
        <p className="mt-1 text-center text-xs sm:text-sm text-slate-400">
          Enter your new password below to secure your account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/95 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-white/20">
          {verifyingSession ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Verifying recovery link...</p>
            </div>
          ) : success ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Password Updated Successfully!</h3>
              <p className="text-xs text-slate-500">
                Redirecting you to your portal now...
              </p>
            </div>
          ) : !hasValidSession ? (
            <div className="py-4 space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recovery Session Required</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  To reset your password, please open the recovery link sent to your email, or request a new reset link from the login page.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      placeholder="Re-type new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <span>{loading ? 'Updating Password...' : 'Save New Password'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Remember your password? Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

