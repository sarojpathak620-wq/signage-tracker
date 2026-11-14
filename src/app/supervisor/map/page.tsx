'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, MapPin, Building2, Filter, CheckCircle2, 
  AlertTriangle, AlertOctagon, HelpCircle, RefreshCw 
} from 'lucide-react';
import { Signage, Unit } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { SignageMap } from '@/components/map/SignageMap';

export default function SupervisorMapPage() {
  const [signages, setSignages] = useState<Signage[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const loadData = async () => {
    try {
      const [signagesData, unitsData] = await Promise.all([
        DataService.getSignages({ is_active: true }),
        DataService.getUnits(),
      ]);
      setSignages(signagesData);
      setUnits(unitsData);
    } catch (e) {
      console.error('Failed to load map data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSignages = signages.filter((s) => {
    const matchesUnit = selectedUnitId === 'all' || s.unit_id === selectedUnitId;
    const matchesStatus = selectedStatus === 'all' || s.current_month_status === selectedStatus;
    const cond = s.latest_update?.condition || 'Pending';
    const matchesCondition = selectedCondition === 'all' || cond === selectedCondition;
    return matchesUnit && matchesStatus && matchesCondition;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12">
      {/* Back button */}
      <div className="mb-4">
        <Link
          href="/supervisor"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Supervisor Dashboard</span>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 text-white shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/20 mb-2">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>Geospatial Signage Map</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Hospital Unit Signage Locations & Status
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Real-time interactive pin map filtered by hospital unit, condition, and monthly compliance.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start md:self-auto px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all flex items-center space-x-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Map</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs mb-6 flex flex-wrap items-center justify-between gap-3">
        {/* Unit Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500">Unit:</span>
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 cursor-pointer"
          >
            <option value="all">All Hospital Units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        {/* Condition Filter */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 mr-1">Condition:</span>
          {(['all', 'Good', 'Needs Repair', 'Damaged', 'Missing'] as const).map((cond) => (
            <button
              key={cond}
              onClick={() => setSelectedCondition(cond)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCondition === cond
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cond === 'all' ? 'All' : cond}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-bold text-slate-500 mr-1">Status:</span>
          {(['all', 'Updated', 'Pending', 'Overdue'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                selectedStatus === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {st === 'all' ? 'All' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Map View */}
      {loading ? (
        <div className="h-[500px] flex items-center justify-center bg-slate-900 rounded-3xl text-white">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading geospatial coordinates...</span>
          </div>
        </div>
      ) : (
        <SignageMap 
          signages={filteredSignages} 
          title={
            selectedUnitId === 'all' 
              ? 'All Hospital Units Signages' 
              : `${units.find(u => u.id === selectedUnitId)?.name || 'Outdoor'} Signages`
          }
        />
      )}
    </div>
  );
}
