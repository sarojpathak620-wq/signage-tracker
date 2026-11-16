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
      router.replace('/login');
      return;
    }

    // 2. If already logged in and visiting /login -> redirect to designated portal
    if (user && pathname === '/login') {
      let dest = '/';
      if (role === 'admin') dest = '/admin/signages';
      else if (role === 'bd_executive') dest = '/bd';
      else if (role === 'supervisor') dest = '/supervisor';
      router.replace(dest);
      return;
    }

    // 3. Role enforcement across protected sections
    if (user && role) {
      if (pathname.startsWith('/admin') && role !== 'admin') {
        router.replace(role === 'bd_executive' ? '/bd' : '/supervisor');
      } else if (pathname.startsWith('/bd') && role !== 'bd_executive') {
        router.replace(role === 'admin' ? '/admin/signages' : '/supervisor');
      }
    }
  }, [user, role, loading, pathname, isPublic, router]);

  // While checking auth on a protected route or redirecting, prevent showing broken or unauthorized content
  if (!isPublic && (loading || !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading session...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
