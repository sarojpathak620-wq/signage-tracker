'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { 
  Building2, LogOut, 
  ChevronDown, Bell, AlertTriangle, Send, Check 
} from 'lucide-react';
import { NotificationItem } from '@/lib/types';
import { DataService } from '@/lib/data-service';

export function Navbar() {
  const { user, role, logout, isSupabaseLive } = useAuth();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Hide navbar on dedicated authentication pages
  if (pathname === '/login' || pathname === '/reset-password') {
    return null;
  }

  // Load notifications
  useEffect(() => {
    async function loadNotifs() {
      if (user) {
        try {
          const list = await DataService.getNotifications(user.id);
          setNotifications(list);
        } catch (e) {
          console.warn('Failed to load notifications:', e);
        }
      }
    }
    loadNotifs();
    const interval = setInterval(loadNotifs, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await DataService.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    for (const n of notifications.filter(n => !n.is_read)) {
      await DataService.markNotificationRead(n.id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const getRoleBadgeLabel = () => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'supervisor': return 'Supervisor';
      case 'bd_executive': return 'BD Executive';
      default: return '';
    }
  };

  const getRoleBadgeColor = () => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'supervisor': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'bd_executive': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 leading-tight text-lg tracking-tight">
                  Signage<span className="text-blue-600">Tracker</span>
                </span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  Hospital BD Marketing
                </span>
              </div>
            </Link>

            {/* Live / Demo Mode Badge */}
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 border-slate-200 text-slate-600">
              <span className={`w-2 h-2 rounded-full ${isSupabaseLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isSupabaseLive ? 'Supabase Connected' : 'Demo Sandbox'}</span>
            </div>
          </div>

          {/* User Controls */}
          {user ? (
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Notifications Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notifOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onMouseLeave={() => setNotifOpen(false)}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-900">
                          Notifications & Alerts
                        </span>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="mt-2 max-h-72 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.slice(0, 8).map((n) => (
                          <div
                            key={n.id}
                            className={`p-3 rounded-2xl border text-xs transition-colors flex items-start space-x-2.5 ${
                              n.is_read
                                ? 'bg-slate-50/60 border-slate-100 text-slate-600'
                                : 'bg-blue-50/40 border-blue-200 text-slate-900 font-medium'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {n.type === 'escalation' ? (
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                              ) : n.type === 'condition_alert' ? (
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                              ) : (
                                <Send className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-[11px] truncate">{n.title}</div>
                              <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                                {n.message}
                              </p>
                              <div className="text-[10px] text-slate-400 mt-1">
                                {new Date(n.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            {!n.is_read && (
                              <button
                                onClick={() => markAsRead(n.id)}
                                className="text-slate-400 hover:text-blue-600 p-1"
                                title="Mark read"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Role Badge (read-only, no switcher) */}
              {role && (
                <div className={`hidden sm:inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${getRoleBadgeColor()}`}>
                  <span>{getRoleBadgeLabel()}</span>
                </div>
              )}

              {/* User Profile Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {user.full_name.charAt(0)}
                  </div>
                  <span className="hidden md:inline-block text-xs font-medium text-slate-700 max-w-[120px] truncate">
                    {user.full_name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline-block" />
                </button>

                {dropdownOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <div className="font-semibold text-sm text-slate-900 truncate">{user.full_name}</div>
                      <div className="text-xs text-slate-500 truncate">{user.email || 'Demo Profile'}</div>
                      {user.phone && <div className="text-[11px] text-slate-400 mt-0.5">{user.phone}</div>}
                    </div>

                    <button
                      onClick={async () => {
                        setDropdownOpen(false);
                        await logout();
                        if (typeof window !== 'undefined') {
                          window.location.href = '/login';
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
