'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { 
  ArrowLeft, Download, Search, Filter, RefreshCw, 
  Building2, MapPin, CheckCircle2, AlertTriangle, AlertOctagon, 
  HelpCircle, Eye, X, ImageOff, Lock, FileSpreadsheet,
  Calendar, User, Compass, ExternalLink, ShieldCheck, Layers
} from 'lucide-react';
import { InspectionAuditLogItem, Unit, Area, SignageCondition } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/contexts/auth-context';

export default function AuditLogPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();

  const [items, setItems] = useState<InspectionAuditLogItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Unit Head scoping
  const isUnitHead = role === 'supervisor';
  const assignedUnitId = isUnitHead ? (user?.unit_id || null) : null;

  // Filter states
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [monthFrom, setMonthFrom] = useState<string>('');
  const [monthTo, setMonthTo] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Lightbox Modal
  const [activePhoto, setActivePhoto] = useState<{
    url: string;
    signageCode: string;
    month: string;
    address: string;
    condition: string;
    inspectedBy: string;
    distance: string;
  } | null>(null);

  // Authentication & Access Protection
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (role === 'bd_executive') {
        router.push('/bd');
      }
    }
  }, [user, role, authLoading, router]);

  // Set initial unit if Unit Head
  useEffect(() => {
    if (assignedUnitId) {
      setSelectedUnit(assignedUnitId);
    }
  }, [assignedUnitId]);

  // Load Units & Areas
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [unitsData, areasData] = await Promise.all([
          DataService.getUnits(),
          DataService.getAreas(),
        ]);
        if (assignedUnitId) {
          setUnits(unitsData.filter(u => u.id === assignedUnitId));
          setAreas(areasData.filter(a => a.unit_id === assignedUnitId));
        } else {
          setUnits(unitsData);
          setAreas(areasData);
        }
      } catch (err) {
        console.error('Failed to load master metadata for audit log:', err);
      }
    }
    loadMasterData();
  }, [assignedUnitId]);

  // Load Inspection Audit Logs
  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const activeUnitId = assignedUnitId || (selectedUnit !== 'all' ? selectedUnit : undefined);
      const activeAreaId = selectedArea !== 'all' ? selectedArea : undefined;

      const data = await DataService.getInspectionAuditLogs({
        unit_id: activeUnitId,
        area_id: activeAreaId,
        month_from: monthFrom || undefined,
        month_to: monthTo || undefined,
        condition: selectedCondition !== 'all' ? selectedCondition : undefined,
        search: searchQuery.trim() || undefined,
      });

      setItems(data);
      setCurrentPage(1); // Reset to first page upon filter change
    } catch (err) {
      console.error('Failed to fetch inspection audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (role === 'admin' || role === 'supervisor')) {
      fetchAuditLogs();
    }
  }, [user, role, selectedUnit, selectedArea, monthFrom, monthTo, selectedCondition, searchQuery]);

  // Filtered areas dropdown according to selected unit
  const visibleAreas = useMemo(() => {
    if (selectedUnit === 'all') return areas;
    return areas.filter(a => a.unit_id === selectedUnit);
  }, [areas, selectedUnit]);

  // Reset area when unit changes to an incompatible unit
  const handleUnitChange = (unitId: string) => {
    setSelectedUnit(unitId);
    setSelectedArea('all');
  };

  // Pagination calculation
  const totalRows = items.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  // Quick stats
  const conditionStats = useMemo(() => {
    const stats = {
      good: 0,
      repair: 0,
      damaged: 0,
      missing: 0,
      mismatch: 0,
      uniqueSignages: new Set<string>(),
    };
    items.forEach(it => {
      stats.uniqueSignages.add(it.signage_id);
      if (it.condition === 'Good') stats.good++;
      else if (it.condition === 'Needs Repair') stats.repair++;
      else if (it.condition === 'Damaged') stats.damaged++;
      else if (it.condition === 'Missing') stats.missing++;
      if (it.location_mismatch) stats.mismatch++;
    });
    return stats;
  }, [items]);

  // EXPORT TO EXCEL (.xlsx)
  const handleExportToExcel = () => {
    setExporting(true);
    try {
      // Map rows with exact column names in the requested order:
      // 1. Signage Code
      // 2. Unit
      // 3. Area
      // 4. Address
      // 5. Month
      // 6. Latitude
      // 7. Longitude
      // 8. Condition
      // 9. Distance from Registered Location
      // 10. Inspected By
      // 11. Photo URL
      const exportRows = items.map(item => {
        const distanceStr = item.distance_from_site_m != null
          ? `${Math.round(item.distance_from_site_m)} m${item.location_mismatch ? ' (Mismatch > 500m)' : ' (Within range)'}`
          : '0 m';

        return {
          'Signage Code': item.signage_code,
          'Unit': item.unit_name,
          'Area': item.area_name,
          'Address': item.address,
          'Month': item.month_formatted,
          'Latitude': item.latitude,
          'Longitude': item.longitude,
          'Condition': item.condition,
          'Distance from Registered Location': distanceStr,
          'Inspected By': item.inspected_by_name,
          'Photo URL': item.photo_url || item.photo_path || 'No photo uploaded',
          'Inspected At': item.uploaded_at ? new Date(item.uploaded_at).toLocaleString('en-IN') : '',
          'Remarks': item.remarks || '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);

      // Set reasonable column widths
      worksheet['!cols'] = [
        { wch: 15 }, // Signage Code
        { wch: 25 }, // Unit
        { wch: 20 }, // Area
        { wch: 35 }, // Address
        { wch: 14 }, // Month
        { wch: 14 }, // Latitude
        { wch: 14 }, // Longitude
        { wch: 16 }, // Condition
        { wch: 32 }, // Distance from Registered Location
        { wch: 22 }, // Inspected By
        { wch: 45 }, // Photo URL
        { wch: 22 }, // Inspected At
        { wch: 30 }, // Remarks
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inspection Audit Log');

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Hospital_Signage_Audit_Log_${isUnitHead ? 'Unit' : 'AllUnits'}_${dateStr}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Error generating Excel file:', err);
      alert('Failed to export Excel file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getConditionBadge = (cond: string) => {
    switch (cond) {
      case 'Good':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Good</span>
          </span>
        );
      case 'Needs Repair':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Needs Repair</span>
          </span>
        );
      case 'Damaged':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertOctagon className="w-3 h-3 text-rose-600" />
            <span>Damaged</span>
          </span>
        );
      case 'Missing':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <HelpCircle className="w-3 h-3 text-slate-500" />
            <span>Missing</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            <span>{cond}</span>
          </span>
        );
    }
  };

  if (authLoading || (!user && role !== 'admin' && role !== 'supervisor')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading Audit Log...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-36">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">

        {/* Top Breadcrumb & Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={isUnitHead ? '/supervisor' : '/'}
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {isUnitHead ? 'Unit Head Portal' : 'Admin Hub'}</span>
          </Link>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
              Read-Only Audit Trail
            </span>
            <button
              onClick={fetchAuditLogs}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Hero Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 text-blue-300 text-xs font-semibold mb-2 border border-white/10">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                <span>Signage Inspection Audit Logs</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Monthly Inspection Audit Trail
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-2xl">
                {isUnitHead 
                  ? 'Long-format inspection history scoped strictly to your assigned hospital unit. Chronologically sorted with GPS coordinates and condition checks.'
                  : 'Complete multi-unit long-format inspection log. Every row represents one monthly inspection with verified GPS and photographic proof.'}
              </p>
            </div>

            {/* Export to Excel Button */}
            <div className="flex items-center">
              <button
                onClick={handleExportToExcel}
                disabled={exporting || items.length === 0}
                className="inline-flex items-center space-x-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 active:scale-98"
              >
                <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
                <span>{exporting ? 'Preparing Excel...' : 'Export to Excel (.xlsx)'}</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Tiles */}
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            <div>
              <div className="text-[11px] text-slate-300 font-medium">Total Inspections</div>
              <div className="text-2xl font-black text-white mt-0.5">{totalRows}</div>
            </div>
            <div>
              <div className="text-[11px] text-blue-300 font-medium">Unique Signages</div>
              <div className="text-2xl font-black text-blue-400 mt-0.5">{conditionStats.uniqueSignages.size}</div>
            </div>
            <div>
              <div className="text-[11px] text-emerald-300 font-medium">Good Condition</div>
              <div className="text-2xl font-black text-emerald-400 mt-0.5">{conditionStats.good}</div>
            </div>
            <div>
              <div className="text-[11px] text-amber-300 font-medium">Needs Repair</div>
              <div className="text-2xl font-black text-amber-400 mt-0.5">{conditionStats.repair}</div>
            </div>
            <div>
              <div className="text-[11px] text-rose-300 font-medium">Damaged / Missing</div>
              <div className="text-2xl font-black text-rose-400 mt-0.5">{conditionStats.damaged + conditionStats.missing}</div>
            </div>
            <div>
              <div className="text-[11px] text-orange-300 font-medium">GPS Mismatch (&gt;500m)</div>
              <div className="text-2xl font-black text-orange-400 mt-0.5">{conditionStats.mismatch}</div>
            </div>
          </div>
        </div>

        {/* Filter Controls Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Filter Inspection Records</h2>
            </div>
            {(selectedUnit !== (assignedUnitId || 'all') || selectedArea !== 'all' || monthFrom || monthTo || selectedCondition !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  if (!assignedUnitId) setSelectedUnit('all');
                  setSelectedArea('all');
                  setMonthFrom('');
                  setMonthTo('');
                  setSelectedCondition('all');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Unit Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Hospital Unit</span>
                {isUnitHead && <span className="text-[10px] text-amber-600 font-medium flex items-center space-x-0.5"><Lock className="w-3 h-3" /><span>Locked to your unit</span></span>}
              </label>
              <div className="relative">
                <select
                  value={selectedUnit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  disabled={isUnitHead}
                  className={`w-full min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                    isUnitHead 
                      ? 'bg-slate-100/90 border-slate-300 text-slate-700 cursor-not-allowed font-semibold' 
                      : 'bg-white border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                >
                  {!isUnitHead && <option value="all">All Hospital Units</option>}
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.city ? `(${u.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Area Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Area
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="all">All Operational Areas</option>
                {visibleAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Range: From / To */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Month Range (From / To)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="month"
                  value={monthFrom}
                  onChange={(e) => setMonthFrom(e.target.value)}
                  placeholder="From"
                  className="w-full min-h-[42px] px-2 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="month"
                  value={monthTo}
                  onChange={(e) => setMonthTo(e.target.value)}
                  placeholder="To"
                  className="w-full min-h-[42px] px-2 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Condition Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Signage Condition
              </label>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="all">All Conditions</option>
                <option value="Good">Good</option>
                <option value="Needs Repair">Needs Repair</option>
                <option value="Damaged">Damaged</option>
                <option value="Missing">Missing</option>
              </select>
            </div>

            {/* Signage Code / Search Box */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Search Code / Details
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Code (e.g. SEHJ01), address..."
                  className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Audit Log Table Container */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-800">
                Inspection Logs ({totalRows} records found)
              </span>
              <span className="text-[11px] text-slate-500">
                • Chronological by Signage Code &amp; Month (Oldest &rarr; Newest)
              </span>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="text-slate-500 font-medium">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Responsive Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-100">
              <thead className="bg-slate-100/80 text-[11px] uppercase tracking-wider font-bold text-slate-600 select-none">
                <tr>
                  {/* Exact 11 Columns in order */}
                  <th scope="col" className="py-3 px-3.5 whitespace-nowrap">#1 Signage Code</th>
                  <th scope="col" className="py-3 px-3.5 whitespace-nowrap">#2 Unit</th>
                  <th scope="col" className="py-3 px-3.5 whitespace-nowrap">#3 Area</th>
                  <th scope="col" className="py-3 px-4 min-w-[200px]">#4 Address</th>
                  <th scope="col" className="py-3 px-3.5 whitespace-nowrap">#5 Month</th>
                  <th scope="col" className="py-3 px-3 whitespace-nowrap">#6 Latitude</th>
                  <th scope="col" className="py-3 px-3 whitespace-nowrap">#7 Longitude</th>
                  <th scope="col" className="py-3 px-3.5 whitespace-nowrap">#8 Condition</th>
                  <th scope="col" className="py-3 px-3.5 min-w-[190px]">#9 Distance from Reg. Location</th>
                  <th scope="col" className="py-3 px-3.5 whitespace-nowrap">#10 Inspected By</th>
                  <th scope="col" className="py-3 px-3.5 whitespace-nowrap text-center">#11 Photo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-normal">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Loading inspection audit records...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                          <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-bold text-slate-800">No Inspection Records Found</span>
                        <p className="text-xs text-slate-500 max-w-sm">
                          Try adjusting the unit, area, month range, or search criteria above.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item, index) => {
                    const distanceMeters = Math.round(item.distance_from_site_m);
                    const isMismatch = item.location_mismatch;

                    return (
                      <tr 
                        key={item.id}
                        className="hover:bg-blue-50/40 transition-colors"
                      >
                        {/* 1. Signage Code */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200/80 font-black font-mono text-[11px]">
                            <span>{item.signage_code}</span>
                          </div>
                        </td>

                        {/* 2. Unit */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{item.unit_name}</div>
                          {item.unit_city && <div className="text-[10px] text-slate-500">{item.unit_city}</div>}
                        </td>

                        {/* 3. Area */}
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-800">
                          {item.area_name}
                        </td>

                        {/* 4. Address */}
                        <td className="py-3 px-4 text-slate-700 leading-snug">
                          <span className="line-clamp-2" title={item.address}>
                            {item.address}
                          </span>
                        </td>

                        {/* 5. Month */}
                        <td className="py-3 px-3.5 whitespace-nowrap font-bold text-slate-900 font-mono">
                          {item.month_formatted}
                        </td>

                        {/* 6. Latitude */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                          {item.latitude ? item.latitude.toFixed(6) : '—'}
                        </td>

                        {/* 7. Longitude */}
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                          {item.longitude ? item.longitude.toFixed(6) : '—'}
                        </td>

                        {/* 8. Condition */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          {getConditionBadge(item.condition)}
                        </td>

                        {/* 9. Distance from Registered Location */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center space-x-1.5">
                            {isMismatch ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                <span>{distanceMeters} m (Mismatch &gt; 500m)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                <span>{distanceMeters} m (Within range)</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 10. Inspected By */}
                        <td className="py-3 px-3.5 whitespace-nowrap font-semibold text-slate-900">
                          <div className="flex items-center space-x-1.5">
                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 font-bold shrink-0">
                              {item.inspected_by_name ? item.inspected_by_name.charAt(0).toUpperCase() : 'B'}
                            </div>
                            <span className="truncate max-w-[140px]">{item.inspected_by_name}</span>
                          </div>
                        </td>

                        {/* 11. Photo Thumbnail */}
                        <td className="py-3 px-3.5 whitespace-nowrap text-center">
                          {item.photo_url || item.photo_path ? (
                            <button
                              type="button"
                              onClick={() => {
                                const photoSrc = item.photo_url || item.photo_path || '';
                                setActivePhoto({
                                  url: photoSrc,
                                  signageCode: item.signage_code,
                                  month: item.month_formatted,
                                  address: item.address,
                                  condition: item.condition,
                                  inspectedBy: item.inspected_by_name,
                                  distance: `${distanceMeters}m (${isMismatch ? 'Mismatch' : 'Verified'})`,
                                });
                              }}
                              className="group relative inline-block rounded-xl overflow-hidden border border-slate-200 shadow-2xs hover:scale-105 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
                              title="Click to view full photo"
                            >
                              <img
                                src={item.photo_url || item.photo_path || ''}
                                alt={`Inspection for ${item.signage_code}`}
                                className="w-12 h-12 object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Eye className="w-4 h-4" />
                              </div>
                            </button>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[11px] text-slate-400">
                              <ImageOff className="w-3.5 h-3.5" />
                              <span>No Photo</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          {!loading && totalRows > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 text-xs text-slate-600">
              <div>
                Showing <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                <span className="font-bold text-slate-900">
                  {Math.min(currentPage * pageSize, totalRows)}
                </span>{' '}
                of <span className="font-bold text-slate-900">{totalRows}</span> inspection logs
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>

                <div className="px-3 py-1.5 text-xs font-bold text-slate-800">
                  Page {currentPage} of {totalPages}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* PHOTO LIGHTBOX MODAL */}
      {activePhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActivePhoto(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-900 font-mono font-black text-xs">
                    {activePhoto.signageCode}
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {activePhoto.month} Inspection Photo
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {activePhoto.address}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Photo View */}
            <div className="bg-slate-950 flex items-center justify-center max-h-[70vh] p-2">
              <img
                src={activePhoto.url}
                alt={activePhoto.signageCode}
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>

            {/* Modal Footer Info */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-4">
                <div>
                  <span className="text-slate-500 font-medium">Condition: </span>
                  <span className="font-bold text-slate-800">{activePhoto.condition}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">GPS Accuracy: </span>
                  <span className="font-bold text-slate-800">{activePhoto.distance}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Inspected By: </span>
                  <span className="font-bold text-slate-800">{activePhoto.inspectedBy}</span>
                </div>
              </div>

              <a
                href={activePhoto.url}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Photo</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
