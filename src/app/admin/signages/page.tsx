'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Signage, Unit, Area, Profile, SignageUpdate } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { 
  BookmarkCheck, Building2, MapPin, UserCheck, 
  Search, Edit3, X, CheckCircle2, Clock, AlertTriangle, 
  Camera, Eye, Calendar, MessageSquare, History, Maximize2, ShieldAlert,
  Sparkles
} from 'lucide-react';

interface PhotoModalState {
  url: string;
  signage: Signage;
  update: SignageUpdate;
}

export default function AdminSignagesPage() {
  const [signages, setSignages] = useState<Signage[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [executives, setExecutives] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [execFilter, setExecFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Photo Lightbox Modal
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<PhotoModalState | null>(null);

  // Reassignment Modal
  const [reassigningSignage, setReassigningSignage] = useState<Signage | null>(null);
  const [selectedExecId, setSelectedExecId] = useState<string>('');
  const [savingReassign, setSavingReassign] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [signagesData, unitsData, areasData, profilesData] = await Promise.all([
        DataService.getSignages(),
        DataService.getUnits(),
        DataService.getAreas(),
        DataService.getProfiles(),
      ]);
      setSignages(signagesData);
      setUnits(unitsData);
      setAreas(areasData);
      setExecutives(profilesData.filter(p => p.role === 'bd_executive' || p.role === 'admin'));
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load signages' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openReassignModal = (signage: Signage) => {
    setReassigningSignage(signage);
    setSelectedExecId(signage.assigned_to || '');
    setFeedback(null);
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningSignage) return;

    setSavingReassign(true);
    try {
      await DataService.reassignSignage(reassigningSignage.id, selectedExecId || null);
      const execName = executives.find(e => e.id === selectedExecId)?.full_name || 'Unassigned';
      setFeedback({ type: 'success', message: `Signage reassigned to ${execName}.` });
      setReassigningSignage(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reassign signage' });
    } finally {
      setSavingReassign(false);
    }
  };

  const handleToggleActive = async (signage: Signage) => {
    try {
      await DataService.toggleSignageActive(signage.id, !signage.is_active);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle status' });
    }
  };

  const filteredAreas = unitFilter === 'all' 
    ? areas 
    : areas.filter(a => a.unit_id === unitFilter);

  const filteredSignages = signages.filter((s) => {
    const matchesSearch = s.address.toLowerCase().includes(search.toLowerCase()) || 
                          (s.size || '').toLowerCase().includes(search.toLowerCase()) ||
                          s.type.toLowerCase().includes(search.toLowerCase());
    const matchesUnit = unitFilter === 'all' || s.unit_id === unitFilter;
    const matchesArea = areaFilter === 'all' || s.area_id === areaFilter;
    const matchesExec = execFilter === 'all' || s.assigned_to === execFilter;
    const matchesStatus = statusFilter === 'all' || s.current_month_status === statusFilter;
    return matchesSearch && matchesUnit && matchesArea && matchesExec && matchesStatus;
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Updated':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Updated</span>
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue</span>
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Pending</span>
          </span>
        );
    }
  };

  const getConditionBadge = (condition?: string) => {
    switch (condition) {
      case 'Good':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Good</span>;
      case 'Needs Repair':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Needs Repair</span>;
      case 'Damaged':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Damaged</span>;
      case 'Missing':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-white border border-slate-700">Missing</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 bg-slate-100">No Inspection</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <BookmarkCheck className="w-6 h-6 text-amber-600" />
            <span>Signage Inventory & Assignments</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor hospital outdoor media assets, inspection photos, and BD executive assignments
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
            Total Signages: {signages.length}
          </span>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 p-3.5 rounded-2xl flex items-center justify-between text-xs font-medium border ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs mb-6 space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by address, landmark, type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <select
            value={unitFilter}
            onChange={(e) => {
              setUnitFilter(e.target.value);
              setAreaFilter('all');
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-medium cursor-pointer"
          >
            <option value="all">All Units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-medium cursor-pointer"
          >
            <option value="all">All Areas</option>
            {filteredAreas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select
            value={execFilter}
            onChange={(e) => setExecFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-medium cursor-pointer"
          >
            <option value="all">All BD Executives</option>
            {executives.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.full_name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-medium cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Updated">Updated this month</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Signage Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-96 rounded-3xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : filteredSignages.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <BookmarkCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No signage matches filters</h3>
          <p className="text-xs text-slate-500 mt-1">Try broadening your search or selection criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSignages.map((signage) => {
            const hasPhoto = Boolean(signage.latest_update?.photo_url || signage.latest_update?.photo_path);
            const photoSrc = signage.latest_update?.photo_url || signage.latest_update?.photo_path || '';

            return (
              <div
                key={signage.id}
                className={`bg-white rounded-3xl border transition-all p-5 shadow-xs flex flex-col justify-between ${
                  signage.is_active ? 'border-slate-200 hover:shadow-md' : 'border-slate-200 opacity-60 bg-slate-50/80'
                }`}
              >
                <div>
                  {/* Top Bar: Badges & Active Toggle */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* This Month's Status Badge */}
                      {getStatusBadge(signage.current_month_status)}

                      {/* Type Badge */}
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {signage.type}
                      </span>

                      {/* Size Badge */}
                      {signage.size && (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          {signage.size}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggleActive(signage)}
                      className="text-xs font-semibold flex items-center space-x-1 cursor-pointer shrink-0"
                      title={signage.is_active ? 'Deactivate signage' : 'Activate signage'}
                    >
                      {signage.is_active ? (
                        <span className="text-emerald-600 flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11px] font-medium">Active</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span className="text-[11px]">Inactive</span>
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Photo Thumbnail */}
                  {hasPhoto ? (
                    <div 
                      onClick={() => setSelectedPhotoModal({
                        url: photoSrc,
                        signage,
                        update: signage.latest_update!,
                      })}
                      className="mt-3.5 relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-200/80 cursor-pointer group shadow-xs"
                      title="Tap to view larger photo"
                    >
                      <img 
                        src={photoSrc} 
                        alt={signage.address} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-75 group-hover:opacity-90 transition-opacity" />
                      
                      {/* Enlarge Hint Pill */}
                      <div className="absolute top-2.5 right-2.5">
                        <span className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-bold flex items-center space-x-1 group-hover:bg-blue-600 transition-colors">
                          <Maximize2 className="w-3 h-3" />
                          <span>Enlarge</span>
                        </span>
                      </div>

                      {/* Photo Bottom Info */}
                      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white text-[11px]">
                        <span className="font-medium flex items-center space-x-1 drop-shadow">
                          <Camera className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Inspection Photo</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-200 bg-black/40 px-1.5 py-0.5 rounded">
                          {new Date(signage.latest_update!.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3.5 aspect-video rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 p-4">
                      <Camera className="w-7 h-7 text-slate-300 mb-1" />
                      <span className="text-xs font-bold text-slate-600">No Photo Uploaded Yet</span>
                      <span className="text-[11px] text-slate-400">Waiting for BD executive inspection</span>
                    </div>
                  )}

                  {/* Address Title */}
                  <h3 className="mt-3.5 font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
                    {signage.address}
                  </h3>

                  {/* Unit and Area */}
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800">{signage.unit?.name || 'Unit Not Mapped'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{signage.area?.name || 'Area Not Mapped'}</span>
                    </div>
                  </div>

                  {/* Inspection Status Box: Condition & Last Updated Date */}
                  <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Condition</span>
                      <div>{getConditionBadge(signage.latest_update?.condition)}</div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                      <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Last Updated</span>
                      </span>
                      <span className="font-medium text-slate-800 text-[11px]">
                        {signage.latest_update?.uploaded_at 
                          ? new Date(signage.latest_update.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'No date'}
                      </span>
                    </div>

                    {/* Remarks if any */}
                    {signage.latest_update?.remarks && (
                      <div className="pt-1.5 border-t border-slate-200/60 flex items-start space-x-1.5 text-xs text-slate-600">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 italic text-[11px]">
                          &quot;{signage.latest_update.remarks}&quot;
                        </span>
                      </div>
                    )}

                    {/* Admin Audit Remark if any */}
                    {signage.latest_update?.admin_remarks && (
                      <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start space-x-1.5 text-xs text-amber-900">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                            Admin Action: {signage.latest_update.admin_action_type || 'Remark'}
                          </div>
                          <span className="line-clamp-2 italic text-[11px] text-slate-800">
                            &quot;{signage.latest_update.admin_remarks}&quot;
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Assigned BD & Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {signage.assigned_profile?.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Assigned BD</span>
                      <span className="text-xs font-semibold text-slate-800 truncate max-w-[130px]">
                        {signage.assigned_profile?.full_name || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {/* View History Button */}
                    <Link
                      href={`/admin/signages/${signage.id}`}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
                      title="View monthly photo timeline"
                    >
                      <History className="w-3.5 h-3.5 text-slate-600" />
                      <span>View history</span>
                    </Link>

                    {/* Reassign Button */}
                    <button
                      onClick={() => openReassignModal(signage)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors cursor-pointer flex items-center space-x-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Reassign</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Large Photo Lightbox Modal */}
      {selectedPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-white/20">
            {/* Header */}
            <div className="flex items-center justify-between p-4 px-5 border-b border-slate-100 bg-white">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                  {selectedPhotoModal.signage.address}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedPhotoModal.signage.unit?.name} &bull; {selectedPhotoModal.signage.area?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo View */}
            <div className="bg-slate-950 flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img
                src={selectedPhotoModal.url}
                alt={selectedPhotoModal.signage.address}
                className="max-h-[60vh] w-auto max-w-full object-contain"
              />
            </div>

            {/* Photo Inspection Meta */}
            <div className="p-4 px-5 bg-slate-50 space-y-2.5 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-500">Condition:</span>
                  {getConditionBadge(selectedPhotoModal.update.condition)}
                </div>
                <div className="flex items-center space-x-1 text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Uploaded on {new Date(selectedPhotoModal.update.uploaded_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedPhotoModal.update.distance_from_site_m !== undefined && selectedPhotoModal.update.distance_from_site_m !== null && (
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>GPS Distance from site: <strong>{Math.round(selectedPhotoModal.update.distance_from_site_m)} meters</strong></span>
                  {selectedPhotoModal.update.location_mismatch && (
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                      <ShieldAlert className="w-3 h-3" />
                      <span>&gt;200m Distance Alert</span>
                    </span>
                  )}
                </div>
              )}

              {selectedPhotoModal.update.remarks && (
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                  <span className="font-semibold text-slate-700">Remarks: </span>
                  <span className="italic text-slate-600">&quot;{selectedPhotoModal.update.remarks}&quot;</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <Link
                  href={`/admin/signages/${selectedPhotoModal.signage.id}`}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Open Full Timeline &amp; Before/After Comparison &rarr;</span>
                </Link>
                <button
                  onClick={() => setSelectedPhotoModal(null)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassigningSignage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <span>Reassign Signage Executive</span>
              </h2>
              <button
                onClick={() => setReassigningSignage(null)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                <div className="font-bold text-slate-800">{reassigningSignage.address}</div>
                <div className="text-slate-500">{reassigningSignage.unit?.name} &bull; {reassigningSignage.area?.name}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select BD Executive
                </label>
                <select
                  value={selectedExecId}
                  onChange={(e) => setSelectedExecId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900 font-medium"
                >
                  <option value="">Unassigned</option>
                  {executives.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.full_name} ({ex.unit?.name || 'All Units'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReassigningSignage(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReassign}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingReassign ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
