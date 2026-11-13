'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, MapPin, Building2, Navigation, CheckCircle2, 
  Layers, ShieldCheck, AlertCircle, RefreshCw, Compass 
} from 'lucide-react';
import { Unit, Area, SignageType } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/contexts/auth-context';

const SIGNAGE_TYPES: { type: SignageType; desc: string }[] = [
  { type: 'Hoarding', desc: 'Large roadside billboard/structure' },
  { type: 'Board', desc: 'Standard clinic/shop entrance board' },
  { type: 'Flex', desc: 'Flex banner mounted on pole/wall' },
  { type: 'Wall Paint', desc: 'Direct painted wall promotional display' },
  { type: 'Poster', desc: 'High-density street kiosk/transit poster' },
  { type: 'Other', desc: 'Arch gate, kiosk, pillar wrap, etc.' },
];

export default function RegisterSignagePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [units, setUnits] = useState<Unit[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form state
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [isAddingCustomArea, setIsAddingCustomArea] = useState(false);
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | ''>('');
  const [longitude, setLongitude] = useState<number | ''>('');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [type, setType] = useState<SignageType>('Hoarding');
  const [size, setSize] = useState('20x10 ft');

  // GPS state
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Units and Areas and default to user's assigned unit & area
  useEffect(() => {
    async function loadData() {
      try {
        const [loadedUnits, loadedAreas] = await Promise.all([
          DataService.getUnits(),
          DataService.getAreas(),
        ]);
        setUnits(loadedUnits);
        setAreas(loadedAreas);

        // Pre-select user's assigned unit if available
        let unitToSelect = '';
        if (user?.unit_id && loadedUnits.some(u => u.id === user.unit_id)) {
          unitToSelect = user.unit_id;
        } else if (loadedUnits.length > 0) {
          unitToSelect = loadedUnits[0].id;
        }
        setSelectedUnitId(unitToSelect);

        // Pre-select first area for that unit
        const matchingAreas = loadedAreas.filter(a => a.unit_id === unitToSelect);
        if (matchingAreas.length > 0) {
          setSelectedAreaId(matchingAreas[0].id);
        }
      } catch (e: any) {
        console.error('Failed to load initial data:', e);
        setError(`Failed to load hospital units and areas: ${e?.message || 'Network error'}`);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, [user]);

  // Sync unit when user object becomes available later
  useEffect(() => {
    if (user?.unit_id && units.length > 0) {
      if (units.some(u => u.id === user.unit_id) && selectedUnitId !== user.unit_id) {
        setSelectedUnitId(user.unit_id);
        const matchingAreas = areas.filter(a => a.unit_id === user.unit_id);
        if (matchingAreas.length > 0) {
          setSelectedAreaId(matchingAreas[0].id);
        }
      }
    }
  }, [user, units, areas, selectedUnitId]);

  // Filter areas based on currently selected unit
  const filteredAreas = areas.filter(a => a.unit_id === selectedUnitId);

  // Auto-select first area when unit changes
  useEffect(() => {
    if (!selectedUnitId) return;
    const matching = areas.filter(a => a.unit_id === selectedUnitId);
    if (matching.length > 0) {
      if (!matching.some(a => a.id === selectedAreaId)) {
        setSelectedAreaId(matching[0].id);
      }
    } else {
      setSelectedAreaId('');
    }
  }, [selectedUnitId, areas, selectedAreaId]);

  // GPS Coordinate Detector
  const detectCurrentLocation = () => {
    setDetectingGps(true);
    setGpsError(null);

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your mobile browser.');
      setDetectingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(parseFloat(pos.coords.latitude.toFixed(6)));
        setLongitude(parseFloat(pos.coords.longitude.toFixed(6)));
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setDetectingGps(false);
        setGpsError(null);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        let msg = 'Could not fetch GPS coordinates.';
        if (err.code === 1) {
          msg = 'Location permission was denied. Please allow location access in your iPhone Settings → Safari → Location.';
        } else if (err.code === 2) {
          msg = 'Location unavailable. Ensure your iPhone has cellular or Wi-Fi connectivity and GPS signal.';
        } else if (err.code === 3) {
          msg = 'GPS request timed out. Please tap "Try again".';
        }
        setGpsError(msg);
        setDetectingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Auto-detect on initial load
  useEffect(() => {
    detectCurrentLocation();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedUnitId) {
      const msg = 'Please select a hospital unit.';
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!isAddingCustomArea && !selectedAreaId) {
      const msg = 'Please select an area or tap "+ Add New Area".';
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (isAddingCustomArea && !newAreaName.trim()) {
      const msg = 'Please enter a name for the new area.';
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!address.trim()) {
      const msg = 'Please enter the street address / landmark.';
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (latitude === '' || longitude === '') {
      const msg = 'Please lock your GPS coordinates by tapping "Lock My GPS" before saving.';
      setError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    try {
      let finalAreaId = selectedAreaId;
      if (isAddingCustomArea) {
        const createdArea = await DataService.createArea(selectedUnitId, newAreaName.trim());
        finalAreaId = createdArea.id;
      }

      await DataService.createSignage({
        unit_id: selectedUnitId,
        area_id: finalAreaId,
        address: address.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        type,
        size: size.trim() || undefined,
        assigned_to: user?.id || null,
      });

      router.push('/bd');
    } catch (err: any) {
      console.error('Registration failed:', err);
      let errMsg = err?.message || 'Failed to register signage. Please try again.';
      if (errMsg.toLowerCase().includes('violates row-level security policy') || errMsg.includes('42501')) {
        errMsg = `Supabase RLS Error: Row-Level Security blocked inserting this signage. ` +
          `Please check that the signages table RLS policy allows your role (${user?.role || 'user'}) to insert rows. ` +
          `Details: ${errMsg}`;
      }
      setError(errMsg);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading registration form...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-4 pb-56 md:pb-28">
      {/* Back button */}
      <div className="mb-3">
        <Link
          href="/bd"
          className="inline-flex items-center space-x-1.5 min-h-[44px] text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Signages</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-3xl p-5 shadow-lg mb-5">
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-semibold border border-blue-400/20 mb-2">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span>New Outdoor Asset</span>
        </div>
        <h1 className="text-xl font-black text-white">
          Register Signage
        </h1>
        <p className="text-xs text-slate-300 mt-1">
          Lock GPS coordinates and hospital area for monthly camera inspections.
        </p>
      </div>

      {/* Prominent Error Banner at top of form */}
      {error && (
        <div className="mb-5 p-4 bg-rose-50 border-2 border-rose-300 rounded-3xl text-xs text-rose-900 shadow-sm flex items-start space-x-3 animate-in fade-in duration-150">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div className="space-y-1">
            <span className="font-bold text-rose-950 block">Error Saving Signage:</span>
            <p className="text-xs text-rose-800 leading-relaxed font-medium break-words">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
        {/* 1. Hospital Unit */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              1. Hospital Unit *
            </label>
            {user?.unit && selectedUnitId === user.unit_id && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Your Assigned Unit
              </span>
            )}
          </div>
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            className="w-full min-h-[48px] px-3.5 py-3 text-base sm:text-sm font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 cursor-pointer"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.city})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Geographical Area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              2. Area / Locality *
            </label>
            <button
              type="button"
              onClick={() => setIsAddingCustomArea(!isAddingCustomArea)}
              className="min-h-[44px] inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-700 px-2 cursor-pointer"
            >
              {isAddingCustomArea ? '← Select Existing Area' : '+ Add New Area'}
            </button>
          </div>

          {isAddingCustomArea ? (
            <input
              type="text"
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              placeholder="e.g. Koramangala, Indiranagar, Main Road..."
              className="w-full min-h-[48px] px-3.5 py-3 text-base sm:text-sm rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
            />
          ) : (
            <select
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              className="w-full min-h-[48px] px-3.5 py-3 text-base sm:text-sm font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 cursor-pointer"
            >
              {filteredAreas.length === 0 ? (
                <option value="">No areas found for this unit - tap "+ Add New Area"</option>
              ) : (
                filteredAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              )}
            </select>
          )}
        </div>

        {/* 3. Address & Landmarks */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
            3. Address &amp; Landmark *
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            placeholder="e.g., Near City Metro Station, Opp Pillar 140, Main Signal"
            className="w-full px-3.5 py-2.5 text-base sm:text-sm rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* 4. GPS Coordinates (Clear Flow: Large Button, Success Banner, Try Again on Error) */}
        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <Compass className="w-4 h-4 text-blue-600" />
              <span>4. GPS Coordinates *</span>
            </span>
          </div>

          {/* Large Primary Lock GPS Button when not yet locked */}
          {latitude === '' || longitude === '' ? (
            <button
              type="button"
              onClick={detectCurrentLocation}
              disabled={detectingGps}
              className="w-full min-h-[52px] py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${detectingGps ? 'animate-spin' : ''}`} />
              <span>{detectingGps ? 'Locking GPS Location...' : 'Lock My GPS'}</span>
            </button>
          ) : (
            /* Success State */
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">
                      Location locked: {latitude}, {longitude}
                    </span>
                    {gpsAccuracy !== null && (
                      <span className="text-[11px] text-emerald-700 font-semibold block mt-0.5">
                        Accuracy: ±{gpsAccuracy}m
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={detectCurrentLocation}
                  disabled={detectingGps}
                  className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-bold text-emerald-800 transition-colors cursor-pointer shrink-0"
                >
                  {detectingGps ? 'Locking...' : 'Re-lock GPS'}
                </button>
              </div>
            </div>
          )}

          {/* Error State with Try Again Button */}
          {gpsError && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl space-y-2.5">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 font-medium leading-relaxed">
                  {gpsError}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-amber-200">
                <span className="text-[11px] text-amber-800 font-medium">Please check location permissions</span>
                <button
                  type="button"
                  onClick={detectCurrentLocation}
                  disabled={detectingGps}
                  className="min-h-[40px] px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${detectingGps ? 'animate-spin' : ''}`} />
                  <span>Try again</span>
                </button>
              </div>
            </div>
          )}

          {/* Coordinate Fields (Manual Check or Fine-tuning) */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="e.g. 12.971598"
                className="w-full min-h-[48px] px-3 py-2 text-base sm:text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium block mb-1">Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="e.g. 77.594566"
                className="w-full min-h-[48px] px-3 py-2 text-base sm:text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* 5. Signage Type */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
            5. Signage Type *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SIGNAGE_TYPES.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setType(item.type)}
                className={`min-h-[52px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  type === item.type
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 text-blue-900 font-bold shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <div className="text-xs">{item.type}</div>
                <div className="text-[10px] text-slate-500 font-normal line-clamp-1">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 6. Dimensions / Size */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
            6. Dimensions / Size (Optional)
          </label>
          <input
            type="text"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="e.g., 20x10 ft, 15x8 ft, 6x3 ft"
            className="w-full min-h-[48px] px-3.5 py-3 text-base sm:text-sm rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* Sticky Submit Bar - Positioned firmly ABOVE BottomNav on mobile */}
        <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md p-3 sm:p-4 px-4 sm:px-6 border-t border-slate-200 shadow-[0_-8px_20px_-4px_rgba(0,0,0,0.15)] max-w-lg mx-auto">
          {error && (
            <div className="mb-2.5 p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 text-[11px] font-semibold leading-snug break-words">
                {error}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <Link
              href="/bd"
              className="min-h-[48px] px-4 py-3 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[52px] py-3.5 px-4 rounded-2xl text-sm font-bold bg-blue-600 hover:bg-blue-700 active:scale-98 text-white shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Signage...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Save Signage</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
