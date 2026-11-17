'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Signage, Unit, Area, SignageCondition, SignageStatus, TravelRequest, TravelRequestStatus } from '@/lib/types';
import { DataService, getUnitBaseCoordinates, buildGoogleMapsDirectionsUrl, getSignageCode } from '@/lib/data-service';
import { useAuth } from '@/contexts/auth-context';
import { 
  Building2, MapPin, CheckCircle2, Clock, AlertTriangle, 
  Map, FileBarChart2, Search, Filter, Shield, 
  Sparkles, RefreshCw, Phone, ExternalLink, Camera, 
  AlertOctagon, HelpCircle, Send, PlayCircle, Eye, X, 
  Download, ArrowUpRight, Navigation, CheckCircle, XCircle, MessageSquare,
  Compass, Route, FileSpreadsheet
} from 'lucide-react';

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const [signages, setSignages] = useState<Signage[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitSummaries, setUnitSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isUnitHead = user?.role === 'supervisor';
  const assignedUnitId = isUnitHead ? user?.unit_id : null;

  // Tabs: 'signages' or 'travel'
  const [activeTab, setActiveTab] = useState<'signages' | 'travel'>('signages');

  // Travel Requests state
  const [travelRequests, setTravelRequests] = useState<TravelRequest[]>([]);
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    request: TravelRequest | null;
    action: 'approved' | 'rejected';
    comment: string;
    submitting: boolean;
  }>({
    open: false,
    request: null,
    action: 'approved',
    comment: '',
    submitting: false,
  });

  // Filters
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Inspection Photo Modal
  const [inspectingSignage, setInspectingSignage] = useState<Signage | null>(null);

  // Scheduled Job state
  const [jobRunning, setJobRunning] = useState(false);
  const [jobResult, setJobResult] = useState<{
    remindersSent: number;
    escalationsSent: number;
    details: string[];
  } | null>(null);

  const loadDashboardData = async () => {
    try {
      const [signagesData, unitsData, summariesData, travelData] = await Promise.all([
        DataService.getSignages({
          is_active: true,
          unit_id: assignedUnitId || undefined,
        }),
        DataService.getUnits(),
        DataService.getUnitStatusSummary(),
        DataService.getTravelRequests({
          unit_id: assignedUnitId || undefined,
        }),
      ]);

      const visibleUnits = assignedUnitId 
        ? unitsData.filter(u => u.id === assignedUnitId)
        : unitsData;
      const visibleSummaries = assignedUnitId
        ? summariesData.filter(s => s.unit?.id === assignedUnitId)
        : summariesData;

      setSignages(signagesData);
      setUnits(visibleUnits);
      setUnitSummaries(visibleSummaries);
      setTravelRequests(travelData);
      if (assignedUnitId) {
        setSelectedUnitId(assignedUnitId);
      }
    } catch (err) {
      console.error('Failed to load Unit Head data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [assignedUnitId]);

  // Run scheduled compliance & reminder job
  const handleRunScheduledJob = async () => {
    setJobRunning(true);
    try {
      const result = await DataService.runMonthlyReminderJob();
      setJobResult(result);
      await loadDashboardData();
    } catch (e) {
      console.error('Job error:', e);
    } finally {
      setJobRunning(false);
    }
  };

  // Filter signages
  const filteredSignages = signages.filter((s) => {
    const matchesUnit = selectedUnitId === 'all' || s.unit_id === selectedUnitId;
    const matchesStatus = selectedStatus === 'all' || s.current_month_status === selectedStatus;
    const currentCondition = s.latest_update?.condition || 'Pending Inspection';
    const matchesCondition = selectedCondition === 'all' || currentCondition === selectedCondition;
    const matchesSearch = 
      s.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.area?.name && s.area.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.unit?.name && s.unit.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.assigned_profile?.full_name && s.assigned_profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesUnit && matchesStatus && matchesCondition && matchesSearch;
  });

  // Overall statistics
  const totalCount = signages.length;
  const updatedCount = signages.filter(s => s.current_month_status === 'Updated').length;
  const pendingCount = signages.filter(s => s.current_month_status === 'Pending').length;
  const overdueCount = signages.filter(s => s.current_month_status === 'Overdue').length;
  const overallCompliance = totalCount > 0 ? Math.round((updatedCount / totalCount) * 100) : 0;

  // Condition counts
  const goodCount = signages.filter(s => s.latest_update?.condition === 'Good').length;
  const repairCount = signages.filter(s => s.latest_update?.condition === 'Needs Repair').length;
  const damagedCount = signages.filter(s => s.latest_update?.condition === 'Damaged').length;
  const missingCount = signages.filter(s => s.latest_update?.condition === 'Missing').length;

  const pendingTravelCount = travelRequests.filter(r => r.status === 'pending').length;

  const handleOpenReview = (request: TravelRequest, action: 'approved' | 'rejected') => {
    setReviewModal({
      open: true,
      request,
      action,
      comment: '',
      submitting: false,
    });
  };

  const handleSubmitReview = async () => {
    if (!reviewModal.request || !user) return;
    setReviewModal(prev => ({ ...prev, submitting: true }));
    try {
      await DataService.updateTravelRequestStatus({
        requestId: reviewModal.request.id,
        status: reviewModal.action,
        reviewedBy: user.id,
        reviewComment: reviewModal.comment.trim() || undefined,
      });
      setReviewModal({ open: false, request: null, action: 'approved', comment: '', submitting: false });
      await loadDashboardData();
    } catch (err: any) {
      alert(`Error updating travel request: ${err.message || 'Unknown error'}`);
      setReviewModal(prev => ({ ...prev, submitting: false }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-12">
      {/* Warning if Unit Head has no assigned unit */}
      {isUnitHead && !assignedUnitId && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start space-x-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold">No Hospital Unit Assigned</div>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              Your Unit Head account is not yet linked to a hospital unit. Unit Heads have view-only access scoped strictly to one unit. Please ask an Administrator to assign your hospital unit in <strong>Admin &gt; User Management</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2 border border-blue-400/20">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Unit Head Portal (View &amp; Approve Only)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {units.length === 1 ? `${units[0].name} Signage & Travel Monitoring` : 'Hospital Outdoor Signage Monitoring'}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl">
              {assignedUnitId 
                ? 'Unit compliance tracking, interactive geospatial map, and monthly travel request approvals scoped strictly to your hospital unit.' 
                : 'Unit-wise compliance tracking, interactive geospatial map, condition monitoring, and scheduled reminder escalations.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/supervisor/map"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/10 transition-all shadow-sm"
            >
              <Map className="w-4 h-4 text-cyan-400" />
              <span>Map of Signages</span>
            </Link>
            <Link
              href="/audit-log"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/10 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-purple-400" />
              <span>Audit Log</span>
            </Link>
            <Link
              href="/supervisor/reports"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/10 transition-all shadow-sm"
            >
              <FileBarChart2 className="w-4 h-4 text-emerald-400" />
              <span>Export Reports</span>
            </Link>
            <button
              onClick={handleRunScheduledJob}
              disabled={jobRunning}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <PlayCircle className={`w-4 h-4 ${jobRunning ? 'animate-spin' : ''}`} />
              <span>{jobRunning ? 'Checking Signages...' : 'Run Scheduled Job'}</span>
            </button>
          </div>
        </div>

        {/* Global Compliance Summary Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] text-slate-300 font-medium">Total Signages</div>
            <div className="text-2xl font-black text-white mt-0.5">{totalCount}</div>
          </div>
          <div>
            <div className="text-[11px] text-emerald-300 font-medium flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Updated ({overallCompliance}%)</span>
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">{updatedCount}</div>
          </div>
          <div>
            <div className="text-[11px] text-amber-300 font-medium flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Pending</span>
            </div>
            <div className="text-2xl font-black text-amber-400 mt-0.5">{pendingCount}</div>
          </div>
          <div>
            <div className="text-[11px] text-rose-300 font-medium flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Overdue (Escalated)</span>
            </div>
            <div className="text-2xl font-black text-rose-400 mt-0.5">{overdueCount}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Signages vs Travel Requests) */}
      <div className="flex flex-wrap items-center gap-2.5 mb-6">
        <button
          onClick={() => setActiveTab('signages')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 ${
            activeTab === 'signages'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Signage Monitoring ({signages.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('travel')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 relative ${
            activeTab === 'travel'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Travel Requests Approval</span>
          {pendingTravelCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-900">
              {pendingTravelCount}
            </span>
          )}
        </button>
      </div>

      {/* Scheduled Job Notification Banner (if recently triggered) */}
      {jobResult && (
        <div className="mb-8 p-4 rounded-3xl bg-blue-50 border border-blue-200 shadow-xs animate-in fade-in duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-blue-900">
                  Scheduled Job Executed Successfully
                </h4>
                <p className="text-xs text-blue-700 mt-0.5">
                  Sent <strong>{jobResult.remindersSent} reminders</strong> to BD Executives and <strong>{jobResult.escalationsSent} escalations</strong> to Unit Heads with unit and area names.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {jobResult.details.map((item, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[10px] text-blue-800 font-mono">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setJobResult(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: Signage Monitoring */}
      {activeTab === 'signages' && (
        <>
          {/* 1. UNIT-WISE STATUS SECTION */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Unit-Wise Status Breakdown</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live status (Updated / Pending / Overdue) across all hospital locations.
            </p>
          </div>
          <button
            onClick={loadDashboardData}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {unitSummaries.map((summary) => (
            <div
              key={summary.unit.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs transition-all hover:shadow-md ${
                selectedUnitId === summary.unit.id 
                  ? 'border-blue-500 ring-2 ring-blue-500/20' 
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {summary.unit.name}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {summary.unit.city}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedUnitId(selectedUnitId === summary.unit.id ? 'all' : summary.unit.id)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all ${
                    selectedUnitId === summary.unit.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {selectedUnitId === summary.unit.id ? 'Filtering' : 'Filter Unit'}
                </button>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500 text-[11px]">Compliance Rate</span>
                  <span className="font-bold text-slate-800">{summary.complianceRate}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${summary.total > 0 ? (summary.updated / summary.total) * 100 : 0}%` }}
                    title={`Updated: ${summary.updated}`}
                  />
                  <div
                    className="bg-amber-400 h-full transition-all"
                    style={{ width: `${summary.total > 0 ? (summary.pending / summary.total) * 100 : 0}%` }}
                    title={`Pending: ${summary.pending}`}
                  />
                  <div
                    className="bg-rose-500 h-full transition-all"
                    style={{ width: `${summary.total > 0 ? (summary.overdue / summary.total) * 100 : 0}%` }}
                    title={`Overdue: ${summary.overdue}`}
                  />
                </div>
              </div>

              {/* Counts */}
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                <div className="p-1.5 rounded-xl bg-emerald-50/70">
                  <div className="text-[10px] font-medium text-emerald-800">Updated</div>
                  <div className="text-base font-bold text-emerald-700">{summary.updated}</div>
                </div>
                <div className="p-1.5 rounded-xl bg-amber-50/70">
                  <div className="text-[10px] font-medium text-amber-800">Pending</div>
                  <div className="text-base font-bold text-amber-700">{summary.pending}</div>
                </div>
                <div className="p-1.5 rounded-xl bg-rose-50/70">
                  <div className="text-[10px] font-medium text-rose-800">Overdue</div>
                  <div className="text-base font-bold text-rose-700">{summary.overdue}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. CONDITION FILTERS & SEARCH BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by area, address, unit, or BD executive..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Unit selector */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Unit:</span>
            {assignedUnitId ? (
              <span className="px-3 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
                {units.find(u => u.id === assignedUnitId)?.name || 'Assigned Unit'} (Scoped)
              </span>
            ) : (
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 cursor-pointer w-full sm:w-auto"
              >
                <option value="all">All Hospital Units</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Condition Filter Tabs (Good / Needs Repair / Damaged / Missing) */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Condition Filter:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCondition('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedCondition === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              All Conditions ({totalCount})
            </button>
            <button
              onClick={() => setSelectedCondition('Good')}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                selectedCondition === 'Good'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Good ({goodCount})</span>
            </button>
            <button
              onClick={() => setSelectedCondition('Needs Repair')}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                selectedCondition === 'Needs Repair'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Needs Repair ({repairCount})</span>
            </button>
            <button
              onClick={() => setSelectedCondition('Damaged')}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                selectedCondition === 'Damaged'
                  ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                  : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Damaged ({damagedCount})</span>
            </button>
            <button
              onClick={() => setSelectedCondition('Missing')}
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                selectedCondition === 'Missing'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Missing ({missingCount})</span>
            </button>
          </div>
        </div>

        {/* Status Filter Tabs (Updated / Pending / Overdue) */}
        <div className="pt-2 border-t border-slate-100 flex items-center space-x-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Status:
          </span>
          <div className="flex items-center space-x-1.5">
            {(['all', 'Updated', 'Pending', 'Overdue'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedStatus === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {st === 'all' ? 'All Statuses' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. SIGNAGES INVENTORY TABLE & LIST */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Outdoor Signage Assets ({filteredSignages.length})
            </h3>
            <p className="text-xs text-slate-500">
              Detailed tracking records with photo evidence and location verification.
            </p>
          </div>
          <Link
            href="/supervisor/reports"
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Link>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-3 text-xs text-slate-500 font-medium">Loading inventory...</p>
          </div>
        ) : filteredSignages.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-xs text-slate-500">No signages match the selected filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Signage & Area</th>
                  <th className="py-3 px-4">Hospital Unit</th>
                  <th className="py-3 px-4">Assigned BD Executive</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4">Photo Evidence</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSignages.map((signage) => {
                  const update = signage.latest_update;
                  const isUpdated = signage.current_month_status === 'Updated';
                  const isOverdue = signage.current_month_status === 'Overdue';

                  return (
                    <tr key={signage.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Area & Address */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 truncate">
                          {signage.area?.name || 'Area'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {signage.address}
                        </div>
                        <div className="mt-1 flex items-center space-x-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                            {signage.type}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {signage.latitude.toFixed(4)}, {signage.longitude.toFixed(4)}
                          </span>
                        </div>
                      </td>

                      {/* Hospital Unit */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {signage.unit?.name || 'Unit'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {signage.unit?.city}
                        </div>
                      </td>

                      {/* Assigned BD */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {signage.assigned_profile ? (
                          <div>
                            <div className="font-semibold text-slate-800">
                              {signage.assigned_profile.full_name}
                            </div>
                            {signage.assigned_profile.phone && (
                              <a
                                href={`tel:${signage.assigned_profile.phone}`}
                                className="inline-flex items-center space-x-1 text-[11px] text-blue-600 hover:text-blue-700 mt-0.5"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{signage.assigned_profile.phone}</span>
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isUpdated ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Updated</span>
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Overdue</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      {/* Condition */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {update ? (
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            update.condition === 'Good'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : update.condition === 'Needs Repair'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : update.condition === 'Damaged'
                              ? 'bg-orange-50 text-orange-800 border-orange-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            <span>{update.condition}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No inspection</span>
                        )}
                      </td>

                      {/* Photo Thumbnail */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {update?.photo_url ? (
                          <button
                            type="button"
                            onClick={() => setInspectingSignage(signage)}
                            className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-2xs hover:scale-105 transition-transform cursor-pointer"
                          >
                            <img
                              src={update.photo_url}
                              alt="Inspection"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-slate-900/20 flex items-center justify-center">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">No Photo</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setInspectingSignage(signage)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}

      {/* Tab Content: Travel Requests Approval */}
      {activeTab === 'travel' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Navigation className="w-3 h-3" />
                <span>Inspection Mileage Verification</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                BD Executive Travel Requests ({travelRequests.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review submitted travel logs, GPS routes, and approve or reject travel reimbursement requests for your assigned hospital unit.
              </p>
            </div>
            <button
              onClick={loadDashboardData}
              className="self-start sm:self-auto text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Requests</span>
            </button>
          </div>

          {travelRequests.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Navigation className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Travel Requests Found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                When BD executives submit monthly signage inspection mileage for this unit, their requests will appear here for your review and approval.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">BD Executive</th>
                    <th className="py-3 px-4">Hospital Unit</th>
                    <th className="py-3 px-4">Month</th>
                    <th className="py-3 px-4">Total Distance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Review Details</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {travelRequests.map((req) => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const isRejected = req.status === 'rejected';

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {req.bd_executive?.full_name || 'BD Executive'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {req.bd_executive?.email}
                          </div>
                          {req.bd_executive?.phone && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {req.bd_executive.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {req.unit?.name || 'Unit'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {req.unit?.city}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium text-slate-800">
                            {req.month}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            Submitted {new Date(req.submitted_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {Number(req.total_distance_km).toFixed(1)} km
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                              {req.is_round_trip !== false ? 'Round Trip' : 'One Way'}
                            </span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-700 mt-1 flex items-center space-x-1">
                            <span>Hospital ↔</span>
                            {req.stops && req.stops.length > 0 ? (
                              <span className="font-mono font-bold text-blue-600">
                                {req.stops.map((s, i) => getSignageCode(s.signage, i + 1)).join(', ')}
                              </span>
                            ) : (
                              <span className="text-slate-500">Hoardings</span>
                            )}
                          </div>
                          {req.travel_purpose && (
                            <div className="text-[10px] text-slate-500 italic mt-0.5 max-w-[200px] truncate" title={req.travel_purpose}>
                              &ldquo;{req.travel_purpose}&rdquo;
                            </div>
                          )}
                          {(() => {
                            const baseLoc = getUnitBaseCoordinates(req.unit);
                            const gmapsUrl = buildGoogleMapsDirectionsUrl({
                              originLat: baseLoc.latitude,
                              originLng: baseLoc.longitude,
                              originName: baseLoc.name,
                              stops: req.stops?.map(s => ({ lat: Number(s.latitude), lng: Number(s.longitude) })) || [],
                              isRoundTrip: Boolean(req.is_round_trip ?? true),
                            });
                            return (
                              <a
                                href={gmapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 mt-1 cursor-pointer"
                              >
                                <Compass className="w-3 h-3" />
                                <span>Driving Directions</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                              </a>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isPending && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              <span>Pending Review</span>
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle className="w-3 h-3" />
                              <span>Approved</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          {req.reviewed_by ? (
                            <div>
                              <div className="text-[11px] font-semibold text-slate-800">
                                By {req.reviewer?.full_name || 'Unit Head'}
                              </div>
                              {req.reviewed_at && (
                                <div className="text-[10px] text-slate-400">
                                  {new Date(req.reviewed_at).toLocaleDateString()}
                                </div>
                              )}
                              {req.review_comment && (
                                <p className="text-[11px] text-slate-600 italic mt-0.5 truncate">
                                  "{req.review_comment}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Awaiting decision</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleOpenReview(req, 'approved')}
                              className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center space-x-1 ${
                                isApproved 
                                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                              }`}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleOpenReview(req, 'rejected')}
                              className={`px-2.5 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center space-x-1 ${
                                isRejected
                                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Inspection Details Modal */}
      {inspectingSignage && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setInspectingSignage(null)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-xs text-blue-300 font-semibold uppercase tracking-wider">
                  {inspectingSignage.unit?.name}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {inspectingSignage.area?.name} • {inspectingSignage.type}
                </h3>
              </div>
              <button
                onClick={() => setInspectingSignage(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Photo preview */}
              {inspectingSignage.latest_update?.photo_url ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-900">
                  <img
                    src={inspectingSignage.latest_update.photo_url}
                    alt="Signage photo"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-sm p-2 rounded-xl text-white text-[11px] flex items-center justify-between">
                    <span>
                      Inspected: {new Date(inspectingSignage.latest_update.uploaded_at).toLocaleString()}
                    </span>
                    <span className="font-bold text-emerald-400">
                      {inspectingSignage.latest_update.condition}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium mt-2">
                    No camera photo uploaded for current month yet.
                  </p>
                </div>
              )}

              {/* Information Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Address</div>
                  <div className="font-semibold text-slate-800 mt-0.5">{inspectingSignage.address}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">GPS Coordinates</div>
                  <div className="font-mono text-slate-800 mt-0.5">
                    {inspectingSignage.latitude.toFixed(5)}, {inspectingSignage.longitude.toFixed(5)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Assigned Executive</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {inspectingSignage.assigned_profile?.full_name || 'Unassigned'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Current Month Status</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {inspectingSignage.current_month_status}
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {inspectingSignage.latest_update?.remarks && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                    Executive Field Remarks
                  </div>
                  <p className="text-slate-700 italic">
                    "{inspectingSignage.latest_update.remarks}"
                  </p>
                </div>
              )}

              {/* Location Verification Warning */}
              {inspectingSignage.latest_update?.location_mismatch && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Location Mismatch Alert:</span> Photo was captured {inspectingSignage.latest_update.distance_from_site_m} meters away from registered GPS coordinates.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setInspectingSignage(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Travel Request Review Modal */}
      {reviewModal.open && reviewModal.request && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => !reviewModal.submitting && setReviewModal({ open: false, request: null, action: 'approved', comment: '', submitting: false })}
        >
          <div 
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`p-5 ${reviewModal.action === 'approved' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'} flex items-center justify-between`}>
              <div className="flex items-center space-x-2.5">
                {reviewModal.action === 'approved' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-100" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-100" />
                )}
                <div>
                  <h3 className="font-bold text-sm">
                    {reviewModal.action === 'approved' ? 'Approve Travel Request' : 'Reject Travel Request'}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Unit Head Approval • {reviewModal.request.unit?.name || 'Unit'}
                  </p>
                </div>
              </div>
              <button
                disabled={reviewModal.submitting}
                onClick={() => setReviewModal({ open: false, request: null, action: 'approved', comment: '', submitting: false })}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">BD Executive:</span>
                  <span className="font-bold text-slate-800">{reviewModal.request.bd_executive?.full_name || 'BD Executive'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Month:</span>
                  <span className="font-bold text-slate-800">{reviewModal.request.month}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Starting Location:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                    {reviewModal.request.start_location || 'Hospital Base Office'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Trip Type:</span>
                  <span className="font-semibold text-slate-800">
                    {reviewModal.request.is_round_trip ? 'Round Trip (Returned to Base)' : 'One-way Trip'}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-1">
                  <span className="text-slate-700 font-bold">Total Claimed Distance:</span>
                  <span className="font-mono font-black text-blue-600 text-sm">
                    {Number(reviewModal.request.total_distance_km).toFixed(1)} km
                  </span>
                </div>
                {reviewModal.request.travel_purpose && (
                  <div className="border-t border-slate-200/60 pt-1">
                    <span className="text-slate-500 block mb-0.5">Purpose / Camp Notes:</span>
                    <span className="font-medium text-slate-700 italic block line-clamp-2">
                      &ldquo;{reviewModal.request.travel_purpose}&rdquo;
                    </span>
                  </div>
                )}
                {(() => {
                  const baseLoc = getUnitBaseCoordinates(reviewModal.request.unit);
                  const modalGmapsUrl = buildGoogleMapsDirectionsUrl({
                    originLat: baseLoc.latitude,
                    originLng: baseLoc.longitude,
                    originName: baseLoc.name,
                    stops: reviewModal.request.stops?.map(s => ({ lat: Number(s.latitude), lng: Number(s.longitude) })) || [],
                    isRoundTrip: Boolean(reviewModal.request.is_round_trip),
                  });
                  return (
                    <div className="pt-2 border-t border-slate-200/60">
                      <a
                        href={modalGmapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 cursor-pointer transition-colors w-full justify-center shadow-2xs"
                      >
                        <Compass className="w-3.5 h-3.5 text-blue-600" />
                        <span>Verify Driving Route on Google Maps</span>
                        <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                      </a>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Review Comment / Remarks (Optional)
                </label>
                <textarea
                  value={reviewModal.comment}
                  onChange={(e) => setReviewModal(prev => ({ ...prev, comment: e.target.value }))}
                  placeholder={reviewModal.action === 'approved' ? 'e.g. Verified inspection stops against registered GPS coordinates. Approved.' : 'e.g. Incomplete route logs. Please check and resubmit.'}
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={reviewModal.submitting}
                  onClick={() => setReviewModal({ open: false, request: null, action: 'approved', comment: '', submitting: false })}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reviewModal.submitting}
                  onClick={handleSubmitReview}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                    reviewModal.action === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {reviewModal.submitting ? 'Saving Decision...' : `Confirm ${reviewModal.action === 'approved' ? 'Approval' : 'Rejection'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
