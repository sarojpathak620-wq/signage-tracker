'use client';

import React, { useState } from 'react';
import { 
  Building2, MapPin, Navigation, ExternalLink, Route, 
  CheckCircle2, ArrowRight, Compass, Eye, Calendar, Clock
} from 'lucide-react';
import { ExecutiveVisitStop } from '@/lib/types';

interface TravelRouteMapProps {
  origin: {
    lat?: number;
    latitude?: number;
    lng?: number;
    longitude?: number;
    address?: string;
    name?: string;
  };
  stops: ExecutiveVisitStop[];
  isRoundTrip?: boolean;
  totalDistanceKm: number;
  googleMapsUrl?: string;
  unitName?: string;
}

export function TravelRouteMap({
  origin,
  stops,
  isRoundTrip = false,
  totalDistanceKm,
  googleMapsUrl,
  unitName = 'Hospital Base Office',
}: TravelRouteMapProps) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  const originLat = origin.lat ?? origin.latitude ?? 26.9678;
  const originLng = origin.lng ?? origin.longitude ?? 75.7725;
  const originAddress = origin.address || origin.name || unitName;

  // All points including origin
  const allPoints = [
    {
      id: 'origin',
      title: unitName,
      address: originAddress,
      lat: originLat,
      lng: originLng,
      isOrigin: true,
      stopNum: 0,
      distanceFromPrev: 0,
    },
    ...stops.map((s, idx) => ({
      id: s.signage_id || `stop-${idx}`,
      code: s.signage_code || `Stop #${idx + 1}`,
      title: s.signage_address,
      address: `${s.signage_area_name ? `${s.signage_area_name} • ` : ''}${s.signage_type}`,
      lat: s.latitude,
      lng: s.longitude,
      isOrigin: false,
      stopNum: idx + 1,
      distanceFromPrev: s.distance_from_hospital_km ?? s.distance_from_previous_km,
      time: s.visited_at,
      condition: s.condition,
      photoUrl: s.photo_url,
    })),
  ];

  // Calculate bounding box for SVG projection
  const lats = allPoints.map(p => p.lat);
  const lngs = allPoints.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Add padding margin to bounds
  const latDelta = Math.max(maxLat - minLat, 0.015);
  const lngDelta = Math.max(maxLng - minLng, 0.015);

  const paddedMinLat = minLat - latDelta * 0.15;
  const paddedMaxLat = maxLat + latDelta * 0.15;
  const paddedMinLng = minLng - lngDelta * 0.15;
  const paddedMaxLng = maxLng + lngDelta * 0.15;

  const getPercentPos = (lat: number, lng: number) => {
    const x = ((lng - paddedMinLng) / (paddedMaxLng - paddedMinLng)) * 100;
    // Invert Y because latitude goes north (up), but SVG/CSS y goes down
    const y = (1 - (lat - paddedMinLat) / (paddedMaxLat - paddedMinLat)) * 100;
    return {
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(12, Math.min(88, y)),
    };
  };

  // Build SVG polyline points
  const polylineCoords = allPoints.map(p => {
    const pos = getPercentPos(p.lat, p.lng);
    return `${pos.x},${pos.y}`;
  });

  if (isRoundTrip && allPoints.length > 1) {
    const originPos = getPercentPos(originLat, originLng);
    polylineCoords.push(`${originPos.x},${originPos.y}`);
  }

  const selectedPoint = selectedPointIndex !== null ? allPoints[selectedPointIndex] : null;

  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
      {/* Top Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Inspection Route &amp; Travel Path</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {totalDistanceKm.toFixed(1)} KM Total
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              From {unitName} across {stops.length} signage stops {isRoundTrip ? '(Round Trip)' : ''}
            </p>
          </div>
        </div>

        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Open in Google Maps (Driving Directions)</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </a>
        )}
      </div>

      {/* Interactive Map Visual Stage */}
      <div className="relative w-full h-80 sm:h-96 bg-radial from-slate-800/90 via-slate-900 to-slate-950 overflow-hidden select-none">
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.25) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* SVG Route Connecting Lines */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none" 
          viewBox="0 0 100 100" 
          preserveAspectRatio="none"
        >
          {/* Shadow glow line */}
          <polyline
            points={polylineCoords.join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeOpacity="0.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Main route line */}
          <polyline
            points={polylineCoords.join(' ')}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1.2"
            strokeDasharray="2, 1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Origin / Hospital Base Pin */}
        {(() => {
          const originPos = getPercentPos(originLat, originLng);
          const isSelected = selectedPointIndex === 0;

          return (
            <div
              style={{ left: `${originPos.x}%`, top: `${originPos.y}%` }}
              onClick={() => setSelectedPointIndex(0)}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group transition-transform hover:scale-125"
            >
              <div className={`px-2.5 py-1 rounded-full shadow-lg flex items-center space-x-1 text-white text-[10px] font-bold border-2 transition-all ${
                isSelected
                  ? 'bg-indigo-600 border-white ring-4 ring-indigo-400/40 scale-110'
                  : 'bg-indigo-700/90 border-indigo-400'
              }`}>
                <Building2 className="w-3.5 h-3.5 text-indigo-200" />
                <span className="max-w-[100px] truncate">Office Base</span>
              </div>
            </div>
          );
        })()}

        {/* Visited Stops Pins */}
        {stops.map((stop, idx) => {
          const pos = getPercentPos(stop.latitude, stop.longitude);
          const stopIndex = idx + 1;
          const isSelected = selectedPointIndex === stopIndex;

          return (
            <div
              key={stop.signage_update_id || `${stop.signage_id}-${idx}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => setSelectedPointIndex(stopIndex)}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group transition-transform hover:scale-125"
            >
              <div className={`px-2.5 py-1 rounded-full shadow-lg flex items-center space-x-1 text-white text-[10px] font-bold border-2 transition-all ${
                isSelected
                  ? 'bg-blue-600 border-white ring-4 ring-blue-400/40 scale-110'
                  : 'bg-slate-800/90 border-cyan-400 text-cyan-200'
              }`}>
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span>{stop.signage_code || `Stop #${idx + 1}`}</span>
              </div>
            </div>
          );
        })}

        {/* Route Summary Floater (Bottom Left) */}
        <div className="absolute bottom-3 left-3 z-10 hidden sm:flex items-center space-x-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-[11px] text-white">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>{stops.length} Signage Stops</span>
          <span className="text-slate-400">&bull;</span>
          <span className="text-cyan-300 font-bold">{totalDistanceKm.toFixed(1)} KM</span>
        </div>
      </div>

      {/* Selected Point Inspector Strip */}
      {selectedPoint && (
        <div className="p-3.5 bg-slate-950 border-t border-slate-800/80 text-white text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              selectedPoint.isOrigin ? 'bg-indigo-600 text-white' : 'bg-cyan-600 text-white'
            }`}>
              {selectedPoint.isOrigin ? <Building2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="font-bold truncate text-slate-100">{selectedPoint.title}</div>
              <div className="text-[11px] text-slate-400 truncate">{selectedPoint.address}</div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[10px] text-slate-400">GPS Coordinates</div>
            <div className="font-mono text-cyan-400 text-[11px]">
              {selectedPoint.lat.toFixed(4)}, {selectedPoint.lng.toFixed(4)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
