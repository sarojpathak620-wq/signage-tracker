'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

const PUBLIC_PATHS = ['/login', '/reset-password'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname?.startsWith(p + '/'));

  useEffect(() => {
    if (loading) return;

    // 1. If not logged in and attempting to view any protected page -> redirect to /login
    if (!user && !isPublic) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      } else {
        router.replace('/login');
      }
      return;
    }

    // 2. If already logged in and visiting /login -> redirect to designated portal
    if (user && pathname === '/login') {
      if (role === 'admin') router.replace('/admin');
      else if (role === 'bd_executive') router.replace('/bd');
      else if (role === 'supervisor') router.replace('/supervisor');
      else router.replace('/');
      return;
    }

    // 3. Role enforcement across protected sections
    if (user && role) {
      if (pathname.startsWith('/admin') && role !== 'admin') {
        if (role === 'bd_executive') router.replace('/bd');
        else if (role === 'supervisor') router.replace('/supervisor');
      } else if (pathname.startsWith('/bd') && role !== 'bd_executive') {
        if (role === 'admin') router.replace('/admin');
        else if (role === 'supervisor') router.replace('/supervisor');
      }
    }
  }, [user, role, loading, pathname, isPublic, router]);

  // While checking auth on a protected route or redirecting, prevent showing broken or unauthorized content
  if (!isPublic && (loading || !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Redirecting to Sign In...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
