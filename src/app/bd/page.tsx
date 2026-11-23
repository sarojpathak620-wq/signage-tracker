'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PlusCircle, Camera, CheckCircle2, Clock, AlertTriangle,
  MapPin, Search, ShieldCheck, ChevronRight, RefreshCw,
  AlertOctagon, HelpCircle, Eye, X, ImageOff, Compass, ShieldAlert,
  Trash2, Lock, Sparkles, Navigation, Route, Calendar, CheckCircle,
  XCircle, Send, ArrowRight, Building2, Edit3, ExternalLink, RotateCcw
} from 'lucide-react';
import { Signage, SignageStatus, SignageCondition, SignageUpdate, MonthlyTravelSummary, ExecutiveVisitStop, TravelRequest } from '@/lib/types';
import { DataService, getCurrentMonthKey, getSignageCode } from '@/lib/data-service';
import { useAuth } from '@/contexts/auth-context';
import { CameraInspectionModal } from '@/components/signage/CameraInspectionModal';
import { TravelRouteMap } from '@/components/map/TravelRouteMap';

export default function BDExecutivePortal() {
  const { user } = useAuth();
  const [signages, setSignages] = useState<Signage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | SignageStatus>('All');
  const [selectedSignageForCamera, setSelectedSignageForCamera] = useState<Signage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentMonthName, setCurrentMonthName] = useState('Current Month');

  // Active Tab: 'signages' or 'travel'
  const [activeTab, setActiveTab] = useState<'signages' | 'travel'>('signages');

  // Travel Summary State
  const [travelSummary, setTravelSummary] = useState<MonthlyTravelSummary | null>(null);
  const [travelLoading, setTravelLoading] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submittingTravel, setSubmittingTravel] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Route options & claim state (Hospital to Hoarding distance)
  const [isRoundTrip, setIsRoundTrip] = useState(true);
  const [claimedKmInput, setClaimedKmInput] = useState<string>('');
  const [travelPurposeNotes, setTravelPurposeNotes] = useState('');
  const [isResubmitting, setIsResubmitting] = useState(false);

  // Full-screen image lightbox state
  const [lightboxData, setLightboxData] = useState<{
    url: string;
    signage: Signage;
    update: SignageUpdate;
  } | null>(null);

  // Track failed image URLs so we show "Photo unavailable" placeholder instead of broken icon
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});

  // BD Delete Photo Modal state
  const [deleteModalSignage, setDeleteModalSignage] = useState<{ signage: Signage; update: SignageUpdate } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const currentMonthKey = getCurrentMonthKey();

  const handleConfirmDeletePhoto = async () => {
    if (!deleteModalSignage) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await DataService.deleteSignageUpdate(deleteModalSignage.update.id, {
        reason: 'Removed by BD executive from field portal (reverting to Pending)',
        deletedBy: user?.id,
      });
      setDeleteModalSignage(null);
      await loadSignages();
    } catch (err: any) {
      console.error('Delete photo error:', err);
      setDeleteError(err.message || 'Failed to delete photo. Please check permissions.');
    } finally {
      setDeleting(false);
    }
  };

  // Load signages
  const loadSignages = async () => {
    try {
      const data = await DataService.getSignages();
      const userUnitId = user?.unit_id;
      const sorted = [...data].sort((a, b) => {
        const aMine = a.assigned_to === user?.id || (userUnitId && a.unit_id === userUnitId);
        const bMine = b.assigned_to === user?.id || (userUnitId && b.unit_id === userUnitId);
        if (aMine && !bMine) return -1;
        if (!aMine && bMine) return 1;
        return 0;
      });
      setSignages(sorted);
    } catch (err) {
      console.error('Failed to load signages:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadTravelSummary = async (roundTripOverride?: boolean) => {
    if (!user?.id) return;
    setTravelLoading(true);
    try {
      const useRoundTrip = roundTripOverride !== undefined ? roundTripOverride : isRoundTrip;
      const summary = await DataService.getMonthlyTravelSummary(user.id, currentMonthKey, {
        isRoundTrip: useRoundTrip,
      });
      setTravelSummary(summary);

      if (summary.existing_request) {
        setIsRoundTrip(summary.existing_request.is_round_trip !== undefined ? Boolean(summary.existing_request.is_round_trip) : true);
        setClaimedKmInput(String(summary.existing_request.total_distance_km));
        if (summary.existing_request.travel_purpose) {
          setTravelPurposeNotes(summary.existing_request.travel_purpose);
        }
      } else {
        setClaimedKmInput(String(summary.total_distance_km));
      }
    } catch (e) {
      console.error('Failed to load travel summary:', e);
    } finally {
      setTravelLoading(false);
    }
  };

  const handleToggleRoundTrip = (newVal: boolean) => {
    setIsRoundTrip(newVal);
    loadTravelSummary(newVal);
  };

  useEffect(() => {
    setCurrentMonthName(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
    loadSignages();
    loadTravelSummary();
  }, [user]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSignages();
    loadTravelSummary();
  };

  const handleConfirmSubmitTravel = async () => {
    if (!user?.id || !travelSummary || travelSummary.stops.length === 0) return;
    if (!user.unit_id) {
      setSubmitError('You must be assigned to a hospital unit before submitting travel claims. Please contact Admin.');
      return;
    }
    const finalDistance = claimedKmInput && !isNaN(Number(claimedKmInput)) && Number(claimedKmInput) > 0
      ? Number(Number(claimedKmInput).toFixed(1))
      : travelSummary.total_distance_km;

    const startLoc = travelSummary.origin?.name || user.unit?.name || 'Hospital Base Office';

    setSubmittingTravel(true);
    setSubmitError(null);
    try {
      await DataService.submitTravelRequest({
        bd_executive_id: user.id,
        unit_id: user.unit_id,
        month: currentMonthKey,
        total_distance_km: finalDistance,
        start_location: startLoc,
        is_round_trip: isRoundTrip,
        travel_purpose: travelPurposeNotes.trim() || null,
        stops: travelSummary.stops.map(s => ({
          signage_id: s.signage_id,
          signage_update_id: s.signage_update_id || null,
          latitude: s.latitude,
          longitude: s.longitude,
          visited_at: s.visited_at,
          distance_from_previous_km: s.distance_from_previous_km,
        })),
      });

      setSubmitSuccess(`Your travel claim for ${currentMonthName} (${finalDistance} KM) has been submitted! Notification sent to Unit Head.`);
      setSubmitModalOpen(false);
      setIsResubmitting(false);
      await loadTravelSummary();
    } catch (err: any) {
      console.error('Submit travel request error:', err);
      setSubmitError(err.message || 'Failed to submit travel request');
    } finally {
      setSubmittingTravel(false);
    }
  };

  const handleOpenStopPhoto = (stop: ExecutiveVisitStop) => {
    if (!stop.photo_url) return;
    setLightboxData({
      url: stop.photo_url,
      signage: {
        id: stop.signage_id,
        address: stop.signage_address,
        area: { name: stop.signage_area_name || 'Area' } as any,
        unit: { name: stop.signage_unit_name || 'Hospital Unit' } as any,
        type: stop.signage_type as any,
        latitude: stop.latitude,
        longitude: stop.longitude,
        unit_id: '',
        area_id: '',
        is_active: true,
      },
      update: {
        id: stop.signage_update_id || '',
        signage_id: stop.signage_id,
        month: currentMonthKey,
        photo_path: '',
        photo_url: stop.photo_url,
        condition: stop.condition,
        latitude: stop.latitude,
        longitude: stop.longitude,
        location_mismatch: false,
        uploaded_by: user?.id || '',
        uploaded_at: stop.visited_at,
      },
    });
  };

  // Filtered signages
  const filteredSignages = signages.filter((s) => {
    const matchesStatus = statusFilter === 'All' || s.current_month_status === statusFilter;
    const matchesSearch =
      s.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.area?.name && s.area.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.unit?.name && s.unit.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate status counts
  const totalCount = signages.length;
  const updatedCount = signages.filter((s) => s.current_month_status === 'Updated').length;
  const pendingCount = signages.filter((s) => s.current_month_status === 'Pending').length;
  const overdueCount = signages.filter((s) => s.current_month_status === 'Overdue').length;
  const complianceRate = totalCount > 0 ? Math.round((updatedCount / totalCount) * 100) : 0;

  // Condition Badge Renderer
  const renderConditionBadge = (condition?: SignageCondition) => {
    switch (condition) {
      case 'Good':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Good</span>
          </span>
        );
      case 'Needs Repair':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Needs Repair</span>
          </span>
        );
      case 'Damaged':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
            <AlertOctagon className="w-3.5 h-3.5 text-orange-600" />
            <span>Damaged</span>
          </span>
        );
      case 'Missing':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <HelpCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Missing</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-4 pb-32 overflow-x-hidden">

      {/* Top Header Card (Phone-first, 390px optimized) */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden mb-5">
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-400/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>BD Field Camera Portal</span>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 cursor-pointer"
              title="Refresh signages list"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-4 flex flex-col justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {user?.full_name || 'BD Executive'}
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                {user?.unit?.name ? `${user.unit.name} • ` : ''}{currentMonthName} Field Inspections
              </p>
            </div>

            <Link
              href="/bd/add"
              className="min-h-[48px] inline-flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white text-xs font-bold shadow-lg shadow-blue-500/30 transition-all cursor-pointer w-full sm:w-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register New Signage</span>
            </Link>
          </div>

          {/* Monthly Progress Bar */}
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Monthly Inspection Compliance</span>
              <span className="font-bold text-white">{complianceRate}% Completed ({updatedCount}/{totalCount})</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${complianceRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Primary Section Switcher */}
      <div className="grid grid-cols-2 gap-2 mb-5 bg-slate-200/70 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('signages')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${activeTab === 'signages'
            ? 'bg-white text-slate-900 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <Camera className="w-3.5 h-3.5 text-blue-600" />
          <span>My Signages ({signages.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('travel')}
          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer relative ${activeTab === 'travel'
            ? 'bg-white text-slate-900 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <Navigation className="w-3.5 h-3.5 text-emerald-600" />
          <span>Travel &amp; Visits</span>
          {travelSummary && travelSummary.stops_count > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700">
              {travelSummary.total_distance_km}km
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Signages List */}
      {activeTab === 'signages' && (
        <>
          {/* Status Counters (Big Touch Targets) */}
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            <button
              onClick={() => setStatusFilter(statusFilter === 'Updated' ? 'All' : 'Updated')}
              className={`min-h-[72px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${statusFilter === 'Updated'
                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold text-slate-600">Updated</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-slate-900">{updatedCount}</div>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending')}
              className={`min-h-[72px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${statusFilter === 'Pending'
                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold text-slate-600">Pending</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-xl font-black text-slate-900">{pendingCount}</div>
            </button>

            <button
              onClick={() => setStatusFilter(statusFilter === 'Overdue' ? 'All' : 'Overdue')}
              className={`min-h-[72px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${statusFilter === 'Overdue'
                ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold text-slate-600">Overdue</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-xl font-black text-slate-900">{overdueCount}</div>
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs mb-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search address or area..."
                className="w-full pl-10 pr-4 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {(['All', 'Pending', 'Overdue', 'Updated'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${statusFilter === tab
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Signage Cards List */}
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-3 text-xs text-slate-500 font-medium">Loading assigned signages...</p>
            </div>
          ) : filteredSignages.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-800">No signages found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                {searchQuery || statusFilter !== 'All'
                  ? 'Try adjusting your search query or status filter.'
                  : 'Register your first outdoor marketing signage to begin monthly tracking.'}
              </p>
              <Link
                href="/bd/add"
                className="mt-4 inline-flex items-center justify-center min-h-[48px] space-x-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Register New Signage</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSignages.map((signage, idx) => {
                const isUpdated = signage.current_month_status === 'Updated';
                const isOverdue = signage.current_month_status === 'Overdue';
                const update = signage.latest_update;
                const photoSrc = update?.photo_url || update?.photo_path;
                const isImageFailed = photoSrc ? failedImageUrls[photoSrc] : false;
                const hoardingCode = getSignageCode(signage, idx + 1);

                // Retake & delete rules:
                // Only allow retaking & deleting THIS MONTH'S OWN update before next calendar month locks it
                const isThisMonthUpdate = Boolean(update && update.month === currentMonthKey);
                const isOwnUpdate = Boolean(update && (update.uploaded_by === user?.id || signage.assigned_to === user?.id));
                const canModifyThisMonth = isUpdated && isThisMonthUpdate && isOwnUpdate;
                const isPastMonthFinalized = Boolean(update && update.month !== currentMonthKey);

                return (
                  <div
                    key={signage.id}
                    className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all p-4 sm:p-5 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Status & Type Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-blue-600 text-white shadow-2xs">
                            {hoardingCode}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {signage.type}
                          </span>
                          {signage.size && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-100">
                              {signage.size}
                            </span>
                          )}
                        </div>

                        {/* Status Pill */}
                        {isUpdated ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Updated This Month</span>
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Overdue (Take Photo)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending Photo</span>
                          </span>
                        )}
                      </div>

                      {/* Area and Address */}
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {signage.address}
                      </h3>
                      <div className="mt-1 flex items-center space-x-1.5 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-700">{signage.area?.name || 'Area'}</span>
                        <span>&bull;</span>
                        <span>{signage.unit?.name || 'Unit'}</span>
                      </div>

                      {/* Photo Preview & Details Box if inspected */}
                      {isUpdated && update && (
                        <div className="mt-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[11px] font-semibold text-slate-500">Condition:</span>
                              {renderConditionBadge(update.condition)}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(update.uploaded_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>

                          {/* Photo Thumbnail with Tap to Enlarge & Broken Image Handling */}
                          {photoSrc && !isImageFailed ? (
                            <div
                              onClick={() => setLightboxData({ url: photoSrc, signage, update })}
                              className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 cursor-pointer group shadow-xs"
                            >
                              <img
                                src={photoSrc}
                                alt="Inspection capture"
                                onError={() => setFailedImageUrls(prev => ({ ...prev, [photoSrc]: true }))}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white text-xs font-bold space-x-1.5">
                                <Eye className="w-4 h-4 text-cyan-300" />
                                <span>Tap to Enlarge</span>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-video rounded-xl bg-slate-100 border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-3 text-center">
                              <ImageOff className="w-6 h-6 mb-1 text-slate-300" />
                              <span className="text-xs font-bold text-slate-600">Photo Unavailable</span>
                              <span className="text-[10px] text-slate-400">Tap Retake to capture a fresh photo</span>
                            </div>
                          )}

                          {/* Remarks and Location Mismatch */}
                          {update.remarks && (
                            <div className="text-xs text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-200/60">
                              &quot;{update.remarks}&quot;
                            </div>
                          )}

                          {update.location_mismatch && (
                            <div className="text-[11px] font-bold text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200 flex items-center space-x-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>Location mismatch: {Math.round(update.distance_from_site_m || 0)}m from site (&gt;200m)</span>
                            </div>
                          )}

                          {/* Admin Audit Feedback Alert */}
                          {update.admin_remarks && (
                            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/90 space-y-1 text-xs">
                              <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-[11px]">
                                <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>Admin Action: {update.admin_action_type || 'Feedback'}</span>
                              </div>
                              <p className="text-slate-800 italic text-[11px] leading-relaxed">
                                &quot;{update.admin_remarks}&quot;
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Primary Action Button (Big Touch Target min 48px) */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      {canModifyThisMonth ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedSignageForCamera(signage)}
                            className="flex-1 min-h-[48px] py-3 px-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-98 cursor-pointer shadow-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                          >
                            <Camera className="w-4 h-4 text-blue-600" />
                            <span>Retake Field Photo</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteModalSignage({ signage, update: update! });
                            }}
                            className="min-h-[48px] px-3.5 py-3 rounded-2xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-98 cursor-pointer text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200"
                            title="Delete this month's photo"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete Photo</span>
                          </button>
                        </div>
                      ) : (
                        <div>
                          {isPastMonthFinalized && (
                            <div className="mb-2 text-[11px] text-slate-500 font-medium flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Previous month inspection ({update?.month}) is finalized &amp; read-only.</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedSignageForCamera(signage)}
                            className={`w-full min-h-[48px] py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center space-x-2 transition-all active:scale-98 cursor-pointer shadow-sm ${isOverdue
                              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25 animate-pulse'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                              }`}
                          >
                            <Camera className="w-4 h-4" />
                            <span>Open Camera &amp; Capture Photo</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab 2: Travel & Visit Summary */}
      {activeTab === 'travel' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Submission Feedback Toast */}
          {submitSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start justify-between shadow-xs">
              <div className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="font-medium">{submitSuccess}</span>
              </div>
              <button onClick={() => setSubmitSuccess(null)} className="text-emerald-700 hover:text-emerald-900 p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mileage KPI Card */}
          <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold border border-blue-400/20">
                <Navigation className="w-3.5 h-3.5 text-blue-400" />
                <span>Haversine GPS Calculated</span>
              </div>
              <span className="text-xs font-semibold text-slate-300">
                {currentMonthName}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {travelSummary?.total_distance_km !== undefined ? travelSummary.total_distance_km.toFixed(1) : '0.0'}{' '}
                  <span className="text-base sm:text-lg font-bold text-blue-300">KM</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Total straight-line distance across <strong>{travelSummary?.stops_count || 0} stops</strong>
                </p>
              </div>

              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-cyan-400 border border-white/10 shrink-0">
                <Route className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Travel Request Status Card */}
          {travelSummary?.existing_request && (!isResubmitting || travelSummary.existing_request.status !== 'rejected') && (
            <div className={`p-4 sm:p-5 rounded-3xl border shadow-xs transition-all ${travelSummary.existing_request.status === 'approved'
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : travelSummary.existing_request.status === 'rejected'
                ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                : 'bg-amber-50/80 border-amber-300 text-amber-950'
              }`}>
              <div className="flex items-start space-x-3">
                {travelSummary.existing_request.status === 'approved' && (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                )}
                {travelSummary.existing_request.status === 'rejected' && (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                {travelSummary.existing_request.status === 'pending' && (
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${travelSummary.existing_request.status === 'approved'
                      ? 'bg-emerald-200 text-emerald-900'
                      : travelSummary.existing_request.status === 'rejected'
                        ? 'bg-rose-200 text-rose-900'
                        : 'bg-amber-200 text-amber-900'
                      }`}>
                      {travelSummary.existing_request.status === 'pending' ? 'Pending Unit Head Review' : travelSummary.existing_request.status}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {travelSummary.existing_request.month}
                    </span>
                  </div>

                  <p className="text-xs mt-2 leading-relaxed">
                    {travelSummary.existing_request.status === 'pending' && (
                      <>Your travel claim for <strong>{Number(travelSummary.existing_request.total_distance_km).toFixed(1)} KM</strong> was submitted on {new Date(travelSummary.existing_request.submitted_at).toLocaleDateString()}. Your Unit Head has been notified by email.</>
                    )}
                    {travelSummary.existing_request.status === 'approved' && (
                      <>Your travel claim for <strong>{Number(travelSummary.existing_request.total_distance_km).toFixed(1)} KM</strong> was approved on {new Date(travelSummary.existing_request.reviewed_at!).toLocaleDateString()} by your Unit Head.</>
                    )}
                    {travelSummary.existing_request.status === 'rejected' && (
                      <>Your travel claim for <strong>{Number(travelSummary.existing_request.total_distance_km).toFixed(1)} KM</strong> was rejected on {new Date(travelSummary.existing_request.reviewed_at!).toLocaleDateString()}.</>
                    )}
                  </p>

                  {/* Unit Head comment */}
                  {travelSummary.existing_request.review_comment && (
                    <div className="mt-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Unit Head Feedback:
                      </div>
                      <p className="text-xs text-slate-800 font-medium italic">
                        &ldquo;{travelSummary.existing_request.review_comment}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Re-submit action button when rejected */}
                  {travelSummary.existing_request.status === 'rejected' && (
                    <div className="mt-3.5 pt-3 border-t border-rose-200/60 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-rose-800">
                        Need to adjust mileage or route?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsResubmitting(true);
                          setSubmitError(null);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Update &amp; Resubmit Claim</span>
                      </button>
                    </div>
                  )}

                  <div className="mt-2.5 text-[10px] text-slate-500 font-medium">
                    &bull; One travel reimbursement request is permitted per calendar month.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Travel Request Configuration & Submission Card (Shown if new OR resubmitting after rejection) */}
          {(!travelSummary?.existing_request || (travelSummary.existing_request.status === 'rejected' && isResubmitting)) && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-1">
                    <Send className="w-3 h-3" />
                    <span>{travelSummary?.existing_request ? 'Update Rejected Claim' : 'Monthly Reimbursement Claim'}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {travelSummary?.existing_request ? 'Update & Resubmit Travel Claim' : 'Submit Travel Request'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {travelSummary?.stops_count || 0} stops visited • Origin: {travelSummary?.origin?.name || 'Hospital Base Office'}
                  </p>
                </div>
                <span className="font-mono text-base font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl shrink-0">
                  {claimedKmInput || (travelSummary?.total_distance_km !== undefined ? travelSummary.total_distance_km.toFixed(1) : '0.0')} KM
                </span>
              </div>

              {/* Simple Hospital Base & Round Trip Switch */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      {travelSummary?.origin?.name || 'Hospital Base Office'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {travelSummary?.origin?.address || 'Base Location'}
                    </div>
                  </div>
                </div>

                {/* Round Trip Toggle */}
                <label className="flex items-center space-x-2 text-xs text-slate-700 font-bold cursor-pointer shrink-0 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <input
                    type="checkbox"
                    checked={isRoundTrip}
                    onChange={(e) => handleToggleRoundTrip(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span>Round Trip (2× Distance)</span>
                </label>
              </div>

              {/* Distance Claim & Road Odometer Adjustment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Hospital to Hoardings Distance
                  </div>
                  <div className="text-base font-mono font-bold text-slate-800 mt-0.5">
                    {travelSummary?.total_distance_km !== undefined ? travelSummary.total_distance_km.toFixed(1) : '0.0'} KM
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {travelSummary?.stops_count || 0} hoarding visit{travelSummary?.stops_count === 1 ? '' : 's'} {isRoundTrip ? '(Round Trip)' : '(One Way)'}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/80">
                  <label className="block text-[10px] text-blue-800 font-bold uppercase tracking-wider mb-1">
                    Claimed Road Mileage (KM)
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={claimedKmInput}
                      onChange={(e) => setClaimedKmInput(e.target.value)}
                      placeholder={String(travelSummary?.total_distance_km || 0)}
                      className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white rounded-lg border border-blue-300 text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-blue-700">KM</span>
                  </div>
                  <div className="text-[10px] text-blue-600 mt-1">
                    Editable for vehicle odometer road mileage
                  </div>
                </div>
              </div>

              {/* Purpose / Remarks */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Travel Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={travelPurposeNotes}
                  onChange={(e) => setTravelPurposeNotes(e.target.value)}
                  placeholder="e.g. Monthly hoarding inspection & photo verification"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>

              {travelSummary?.stops_count === 0 ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs space-y-2">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">0 Inspection Stops Logged</p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        To submit a mileage claim, you need at least 1 inspection visit recorded with GPS coordinates. Tap below to register a signage or capture a photo.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/bd/add"
                    className="inline-flex items-center justify-center space-x-1.5 w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Register New Signage &amp; Log First Stop</span>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  {travelSummary?.google_maps_url && (
                    <a
                      href={travelSummary.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors border border-slate-200 cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5 text-blue-600" />
                      <span>Verify on Google Maps</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSubmitError(null);
                      setSubmitModalOpen(true);
                    }}
                    disabled={travelSummary?.stops_count === 0}
                    className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${travelSummary?.stops_count === 0
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-md shadow-blue-500/25'
                      }`}
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {travelSummary?.stops_count === 0
                        ? 'Need at least 1 stop to submit'
                        : `Submit Claim (${claimedKmInput || travelSummary?.total_distance_km} KM)`}
                    </span>
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                <span>&bull; One travel reimbursement request per calendar month</span>
                <span>Unit: {user?.unit?.name || 'Assigned Unit'}</span>
              </div>
            </div>
          )}

          {/* Interactive Travel Route Map Visual */}
          {travelSummary && travelSummary.stops.length > 0 && (
            <TravelRouteMap
              origin={travelSummary.origin || { lat: 26.9678, lng: 75.7725, address: user?.unit?.name || 'Hospital Base Office' }}
              stops={travelSummary.stops}
              isRoundTrip={isRoundTrip}
              totalDistanceKm={
                claimedKmInput && !isNaN(Number(claimedKmInput)) && Number(claimedKmInput) > 0
                  ? Number(claimedKmInput)
                  : travelSummary.total_distance_km
              }
              googleMapsUrl={travelSummary.google_maps_url}
              unitName={user?.unit?.name || 'Hospital Base Office'}
            />
          )}

          {/* Consecutive Visits List */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {currentMonthName} Inspection Visits ({travelSummary?.stops_count || 0})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Consecutive stops ordered chronologically with distance increments.
                </p>
              </div>
              <button
                onClick={handleRefresh}
                className="text-xs text-blue-600 font-semibold flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {travelLoading ? (
              <div className="py-8 text-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Calculating distances...</p>
              </div>
            ) : travelSummary?.stops.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No inspection visits recorded for {currentMonthName}.
              </div>
            ) : (
              <div className="space-y-2.5">
                {travelSummary?.stops.map((stop, idx) => (
                  <div
                    key={stop.signage_update_id || `${stop.signage_id}-${idx}`}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 hover:bg-slate-100/60 transition-colors"
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      {/* Photo Thumbnail */}
                      {stop.photo_url ? (
                        <button
                          type="button"
                          onClick={() => handleOpenStopPhoto(stop)}
                          className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-200 relative group cursor-pointer"
                          title="Click to view full photo"
                        >
                          <img
                            src={stop.photo_url}
                            alt="Inspection evidence"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </button>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                          <Camera className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-blue-600 text-white shadow-2xs">
                            {stop.signage_code}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(stop.visited_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(stop.visited_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate mt-1">
                          {stop.signage_address}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          {stop.signage_area_name ? `${stop.signage_area_name} • ` : ''}{stop.signage_type}
                        </p>
                        <div className="mt-1 flex items-center space-x-2">
                          <a
                            href={stop.google_maps_directions_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            <Compass className="w-3 h-3" />
                            <span>Hospital to {stop.signage_code} Directions</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Distance from Hospital Badge */}
                    <div className="text-right shrink-0">
                      <div className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-right">
                        <div className="text-xs font-mono font-black text-blue-700">
                          {isRoundTrip ? `${stop.round_trip_distance_km} KM` : `${stop.distance_from_hospital_km} KM`}
                        </div>
                        <div className="text-[9px] text-blue-600 font-semibold uppercase tracking-wider">
                          {isRoundTrip ? 'Round Trip' : 'One Way'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Months Requests History */}
          {travelSummary?.past_requests && travelSummary.past_requests.length > 0 && (
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Past Travel Requests History
              </h3>
              <div className="divide-y divide-slate-100">
                {travelSummary.past_requests.map((pastReq) => (
                  <div key={pastReq.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900">{pastReq.month}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${pastReq.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : pastReq.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                          }`}>
                          {pastReq.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {Number(pastReq.total_distance_km).toFixed(1)} KM • Submitted {new Date(pastReq.submitted_at).toLocaleDateString()}
                      </div>
                      {pastReq.review_comment && (
                        <p className="text-[11px] text-slate-600 italic mt-1">
                          &ldquo;{pastReq.review_comment}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Add Signage Button (Mobile) */}
      <div className="fixed right-4 bottom-20 z-30">
        <Link
          href="/bd/add"
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-2xl flex items-center justify-center border-2 border-white transition-transform cursor-pointer"
          title="Register New Signage"
        >
          <PlusCircle className="w-7 h-7" />
        </Link>
      </div>

      {/* Camera Inspection Modal */}
      {selectedSignageForCamera && (
        <CameraInspectionModal
          signage={selectedSignageForCamera}
          isOpen={Boolean(selectedSignageForCamera)}
          onClose={() => setSelectedSignageForCamera(null)}
          onSuccess={() => {
            setSelectedSignageForCamera(null);
            loadSignages();
          }}
        />
      )}

      {/* Full-Screen Lightbox Modal */}
      {lightboxData && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 animate-in fade-in">
          <div className="flex items-center justify-between text-white p-2 border-b border-slate-800">
            <div className="min-w-0 pr-2">
              <h3 className="text-sm font-bold truncate">{lightboxData.signage.address}</h3>
              <p className="text-xs text-slate-400">{lightboxData.signage.area?.name} &bull; {lightboxData.update.month}</p>
            </div>
            <button
              onClick={() => setLightboxData(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-slate-800 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2">
            <img
              src={lightboxData.url}
              alt="Full view inspection capture"
              className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />
          </div>

          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Condition: {lightboxData.update.condition}</span>
              <span className="font-mono text-slate-400">{new Date(lightboxData.update.uploaded_at).toLocaleDateString()}</span>
            </div>
            {lightboxData.update.remarks && (
              <p className="italic text-slate-400">&quot;{lightboxData.update.remarks}&quot;</p>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for BD Executive */}
      {deleteModalSignage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Remove This Month's Photo?</h3>
              <p className="text-xs text-slate-500 mt-1 font-semibold truncate max-w-[280px] mx-auto">
                {deleteModalSignage.signage.address}
              </p>
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                This will remove this month's photo and mark it <strong className="text-amber-700">Pending</strong> again. Continue?
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {deleteError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalSignage(null)}
                disabled={deleting}
                className="min-h-[48px] py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePhoto}
                disabled={deleting}
                className="min-h-[48px] py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Submit Travel Request Confirmation Modal */}
      {submitModalOpen && travelSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <Navigation className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Submit Travel Request?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Hospital Unit: <strong>{user?.unit?.name || 'Assigned Unit'}</strong>
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Period:</span>
                <span className="font-bold text-slate-800">{currentMonthName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hospital Base:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                  {travelSummary.origin?.name || user?.unit?.name || 'Hospital Base Office'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Round Trip:</span>
                <span className="font-semibold text-slate-800">
                  {isRoundTrip ? 'Yes (Returned to Office)' : 'One-way'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GPS Baseline:</span>
                <span className="font-mono text-slate-600">{travelSummary.total_distance_km} KM</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-1.5">
                <span className="text-slate-700 font-bold">Claimed Mileage:</span>
                <span className="font-mono font-black text-blue-600 text-sm">
                  {claimedKmInput || travelSummary.total_distance_km} KM
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Visited Stops:</span>
                <span className="font-bold text-slate-800">{travelSummary.stops_count} locations</span>
              </div>
              {travelPurposeNotes.trim() && (
                <div className="border-t border-slate-200/60 pt-1.5">
                  <span className="text-slate-500 block mb-0.5">Purpose:</span>
                  <span className="font-medium text-slate-700 italic block line-clamp-2">
                    &ldquo;{travelPurposeNotes.trim()}&rdquo;
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed text-center">
              Once submitted, an email notification will be sent to your Unit Head to review and approve your mileage claim. You cannot submit again for this month.
            </p>

            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                disabled={submittingTravel}
                className="min-h-[48px] py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmitTravel}
                disabled={submittingTravel}
                className="min-h-[48px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {submittingTravel ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirm &amp; Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
