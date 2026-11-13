'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Signage, SignageUpdate } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/contexts/auth-context';
import { 
  ArrowLeft, BookmarkCheck, Building2, MapPin, 
  Calendar, Camera, CheckCircle2, Clock, AlertTriangle, 
  MessageSquare, User, Maximize2, X, ShieldAlert,
  ArrowRightLeft, Layers, Compass, Trash2, History
} from 'lucide-react';

function SignageHistoryDetailContent() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const signageId = params?.id as string;

  const [signage, setSignage] = useState<Signage | null>(null);
  const [updates, setUpdates] = useState<SignageUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin Delete Update state
  const [updateToDelete, setUpdateToDelete] = useState<SignageUpdate | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Before / After comparison selection
  const [beforeIndex, setBeforeIndex] = useState<number>(1);
  const [afterIndex, setAfterIndex] = useState<number>(0);

  // Full-screen lightbox
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    month: string;
    condition: string;
    remarks?: string | null;
    date: string;
    uploader?: string;
  } | null>(null);

  useEffect(() => {
    async function loadSignageData() {
      if (!signageId) return;
      try {
        setLoading(true);
        const [signagesList, updatesList] = await Promise.all([
          DataService.getSignages(),
          DataService.getSignageUpdates(signageId),
        ]);

        const current = signagesList.find(s => s.id === signageId);
        if (!current) {
          setError('Signage asset not found in database.');
        } else {
          setSignage(current);
          setUpdates(updatesList);
          // Set before/after defaults if 2 or more updates exist
          if (updatesList.length >= 2) {
            setAfterIndex(0);
            setBeforeIndex(1);
          }
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load signage history.');
      } finally {
        setLoading(false);
      }
    }

    loadSignageData();
  }, [signageId]);

  const handleDeleteUpdate = async () => {
    if (!updateToDelete) return;
    const uploadTime = new Date(updateToDelete.uploaded_at).getTime();
    const diffHours = (Date.now() - uploadTime) / (1000 * 60 * 60);
    const isOlderThan48h = diffHours > 48;

    if (isOlderThan48h && deleteReason.trim().length < 5) {
      setDeleteError('A mandatory reason (at least 5 characters) is required to delete updates older than 48 hours.');
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      await DataService.deleteSignageUpdate(updateToDelete.id, {
        reason: deleteReason.trim() || `Deleted by admin (${Math.round(diffHours)}h after submission)`,
        deletedBy: user?.id,
      });

      // Reload data
      const [signagesList, updatesList] = await Promise.all([
        DataService.getSignages(),
        DataService.getSignageUpdates(signageId),
      ]);
      const current = signagesList.find(s => s.id === signageId);
      if (current) setSignage(current);
      setUpdates(updatesList);
      setUpdateToDelete(null);
      setDeleteReason('');
    } catch (err: any) {
      console.error('Failed to delete update:', err);
      setDeleteError(err.message || 'Failed to delete update.');
    } finally {
      setDeleting(false);
    }
  };

  const getConditionBadge = (condition?: string) => {
    switch (condition) {
      case 'Good':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Good</span>;
      case 'Needs Repair':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Needs Repair</span>;
      case 'Damaged':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">Damaged</span>;
      case 'Missing':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white border border-slate-700">Missing</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium text-slate-500 bg-slate-100">Unknown</span>;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Updated':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Updated This Month</span>
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Inspection Overdue</span>
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Inspection Pending</span>
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading Signage Timeline...</span>
        </div>
      </div>
    );
  }

  if (error || !signage) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Error Loading Signage</h2>
        <p className="text-sm text-slate-600 mb-6">{error || 'Asset not found'}</p>
        <Link
          href="/admin/signages"
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Signages Inventory</span>
        </Link>
      </div>
    );
  }

  const beforeUpdate = updates[beforeIndex];
  const afterUpdate = updates[afterIndex];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12">
      {/* Navigation Top Bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/admin/signages"
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-white transition-all border border-transparent hover:border-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Signages Inventory</span>
        </Link>

        <div>{getStatusBadge(signage.current_month_status)}</div>
      </div>

      {/* Signage Master Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {signage.type}
              </span>
              {signage.size && (
                <span className="px-2.5 py-1 rounded-xl text-xs font-medium text-slate-600 bg-slate-100">
                  Size: {signage.size}
                </span>
              )}
              <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold ${
                signage.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {signage.is_active ? 'Active Asset' : 'Inactive Asset'}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {signage.address}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <div className="flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-800">{signage.unit?.name || 'Unit Not Mapped'}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{signage.area?.name || 'Area Not Mapped'}</span>
              </div>
              <div className="flex items-center space-x-1.5 font-mono text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                <Compass className="w-3.5 h-3.5 text-slate-400" />
                <span>GPS: {signage.latitude.toFixed(5)}, {signage.longitude.toFixed(5)}</span>
              </div>
            </div>
          </div>

          {/* Assigned BD Executive Info */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 min-w-[220px] flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
              {signage.assigned_profile?.full_name?.charAt(0) || '?'}
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned BD Executive</div>
              <div className="font-bold text-sm text-slate-900 leading-tight">
                {signage.assigned_profile?.full_name || 'Unassigned'}
              </div>
              {signage.assigned_profile?.phone && (
                <div className="text-xs text-slate-500 mt-0.5">{signage.assigned_profile.phone}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Before / After Comparison */}
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              <span>Before &amp; After Photo Comparison</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect physical condition degradation, vinyl wear, repairs, and environmental factors across inspection cycles
            </p>
          </div>

          {updates.length >= 2 && (
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-medium hidden sm:inline">Compare:</span>
              <select
                value={beforeIndex}
                onChange={(e) => setBeforeIndex(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                {updates.map((u, i) => (
                  <option key={u.id} value={i} disabled={i === afterIndex}>
                    Older: {u.month}
                  </option>
                ))}
              </select>

              <span className="text-slate-400 font-bold">&rarr;</span>

              <select
                value={afterIndex}
                onChange={(e) => setAfterIndex(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                {updates.map((u, i) => (
                  <option key={u.id} value={i} disabled={i === beforeIndex}>
                    Newer: {u.month}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {updates.length < 2 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center">
            <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">Before &amp; After Comparison Unavailable</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {updates.length === 1 
                ? 'Only 1 monthly inspection recorded so far. As subsequent monthly inspections are uploaded by the BD executive, side-by-side comparison will unlock automatically.'
                : 'No inspection photos recorded yet for this signage asset.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Older (Before) Photo Card */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between">
              <div>
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                      Earlier Inspection
                    </span>
                    <span className="font-bold text-sm text-slate-800">{beforeUpdate?.month}</span>
                  </div>
                  <div>{getConditionBadge(beforeUpdate?.condition)}</div>
                </div>

                {/* Photo */}
                <div
                  onClick={() => beforeUpdate?.photo_url && setLightboxImage({
                    url: beforeUpdate.photo_url,
                    title: signage.address,
                    month: beforeUpdate.month,
                    condition: beforeUpdate.condition,
                    remarks: beforeUpdate.remarks,
                    date: beforeUpdate.uploaded_at,
                    uploader: beforeUpdate.uploader?.full_name,
                  })}
                  className="relative aspect-video bg-slate-950 cursor-pointer group overflow-hidden"
                >
                  <img
                    src={beforeUpdate?.photo_url || ''}
                    alt={`Inspection ${beforeUpdate?.month}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold space-x-1.5">
                    <Maximize2 className="w-4 h-4" />
                    <span>Tap to view full photo</span>
                  </div>
                </div>

                <div className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(beforeUpdate?.uploaded_at).toLocaleDateString()}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <User className="w-3.5 h-3.5" />
                      <span>{beforeUpdate?.uploader?.full_name || 'BD Inspector'}</span>
                    </span>
                  </div>

                  {beforeUpdate?.remarks && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 italic text-[11px]">
                      &quot;{beforeUpdate.remarks}&quot;
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Newer (After) Photo Card */}
            <div className="bg-white rounded-3xl border border-blue-200 overflow-hidden shadow-xs flex flex-col justify-between ring-2 ring-blue-500/10">
              <div>
                <div className="p-4 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-bold text-[11px] uppercase tracking-wider">
                      Recent Inspection
                    </span>
                    <span className="font-bold text-sm text-slate-800">{afterUpdate?.month}</span>
                  </div>
                  <div>{getConditionBadge(afterUpdate?.condition)}</div>
                </div>

                {/* Photo */}
                <div
                  onClick={() => afterUpdate?.photo_url && setLightboxImage({
                    url: afterUpdate.photo_url,
                    title: signage.address,
                    month: afterUpdate.month,
                    condition: afterUpdate.condition,
                    remarks: afterUpdate.remarks,
                    date: afterUpdate.uploaded_at,
                    uploader: afterUpdate.uploader?.full_name,
                  })}
                  className="relative aspect-video bg-slate-950 cursor-pointer group overflow-hidden"
                >
                  <img
                    src={afterUpdate?.photo_url || ''}
                    alt={`Inspection ${afterUpdate?.month}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold space-x-1.5">
                    <Maximize2 className="w-4 h-4" />
                    <span>Tap to view full photo</span>
                  </div>
                </div>

                <div className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(afterUpdate?.uploaded_at).toLocaleDateString()}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <User className="w-3.5 h-3.5" />
                      <span>{afterUpdate?.uploader?.full_name || 'BD Inspector'}</span>
                    </span>
                  </div>

                  {afterUpdate?.remarks && (
                    <div className="p-2.5 rounded-xl bg-blue-50/50 border border-blue-100 text-slate-700 italic text-[11px]">
                      &quot;{afterUpdate.remarks}&quot;
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION: Complete Monthly Inspection Timeline */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <Layers className="w-5 h-5 text-amber-600" />
            <span>Inspection Photo Timeline by Month ({updates.length})</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full audit log of camera verification records uploaded from the private storage bucket
          </p>
        </div>

        {updates.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center">
            <BookmarkCheck className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No Monthly Inspections Recorded</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              This signage has not had any inspection uploads submitted yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {updates.map((update, index) => {
              const uploadDate = new Date(update.uploaded_at);
              const hasPhoto = Boolean(update.photo_url || update.photo_path);
              const photoUrl = update.photo_url || update.photo_path;

              return (
                <div
                  key={update.id}
                  className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-col md:flex-row gap-5">
                    {/* Thumbnail */}
                    {hasPhoto ? (
                      <div
                        onClick={() => setLightboxImage({
                          url: photoUrl,
                          title: signage.address,
                          month: update.month,
                          condition: update.condition,
                          remarks: update.remarks,
                          date: update.uploaded_at,
                          uploader: update.uploader?.full_name,
                        })}
                        className="relative w-full md:w-64 aspect-video rounded-2xl bg-slate-950 overflow-hidden shrink-0 cursor-pointer group shadow-xs"
                      >
                        <img
                          src={photoUrl}
                          alt={`Inspection for ${update.month}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold space-x-1">
                          <Maximize2 className="w-4 h-4" />
                          <span>Enlarge</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full md:w-64 aspect-video rounded-2xl bg-slate-100 flex flex-col items-center justify-center text-slate-400 shrink-0">
                        <Camera className="w-6 h-6 mb-1 text-slate-300" />
                        <span className="text-[11px] font-medium">No photo</span>
                      </div>
                    )}

                    {/* Metadata Details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                              Month: {update.month}
                            </span>
                            {index === 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                Latest
                              </span>
                            )}
                          </div>
                          <div>{getConditionBadge(update.condition)}</div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>
                              Uploaded on: <strong>{uploadDate.toLocaleDateString()} at {uploadDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>
                              Inspector: <strong>{update.uploader?.full_name || 'BD Executive'}</strong>
                            </span>
                          </div>

                          {update.distance_from_site_m !== undefined && update.distance_from_site_m !== null && (
                            <div className="flex items-center space-x-2">
                              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                              <span>
                                Distance from site: <strong>{Math.round(update.distance_from_site_m)}m</strong>
                              </span>
                              {update.location_mismatch && (
                                <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>Mismatch (&gt;200m)</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {update.remarks && (
                          <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start space-x-2 text-xs text-slate-700">
                            <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <span className="italic leading-relaxed">&quot;{update.remarks}&quot;</span>
                          </div>
                        )}

                        {/* Admin Action: Delete this update */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400 font-mono">
                            Record ID: {update.id.slice(0, 8)}...
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeleteReason('');
                              setUpdateToDelete(update);
                            }}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                            title="Delete this inspection record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Update</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Delete Update Modal */}
      {updateToDelete && (() => {
        const uploadTime = new Date(updateToDelete.uploaded_at).getTime();
        const diffHours = (Date.now() - uploadTime) / (1000 * 60 * 60);
        const isOlderThan48h = diffHours > 48;
        const isValid = !isOlderThan48h || deleteReason.trim().length >= 5;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2 text-rose-600 font-bold text-base">
                  <Trash2 className="w-5 h-5" />
                  <span>Delete Monthly Inspection</span>
                </div>
                <button
                  onClick={() => setUpdateToDelete(null)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Inspection Month: <strong className="text-slate-800">{updateToDelete.month}</strong>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submitted: <strong className="text-slate-800">{new Date(updateToDelete.uploaded_at).toLocaleString()}</strong> by {updateToDelete.uploader?.full_name || 'BD Executive'}
                </p>
              </div>

              {isOlderThan48h ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                  <span className="font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Inspection is older than 48 hours ({Math.round(diffHours / 24)} days ago)</span>
                  </span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Per audit rules, deleting records older than 48 hours requires a mandatory reason. This deletion and its reason will be permanently logged in the audit trail.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900">
                  <span className="font-semibold block">Submitted within 48 hours ({Math.round(diffHours)} hours ago)</span>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    This update is within the 48-hour window. Deleting will remove the photo from storage and revert this month&apos;s status.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {isOlderThan48h ? 'Mandatory Reason for Deletion *' : 'Reason for Deletion (Optional)'}
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                  placeholder={
                    isOlderThan48h
                      ? 'e.g. BD executive uploaded wrong photo / signboard relocated / re-inspection required'
                      : 'Optional reason for the deletion audit log'
                  }
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 placeholder-slate-400"
                />
                {isOlderThan48h && deleteReason.trim().length < 5 && (
                  <span className="text-[10px] text-amber-600 font-medium block mt-1">
                    Please provide at least 5 characters for the audit reason.
                  </span>
                )}
              </div>

              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUpdateToDelete(null)}
                  disabled={deleting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUpdate}
                  disabled={!isValid || deleting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Confirm &amp; Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full Resolution Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-white/20">
            {/* Lightbox Header */}
            <div className="flex items-center justify-between p-4 px-5 border-b border-slate-100 bg-white">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Inspection: {lightboxImage.month}
                </h3>
                <p className="text-xs text-slate-500">{lightboxImage.title}</p>
              </div>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo */}
            <div className="bg-slate-950 flex items-center justify-center max-h-[65vh] overflow-hidden">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            </div>

            {/* Lightbox Footer */}
            <div className="p-4 px-5 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
              <div className="flex items-center space-x-3">
                <span>Condition: {getConditionBadge(lightboxImage.condition)}</span>
                {lightboxImage.uploader && <span>Inspector: <strong>{lightboxImage.uploader}</strong></span>}
              </div>
              <button
                onClick={() => setLightboxImage(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SignageHistoryDetailPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent" />
        <p className="text-sm text-slate-500 mt-2">Loading signage history...</p>
      </div>
    }>
      <SignageHistoryDetailContent />
    </Suspense>
  );
}

