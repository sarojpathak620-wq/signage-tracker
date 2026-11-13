'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { 
  Building2, MapPin, Users, Sliders, Settings, 
  LayoutDashboard, Map, FileBarChart2, BookmarkCheck, 
  PlusCircle, ShieldCheck, Home 
} from 'lucide-react';

export function BottomNav() {
  const { role } = useAuth();
  const pathname = usePathname();

  if (!role) return null;

  // Nav configurations based on role
  const getNavItems = () => {
    switch (role) {
      case 'admin':
        return [
          { label: 'Hub', href: '/', icon: Home },
          { label: 'Units', href: '/admin/units', icon: Building2 },
          { label: 'Areas', href: '/admin/areas', icon: MapPin },
          { label: 'Users', href: '/admin/users', icon: Users },
          { label: 'Signage', href: '/admin/signages', icon: BookmarkCheck },
          { label: 'Settings', href: '/admin/settings', icon: Settings },
        ];
      case 'supervisor':
        return [
          { label: 'Dashboard', href: '/supervisor', icon: LayoutDashboard },
          { label: 'Map View', href: '/supervisor/map', icon: Map },
          { label: 'Reports', href: '/supervisor/reports', icon: FileBarChart2 },
        ];
      case 'bd_executive':
        return [
          { label: 'My Signage', href: '/bd', icon: BookmarkCheck },
          { label: 'Register New', href: '/bd/add', icon: PlusCircle },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile Bottom Navigation (Visible on screen < md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-xl px-2 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all active:scale-95 ${
                  isActive 
                    ? 'text-blue-600 font-bold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-blue-50 text-blue-600 scale-110' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Top Sub-Bar (Visible on screen >= md) */}
      <div className="hidden md:block bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-1 h-12">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mr-4 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>{role.toUpperCase()} PORTAL</span>
            </span>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-xs font-semibold' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
