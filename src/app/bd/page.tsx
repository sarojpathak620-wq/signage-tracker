'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PlusCircle, Camera, CheckCircle2, Clock, AlertTriangle,
  MapPin, Search, ShieldCheck, ChevronRight, RefreshCw, 
  AlertOctagon, HelpCircle, Eye, X, ImageOff, Compass, ShieldAlert,
  Trash2, Lock
} from 'lucide-react';
import { Signage, SignageStatus, SignageCondition, SignageUpdate } from '@/lib/types';
import { DataService, getCurrentMonthKey } from '@/lib/data-service';
import { useAuth } from '@/contexts/auth-context';
import { CameraInspectionModal } from '@/components/signage/CameraInspectionModal';

export default function BDExecutivePortal() {
  const { user } = useAuth();
  const [signages, setSignages] = useState<Signage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | SignageStatus>('All');
  const [selectedSignageForCamera, setSelectedSignageForCamera] = useState<Signage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentMonthName, setCurrentMonthName] = useState('Current Month');

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

  useEffect(() => {
    setCurrentMonthName(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
    loadSignages();
  }, [user]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSignages();
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

      {/* Status Counters (Big Touch Targets) */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <button
          onClick={() => setStatusFilter(statusFilter === 'Updated' ? 'All' : 'Updated')}
          className={`min-h-[72px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            statusFilter === 'Updated'
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
          className={`min-h-[72px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            statusFilter === 'Pending'
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
          className={`min-h-[72px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            statusFilter === 'Overdue'
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
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab
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
          {filteredSignages.map((signage) => {
            const isUpdated = signage.current_month_status === 'Updated';
            const isOverdue = signage.current_month_status === 'Overdue';
            const update = signage.latest_update;
            const photoSrc = update?.photo_url || update?.photo_path;
            const isImageFailed = photoSrc ? failedImageUrls[photoSrc] : false;

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
                        className={`w-full min-h-[48px] py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center space-x-2 transition-all active:scale-98 cursor-pointer shadow-sm ${
                          isOverdue
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
    </div>
  );
}
