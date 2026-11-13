'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, CheckCircle2, AlertTriangle, AlertOctagon, 
  HelpCircle, ExternalLink, Camera, Phone, Navigation, 
  Layers, Maximize2, ZoomIn, ZoomOut 
} from 'lucide-react';
import { Signage, SignageCondition, SignageStatus } from '@/lib/types';

interface SignageMapProps {
  signages: Signage[];
  selectedSignageId?: string | null;
  onSelectSignage?: (signage: Signage) => void;
}

export function SignageMap({ signages, selectedSignageId, onSelectSignage }: SignageMapProps) {
  const [activeSignage, setActiveSignage] = useState<Signage | null>(null);

  useEffect(() => {
    if (selectedSignageId) {
      const found = signages.find(s => s.id === selectedSignageId);
      if (found) setActiveSignage(found);
    } else if (signages.length > 0 && !activeSignage) {
      setActiveSignage(signages[0]);
    }
  }, [selectedSignageId, signages]);

  // Center coordinates calculation based on signages
  const defaultCenter = signages.length > 0
    ? {
        lat: signages.reduce((acc, s) => acc + s.latitude, 0) / signages.length,
        lng: signages.reduce((acc, s) => acc + s.longitude, 0) / signages.length,
      }
    : { lat: 12.9716, lng: 77.5946 };

  // Calculate bounding box for responsive projection
  const minLat = Math.min(...signages.map(s => s.latitude), defaultCenter.lat - 0.05);
  const maxLat = Math.max(...signages.map(s => s.latitude), defaultCenter.lat + 0.05);
  const minLng = Math.min(...signages.map(s => s.longitude), defaultCenter.lng - 0.05);
  const maxLng = Math.max(...signages.map(s => s.longitude), defaultCenter.lng + 0.05);

  const getPinColor = (signage: Signage) => {
    const condition = signage.latest_update?.condition;
    const status = signage.current_month_status;

    if (condition === 'Damaged' || status === 'Overdue') {
      return { bg: 'bg-rose-600', ring: 'ring-rose-400', icon: '🔴', text: 'text-rose-600' };
    }
    if (condition === 'Missing') {
      return { bg: 'bg-purple-600', ring: 'ring-purple-400', icon: '🟣', text: 'text-purple-600' };
    }
    if (condition === 'Needs Repair' || status === 'Pending') {
      return { bg: 'bg-amber-500', ring: 'ring-amber-400', icon: '🟡', text: 'text-amber-500' };
    }
    return { bg: 'bg-emerald-600', ring: 'ring-emerald-400', icon: '🟢', text: 'text-emerald-600' };
  };

  // Convert GPS (lat, lng) to percentage on the canvas
  const getCoordinatesPercent = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng || 0.01)) * 80 + 10;
    const y = ((maxLat - lat) / (maxLat - minLat || 0.01)) * 76 + 12;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  return (
    <div className="relative w-full h-[600px] rounded-3xl overflow-hidden border border-slate-200 bg-slate-900 shadow-xl flex flex-col md:flex-row">
      {/* Map View Area */}
      <div className="relative flex-1 h-full overflow-hidden bg-[#0f172a] select-none">
        {/* Stylized Map Grid / Radar Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-70" />
        
        {/* Subtle geographic roads/rivers stylization */}
        <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 0 150 Q 300 200 600 120 T 1200 300" stroke="#38bdf8" strokeWidth="4" fill="none" />
          <path d="M 100 0 Q 250 300 400 600" stroke="#64748b" strokeWidth="3" fill="none" />
          <path d="M 500 0 Q 450 350 700 600" stroke="#64748b" strokeWidth="3" fill="none" />
          <path d="M 0 450 Q 400 380 900 500" stroke="#38bdf8" strokeWidth="2" fill="none" />
        </svg>

        {/* City / Hospital Zone Markers */}
        <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/60 text-white text-xs">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold">Bangalore Metro Outdoor Signages</span>
          <span className="text-slate-400">({signages.length} Active Pins)</span>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center space-x-3 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-700/60 text-[11px] text-white">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Good / Updated</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Needs Repair / Pending</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Damaged / Overdue</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Missing</span>
          </span>
        </div>

        {/* Signage Pins Layer */}
        <div className="absolute inset-0 p-8">
          {signages.map((s) => {
            const pos = getCoordinatesPercent(s.latitude, s.longitude);
            const isSelected = activeSignage?.id === s.id;
            const pin = getPinColor(s);

            return (
              <div
                key={s.id}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                onClick={() => {
                  setActiveSignage(s);
                  if (onSelectSignage) onSelectSignage(s);
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20 transition-all hover:scale-125"
              >
                {/* Ping animation if selected or overdue */}
                {(isSelected || s.current_month_status === 'Overdue') && (
                  <span className={`absolute -inset-2 rounded-full ${pin.bg} opacity-75 animate-ping`} />
                )}

                {/* Marker Body */}
                <div
                  className={`relative px-2.5 py-1.5 rounded-full shadow-lg flex items-center space-x-1 text-white text-[11px] font-bold border-2 ${
                    isSelected
                      ? 'border-white bg-blue-600 scale-110 shadow-blue-500/50'
                      : `border-slate-900 ${pin.bg}`
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap max-w-[90px] truncate">
                    {s.area?.name || s.type}
                  </span>
                </div>

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                  <div className="bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded-xl shadow-xl whitespace-nowrap border border-slate-700">
                    <div className="font-bold">{s.address}</div>
                    <div className="text-slate-400">{s.unit?.name} • {s.type}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Signage Sidebar / Inspector Card */}
      <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-5 flex flex-col justify-between overflow-y-auto">
        {activeSignage ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {activeSignage.type}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeSignage.current_month_status === 'Updated'
                    ? 'bg-emerald-100 text-emerald-800'
                    : activeSignage.current_month_status === 'Overdue'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {activeSignage.current_month_status}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                {activeSignage.area?.name}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {activeSignage.address}
              </p>
            </div>

            {/* Photo Preview if available */}
            {activeSignage.latest_update?.photo_url ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-900">
                <img
                  src={activeSignage.latest_update.photo_url}
                  alt="Signage photo"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-sm p-1.5 rounded-lg text-white text-[10px] flex items-center justify-between">
                  <span>{new Date(activeSignage.latest_update.uploaded_at).toLocaleDateString()}</span>
                  <span className="font-bold text-emerald-400">
                    {activeSignage.latest_update.condition}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Camera className="w-6 h-6 text-slate-400 mx-auto" />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Pending camera upload
                </span>
              </div>
            )}

            {/* Details */}
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Hospital Unit:</span>
                <span className="font-semibold text-slate-800">{activeSignage.unit?.name}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Assigned BD:</span>
                <span className="font-semibold text-slate-800">
                  {activeSignage.assigned_profile?.full_name || 'Unassigned'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500">Coordinates:</span>
                <span className="font-mono text-slate-800 text-[11px]">
                  {activeSignage.latitude.toFixed(4)}, {activeSignage.longitude.toFixed(4)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-2">
              <a
                href={`https://www.google.com/maps?q=${activeSignage.latitude},${activeSignage.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Open in Google Maps</span>
                <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
              </a>

              {activeSignage.assigned_profile?.phone && (
                <a
                  href={`tel:${activeSignage.assigned_profile.phone}`}
                  className="w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-blue-200"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call {activeSignage.assigned_profile.full_name}</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <MapPin className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">Click on any map pin to inspect signage details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
