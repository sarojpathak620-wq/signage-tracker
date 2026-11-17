'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Download, Printer, FileBarChart2, 
  Building2, CheckCircle2, Clock, AlertTriangle, 
  Search, Filter, ExternalLink, Camera 
} from 'lucide-react';
import { Signage, Unit } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/contexts/auth-context';

export default function SupervisorReportsPage() {
  const { user } = useAuth();
  const [signages, setSignages] = useState<Signage[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitSummaries, setUnitSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [currentMonthName, setCurrentMonthName] = useState('Current Month');
  const [generatedDateStr, setGeneratedDateStr] = useState('');

  const isUnitHead = user?.role === 'supervisor';
  const assignedUnitId = isUnitHead ? user?.unit_id : null;

  useEffect(() => {
    setCurrentMonthName(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
    setGeneratedDateStr(new Date().toLocaleDateString());

    async function load() {
      try {
        const [signagesData, unitsData, summariesData] = await Promise.all([
          DataService.getSignages({
            is_active: true,
            unit_id: assignedUnitId || undefined,
          }),
          DataService.getUnits(),
          DataService.getUnitStatusSummary(),
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
      } catch (e) {
        console.error('Failed to load reports data:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assignedUnitId]);

  // CSV Download Handler
  const handleDownloadCSV = async () => {
    setDownloading(true);
    try {
      const csvContent = await DataService.exportMonthlyReportCSV(assignedUnitId || undefined);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Hospital_Signage_Monthly_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Download CSV error:', e);
    } finally {
      setDownloading(false);
    }
  };

  const totalSignages = signages.length;
  const updatedSignages = signages.filter(s => s.current_month_status === 'Updated').length;
  const pendingSignages = signages.filter(s => s.current_month_status === 'Pending').length;
  const overdueSignages = signages.filter(s => s.current_month_status === 'Overdue').length;
  const complianceRate = totalSignages > 0 ? Math.round((updatedSignages / totalSignages) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12 print:p-0 print:max-w-none">
      {/* Back button (hidden during print) */}
      <div className="mb-4 print:hidden">
        <Link
          href="/supervisor"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Unit Head Portal</span>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 text-white shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 print:bg-none print:text-black print:p-0 print:shadow-none print:border-b print:pb-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/20 mb-2 print:hidden">
            <FileBarChart2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Unit Head Executive Monthly Report</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white print:text-slate-900">
            Outdoor Signage Compliance Report
          </h1>
          <p className="text-xs text-slate-300 print:text-slate-600 mt-0.5">
            Report Period: <strong>{currentMonthName}</strong> • Generated on {generatedDateStr}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 print:hidden">
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/10 transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            disabled={downloading}
            className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Tracked Signages</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalSignages}</div>
          <span className="text-[10px] text-slate-400">All registered assets</span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-xs">
          <span className="text-xs text-emerald-800 font-medium">Inspected This Month</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{updatedSignages}</div>
          <span className="text-[10px] text-emerald-600 font-bold">{complianceRate}% Monthly Compliance</span>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-xs">
          <span className="text-xs text-amber-800 font-medium">Pending Photo Update</span>
          <div className="text-2xl font-black text-amber-700 mt-1">{pendingSignages}</div>
          <span className="text-[10px] text-amber-600">Reminder stage</span>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 shadow-xs">
          <span className="text-xs text-rose-800 font-medium">Overdue (Escalated)</span>
          <div className="text-2xl font-black text-rose-700 mt-1">{overdueSignages}</div>
          <span className="text-[10px] text-rose-600 font-bold">Requires Action</span>
        </div>
      </div>

      {/* Unit-Wise Summary Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden mb-8">
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">
            Hospital Unit Compliance Summary
          </h2>
          <p className="text-xs text-slate-500">
            Unit-level breakdown of updated, pending, and overdue marketing signages.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Hospital Unit</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4 text-center">Total Signages</th>
                <th className="py-3 px-4 text-center">Updated</th>
                <th className="py-3 px-4 text-center">Pending</th>
                <th className="py-3 px-4 text-center">Overdue</th>
                <th className="py-3 px-4 text-right">Compliance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unitSummaries.map((summary) => (
                <tr key={summary.unit.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {summary.unit.name}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {summary.unit.city}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-800">
                    {summary.total}
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-700 font-semibold">
                    {summary.updated}
                  </td>
                  <td className="py-3 px-4 text-center text-amber-700 font-semibold">
                    {summary.pending}
                  </td>
                  <td className="py-3 px-4 text-center text-rose-700 font-semibold">
                    {summary.overdue}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-bold text-slate-900">{summary.complianceRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Signage Inventory Report */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">
            Signage Asset Audit Register ({signages.length})
          </h2>
          <p className="text-xs text-slate-500">
            Complete inventory log with GPS, condition evaluation, and inspector verification.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Area & Address</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Assigned BD</th>
                <th className="py-3 px-4">Distance</th>
                <th className="py-3 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {signages.map((s) => {
                const update = s.latest_update;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 max-w-xs">
                      <div className="font-bold text-slate-900">{s.area?.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{s.address}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {s.unit?.name}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                        {s.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap font-semibold">
                      <span className={
                        s.current_month_status === 'Updated'
                          ? 'text-emerald-700'
                          : s.current_month_status === 'Overdue'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }>
                        {s.current_month_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {update?.condition ? (
                        <span className="font-semibold text-slate-800">{update.condition}</span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {s.assigned_profile?.full_name || 'Unassigned'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px]">
                      {update?.distance_from_site_m !== undefined && update?.distance_from_site_m !== null
                        ? `${update.distance_from_site_m}m`
                        : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate text-[11px]">
                      {update?.remarks || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
