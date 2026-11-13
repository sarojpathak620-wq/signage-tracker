'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { 
  Building2, Users, MapPin, BookmarkCheck, Settings, 
  ArrowRight, Shield, Map, FileBarChart2, PlayCircle, 
  Send, Camera, CheckCircle2, AlertCircle, LogOut 
} from 'lucide-react';
import Link from 'next/link';
import { DataService } from '@/lib/data-service';

export default function HomePage() {
  const router = useRouter();
  const { user, role, loading, profileError, logout } = useAuth();
  const [jobRunning, setJobRunning] = useState(false);
  const [jobSummary, setJobSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user && !profileError) {
        router.push('/login');
      } else if (user && role === 'bd_executive') {
        router.push('/bd');
      } else if (user && role === 'supervisor') {
        router.push('/supervisor');
      }
    }
  }, [user, role, loading, profileError, router]);

  // If there is a profile error (e.g. RLS blocked, profile missing), show error + logout
  if (!loading && profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 shadow-lg p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Profile Load Error</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {profileError}
          </p>
          <button
            onClick={() => { logout(); router.push('/login'); }}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out & Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading || !user || role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading Signage Tracker...</span>
        </div>
      </div>
    );
  }

  const handleRunScheduledJob = async () => {
    setJobRunning(true);
    setJobSummary(null);
    try {
      const res = await DataService.runMonthlyReminderJob();
      setJobSummary(`Done: Sent ${res.remindersSent} reminders to BD Executives & ${res.escalationsSent} escalations to Supervisors.`);
    } catch (e: any) {
      setJobSummary(`Error: ${e.message}`);
    } finally {
      setJobRunning(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading Signage Tracker...</span>
        </div>
      </div>
    );
  }

  // Admin Management Hub
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-12">
      {/* Welcome Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-400/20">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Admin Central Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {user.full_name}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-2xl">
            Oversee hospital marketing signage operations across units, areas, BD executives, and scheduled compliance escalations.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleRunScheduledJob}
              disabled={jobRunning}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <PlayCircle className={`w-4 h-4 ${jobRunning ? 'animate-spin' : ''}`} />
              <span>{jobRunning ? 'Running Scheduled Job...' : 'Trigger Compliance Check'}</span>
            </button>
            <Link
              href="/supervisor"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all border border-white/10"
            >
              <span>Supervisor Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/bd"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold backdrop-blur-md transition-all border border-emerald-400/20"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>BD Executive Portal</span>
            </Link>
          </div>

          {jobSummary && (
            <div className="mt-4 p-3 rounded-2xl bg-white/10 border border-white/20 text-xs text-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{jobSummary}</span>
            </div>
          )}
        </div>
      </div>


      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Supervisor Dashboard */}
        <Link
          href="/supervisor"
          className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Supervisor Command Center</h3>
            <p className="mt-1 text-xs text-slate-500">
              Unit-wise status (Updated / Pending / Overdue), condition filters, inspection audit records.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
            <span>Open Supervisor Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Map of Signages */}
        <Link
          href="/supervisor/map"
          className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-cyan-600 group-hover:text-white transition-all shadow-xs">
              <Map className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Geospatial Signage Map</h3>
            <p className="mt-1 text-xs text-slate-500">
              Interactive map pins colored by condition and status with GPS verification.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-cyan-600 group-hover:translate-x-0.5 transition-transform">
            <span>Explore Map</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* BD Executive Field Portal */}
        <Link
          href="/bd"
          className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">BD Executive Portal</h3>
            <p className="mt-1 text-xs text-slate-500">
              Mobile camera-only monthly photo inspection, condition selector, and GPS lock.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-600 group-hover:translate-x-0.5 transition-transform">
            <span>Open Field Portal</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Monthly Reports */}
        <Link
          href="/supervisor/reports"
          className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
              <FileBarChart2 className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Monthly Compliance Reports</h3>
            <p className="mt-1 text-xs text-slate-500">
              Export unit-wise reports to CSV, print summaries, and inspect audit trails.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
            <span>Generate Reports</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Hospital Units */}
        <Link
          href="/admin/units"
          className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Hospital Units</h3>
            <p className="mt-1 text-xs text-slate-500">
              Manage multi-city hospital units and facilities where campaigns run.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
            <span>Manage Units</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Areas */}
        <Link
          href="/admin/areas"
          className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-teal-600 group-hover:text-white transition-all shadow-xs">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Geographical Areas</h3>
            <p className="mt-1 text-xs text-slate-500">
              Define operational zones, coverage districts, and campaign clusters.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-teal-600 group-hover:translate-x-0.5 transition-transform">
            <span>Manage Areas</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Users & Roles */}
        <Link
          href="/admin/users"
          className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Users & Roles</h3>
            <p className="mt-1 text-xs text-slate-500">
              Manage BD Executives, Supervisors, and Admin accounts and unit assignments.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-purple-600 group-hover:translate-x-0.5 transition-transform">
            <span>Manage Users</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Signage Master */}
        <Link
          href="/admin/signages"
          className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-xs">
              <BookmarkCheck className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Signage Inventory</h3>
            <p className="mt-1 text-xs text-slate-500">
              Full master database of hoardings, boards, flexes, and reassignments.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-amber-600 group-hover:translate-x-0.5 transition-transform">
            <span>Manage Inventory</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Settings */}
        <Link
          href="/admin/settings"
          className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-105 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-xs">
              <Settings className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Settings & Compliance</h3>
            <p className="mt-1 text-xs text-slate-500">
              Configure monthly deadline day (e.g. 25th) and scheduled reminder days.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 group-hover:translate-x-0.5 transition-transform">
            <span>Configure Settings</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>
    </div>
  );
}
