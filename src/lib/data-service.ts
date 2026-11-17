'use client';

import {
  Unit, Area, Profile, Signage, SignageUpdate,
  AppSettings, NotificationItem, SignageStatusView, SignageType, SignageCondition, SignageStatus,
  TravelRequest, TravelRequestStop, TravelRequestStatus,
  ExecutiveVisitStop, MonthlyTravelSummary, InspectionAuditLogItem
} from './types';
import {
  INITIAL_UNITS, INITIAL_AREAS, INITIAL_PROFILES,
  INITIAL_SIGNAGES, INITIAL_UPDATES, INITIAL_SETTINGS,
  INITIAL_NOTIFICATIONS
} from './demo-data';
import { createClient, isSupabaseConfigured } from './supabase/client';
import { uploadSignagePhoto, getSignedPhotoUrl, deleteSignagePhoto } from './supabase/storage';

const STORAGE_KEYS = {
  UNITS: 'st_units_seh_v1',
  AREAS: 'st_areas_seh_v1',
  PROFILES: 'st_profiles_v1',
  SIGNAGES: 'st_signages_seh_v1',
  UPDATES: 'st_updates_v1',
  SETTINGS: 'st_settings_v1',
  NOTIFICATIONS: 'st_notifications_v1',
  TRAVEL_REQUESTS: 'st_travel_requests_v1',
  TRAVEL_REQUEST_STOPS: 'st_travel_request_stops_v1',
};

// Helper to calculate distance in meters between two GPS coordinates using Haversine formula
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export interface UnitBaseLocation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export const SANKARA_HOSPITAL_LOCATIONS: Record<string, UnitBaseLocation> = {
  jaipur: {
    name: 'Sankara Eye Hospital, Jaipur',
    address: 'Sector 2, Vidhyadhar Nagar, Jaipur, Rajasthan 302039',
    latitude: 26.9678,
    longitude: 75.7725,
  },
  bangalore: {
    name: 'Sankara Eye Hospital, Bangalore',
    address: 'Varthur Main Rd, Kundalahalli Gate, Bengaluru, Karnataka 560037',
    latitude: 12.9602,
    longitude: 77.7126,
  },
  coimbatore: {
    name: 'Sankara Eye Hospital, Coimbatore (Sivanandapuram)',
    address: 'Sivanandapuram, Saravanampatti, Coimbatore, Tamil Nadu 641035',
    latitude: 11.0561,
    longitude: 76.9976,
  },
  anand: {
    name: 'Sankara Eye Hospital, Anand',
    address: 'Mogar, Anand, Gujarat 388340',
    latitude: 22.5645,
    longitude: 72.9289,
  },
  ludhiana: {
    name: 'Sankara Eye Hospital, Ludhiana',
    address: 'GT Road, Near Verka Milk Plant, Ludhiana, Punjab 141001',
    latitude: 30.9010,
    longitude: 75.8573,
  },
  kanpur: {
    name: 'Sankara Eye Hospital, Kanpur',
    address: 'Kalyanpur, Kanpur, Uttar Pradesh 208017',
    latitude: 26.4499,
    longitude: 80.3319,
  },
  varanasi: {
    name: 'Sankara Eye Hospital, Varanasi',
    address: 'Harhua, Airport Road, Varanasi, Uttar Pradesh 221105',
    latitude: 25.3176,
    longitude: 82.9739,
  },
  guntur: {
    name: 'Sankara Eye Hospital, Guntur',
    address: 'Pedakakani, Guntur, Andhra Pradesh 522509',
    latitude: 16.3067,
    longitude: 80.4365,
  },
  hyderabad: {
    name: 'Sankara Eye Hospital, Hyderabad',
    address: 'Gachibowli, Hyderabad, Telangana 500032',
    latitude: 17.4401,
    longitude: 78.3489,
  },
  indore: {
    name: 'Sankara Eye Hospital, Indore',
    address: 'Bicholi Mardana, Indore, Madhya Pradesh 452016',
    latitude: 22.7196,
    longitude: 75.8577,
  },
  panvel: {
    name: 'Sankara Eye Hospital, Panvel (Navi Mumbai)',
    address: 'Sector 19, New Panvel, Navi Mumbai, Maharashtra 410206',
    latitude: 18.9894,
    longitude: 73.1175,
  },
  shimoga: {
    name: 'Sankara Eye Hospital, Shimoga',
    address: 'Mattur Road, Harakere, Shimoga, Karnataka 577203',
    latitude: 13.9299,
    longitude: 75.5681,
  },
  chennai: {
    name: 'Sankara Eye Hospital, Chennai (Pammal)',
    address: 'Pammal, Chennai, Tamil Nadu 600075',
    latitude: 12.9675,
    longitude: 80.1491,
  },
  krishnankoil: {
    name: 'Sankara Eye Hospital, Krishnankoil',
    address: 'Srivilliputtur, Krishnankoil, Tamil Nadu 626126',
    latitude: 9.5982,
    longitude: 77.6369,
  },
};

export function getUnitBaseCoordinates(unit?: { name?: string; city?: string; latitude?: number; longitude?: number; address?: string } | null): UnitBaseLocation {
  if (unit?.latitude && unit?.longitude) {
    return {
      name: unit.name || 'Hospital Base Office',
      address: unit.address || `${unit.name || 'Hospital Unit'}, ${unit.city || ''}`,
      latitude: Number(unit.latitude),
      longitude: Number(unit.longitude),
    };
  }

  const query = `${unit?.name || ''} ${unit?.city || ''}`.toLowerCase();
  for (const [key, loc] of Object.entries(SANKARA_HOSPITAL_LOCATIONS)) {
    if (query.includes(key)) {
      return {
        ...loc,
        name: unit?.name ? `${unit.name} (${loc.name})` : loc.name,
      };
    }
  }

  // Default fallback: Jaipur hospital unit
  return SANKARA_HOSPITAL_LOCATIONS.jaipur;
}

export function buildGoogleMapsDirectionsUrl(params: {
  originLat: number;
  originLng: number;
  originName?: string;
  stops: { lat: number; lng: number; label?: string }[];
  isRoundTrip?: boolean;
}): string {
  const { originLat, originLng, stops, isRoundTrip = false } = params;
  if (!stops || stops.length === 0) {
    return `https://www.google.com/maps/search/?api=1&query=${originLat},${originLng}`;
  }

  const originStr = `${originLat},${originLng}`;
  let destStr = '';
  let waypointsStr = '';

  if (isRoundTrip) {
    destStr = originStr;
    waypointsStr = stops.map(s => `${s.lat},${s.lng}`).join('|');
  } else if (stops.length === 1) {
    destStr = `${stops[0].lat},${stops[0].lng}`;
  } else {
    destStr = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
    const intermediateStops = stops.slice(0, stops.length - 1);
    if (intermediateStops.length > 0) {
      waypointsStr = intermediateStops.map(s => `${s.lat},${s.lng}`).join('|');
    }
  }

  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&travelmode=driving`;
  if (waypointsStr) {
    url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
  }
  return url;
}

export function getUnitCodePrefix(unitNameOrCity?: string): string {
  if (!unitNameOrCity) return 'SEH';
  const lower = unitNameOrCity.toLowerCase();
  if (lower.includes('jaipur')) return 'SEHJ';
  if (lower.includes('bangalore') || lower.includes('bengaluru')) return 'SEHB';
  if (lower.includes('coimbatore')) return 'SEHC';
  if (lower.includes('anand')) return 'SEHA';
  if (lower.includes('ludhiana')) return 'SEHL';
  if (lower.includes('kanpur')) return 'SEHK';
  if (lower.includes('varanasi')) return 'SEHV';
  if (lower.includes('guntur')) return 'SEHG';
  if (lower.includes('hyderabad')) return 'SEHH';
  if (lower.includes('indore')) return 'SEHI';
  if (lower.includes('panvel') || lower.includes('mumbai')) return 'SEHP';
  if (lower.includes('shimoga')) return 'SEHS';
  if (lower.includes('chennai')) return 'SEHM';
  if (lower.includes('krishnankoil')) return 'SEHKK';

  const cleaned = unitNameOrCity.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return cleaned.slice(0, 4) || 'SEH';
}

export function getSignageCode(
  signage?: { code?: string | null; id?: string; unit?: { name?: string; city?: string } | null; unit_id?: string } | null,
  fallbackIndex: number = 1
): string {
  if (signage?.code && signage.code.trim()) {
    return signage.code.trim().toUpperCase();
  }
  const prefix = getUnitCodePrefix(signage?.unit?.name || signage?.unit?.city);
  return `${prefix}${String(fallbackIndex).padStart(2, '0')}`;
}

// Helper to get current month first-day string: 'YYYY-MM-01'
export function getCurrentMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// Helper to format date / month key into readable label: 'Jan 2027', 'Nov 2026'
export function formatAuditMonth(monthStr?: string): string {
  if (!monthStr) return '—';
  try {
    const cleanStr = monthStr.split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const date = new Date(year, month, 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return monthStr;
  } catch {
    return monthStr;
  }
}

// Helper to load localStorage or fallback
function getStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('LocalStorage save error:', e);
  }
}

export const DataService = {
  // UNITS
  async getUnits(): Promise<Unit[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data, error } = await supabase.from('units').select('*, areas(id), signages(id)');
      if (!error && data) {
        return data.map((u: any) => ({
          ...u,
          _count: {
            areas: u.areas?.length || 0,
            signages: u.signages?.length || 0,
          },
        }));
      }
    }

    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const areas = getStored<Area[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
    const signages = getStored<Signage[]>(STORAGE_KEYS.SIGNAGES, INITIAL_SIGNAGES);

    return units.map(u => ({
      ...u,
      _count: {
        areas: areas.filter(a => a.unit_id === u.id).length,
        signages: signages.filter(s => s.unit_id === u.id).length,
      },
    }));
  },

  async createUnit(name: string, city: string): Promise<Unit> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data, error } = await supabase.from('units').insert({ name, city }).select().single();
      if (error) throw new Error(error.message);
      return data;
    }

    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const newUnit: Unit = {
      id: crypto.randomUUID(),
      name,
      city,
      created_at: new Date().toISOString(),
      _count: { areas: 0, signages: 0 },
    };
    units.push(newUnit);
    setStored(STORAGE_KEYS.UNITS, units);
    return newUnit;
  },

  async updateUnit(id: string, name: string, city: string): Promise<Unit> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data, error } = await supabase.from('units').update({ name, city }).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data;
    }

    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const idx = units.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Unit not found');
    units[idx] = { ...units[idx], name, city };
    setStored(STORAGE_KEYS.UNITS, units);
    return units[idx];
  },

  async deleteUnit(id: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { error } = await supabase.from('units').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }

    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const filtered = units.filter(u => u.id !== id);
    setStored(STORAGE_KEYS.UNITS, filtered);
  },

  // AREAS
  async getAreas(unitId?: string): Promise<Area[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      let query = supabase.from('areas').select('*, unit:units(*), signages(id)');
      if (unitId) query = query.eq('unit_id', unitId);
      const { data, error } = await query;
      if (!error && data) {
        return data.map((a: any) => ({
          ...a,
          _count: { signages: a.signages?.length || 0 },
        }));
      }
    }

    const areas = getStored<Area[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const signages = getStored<Signage[]>(STORAGE_KEYS.SIGNAGES, INITIAL_SIGNAGES);

    let result = areas;
    if (unitId) {
      result = result.filter(a => a.unit_id === unitId);
    }

    return result.map(a => ({
      ...a,
      unit: units.find(u => u.id === a.unit_id),
      _count: {
        signages: signages.filter(s => s.area_id === a.id).length,
      },
    }));
  },

  async createArea(unitId: string, name: string): Promise<Area> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data, error } = await supabase.from('areas').insert({ unit_id: unitId, name }).select('*, unit:units(*)').single();
      if (error) {
        console.error('Supabase createArea error:', error);
        const errInfo = [error.message, error.details, error.hint ? `Hint: ${error.hint}` : null, error.code ? `Code: ${error.code}` : null].filter(Boolean).join(' | ');
        throw new Error(`Area creation failed: ${errInfo}`);
      }
      return data;
    }

    const areas = getStored<Area[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const newArea: Area = {
      id: crypto.randomUUID(),
      unit_id: unitId,
      name,
      created_at: new Date().toISOString(),
      unit: units.find(u => u.id === unitId),
      _count: { signages: 0 },
    };
    areas.push(newArea);
    setStored(STORAGE_KEYS.AREAS, areas);
    return newArea;
  },

  async updateArea(id: string, unitId: string, name: string): Promise<Area> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data, error } = await supabase.from('areas').update({ unit_id: unitId, name }).eq('id', id).select('*, unit:units(*)').single();
      if (error) throw new Error(error.message);
      return data;
    }

    const areas = getStored<Area[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const idx = areas.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Area not found');
    areas[idx] = { ...areas[idx], unit_id: unitId, name, unit: units.find(u => u.id === unitId) };
    setStored(STORAGE_KEYS.AREAS, areas);
    return areas[idx];
  },

  async deleteArea(id: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { error } = await supabase.from('areas').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }

    const areas = getStored<Area[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
    const filtered = areas.filter(a => a.id !== id);
    setStored(STORAGE_KEYS.AREAS, filtered);
  },

  // USERS / PROFILES
  async getProfiles(): Promise<Profile[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data, error } = await supabase.from('profiles').select('*, unit:units(*)');
      if (!error && data) return data;
    }

    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);

    return profiles.map(p => ({
      ...p,
      unit: p.unit_id ? units.find(u => u.id === p.unit_id) || null : null,
    }));
  },

  async createProfile(data: { full_name: string; email: string; role: Profile['role']; phone?: string; unit_id?: string | null; password?: string }): Promise<Profile> {
    if (isSupabaseConfigured()) {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create user');
      }
      return response.json();
    }

    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const newProfile: Profile = {
      id: crypto.randomUUID(),
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      phone: data.phone || null,
      unit_id: data.unit_id || null,
      unit: data.unit_id ? units.find(u => u.id === data.unit_id) || null : null,
      created_at: new Date().toISOString(),
    };
    profiles.push(newProfile);
    setStored(STORAGE_KEYS.PROFILES, profiles);
    return newProfile;
  },

  async updateProfile(id: string, data: Partial<Profile>): Promise<Profile> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data: updated, error } = await supabase.from('profiles').update(data).eq('id', id).select('*, unit:units(*)').single();
      if (error) throw new Error(error.message);
      return updated;
    }

    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('User not found');
    profiles[idx] = {
      ...profiles[idx],
      ...data,
      unit: data.unit_id ? units.find(u => u.id === data.unit_id) || null : profiles[idx].unit,
    };
    setStored(STORAGE_KEYS.PROFILES, profiles);
    return profiles[idx];
  },

  async deleteUser(userId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const response = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to delete user');
      }
      return;
    }

    // Demo LocalStorage Fallback
    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const signages = getStored<Signage[]>(STORAGE_KEYS.SIGNAGES, INITIAL_SIGNAGES);

    // Unassign signages (set assigned_to to null, do not delete signage)
    const updatedSignages = signages.map(s => 
      s.assigned_to === userId ? { ...s, assigned_to: null, assigned_profile: null } : s
    );
    setStored(STORAGE_KEYS.SIGNAGES, updatedSignages);

    // Remove from profiles (past updates and photos remain untouched)
    const filtered = profiles.filter(p => p.id !== userId);
    setStored(STORAGE_KEYS.PROFILES, filtered);
  },

  // SIGNAGES
  async getSignages(params?: { unit_id?: string; area_id?: string; assigned_to?: string; is_active?: boolean }): Promise<Signage[]> {
    const currentMonth = getCurrentMonthKey();
    const settings = await this.getSettings();
    const deadlineDay = settings.deadline_day || 25;
    const currentDay = new Date().getDate();

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      let query = supabase.from('signages').select('*, unit:units(*), area:areas(*), assigned_profile:profiles(*)');
      if (params?.unit_id) query = query.eq('unit_id', params.unit_id);
      if (params?.area_id) query = query.eq('area_id', params.area_id);
      if (params?.assigned_to) query = query.eq('assigned_to', params.assigned_to);
      if (params?.is_active !== undefined) query = query.eq('is_active', params.is_active);
      const { data: signagesData, error } = await query;

      if (!error && signagesData) {
        // Fetch all signage updates, sorted by uploaded_at descending
        let updatesData: any = null;
        const resWithFkey = await supabase
          .from('signage_updates')
          .select('*, uploader:profiles!signage_updates_uploaded_by_fkey(*)')
          .order('uploaded_at', { ascending: false });

        if (!resWithFkey.error && resWithFkey.data) {
          updatesData = resWithFkey.data;
        } else {
          const fallbackRes = await supabase
            .from('signage_updates')
            .select('*')
            .order('uploaded_at', { ascending: false });
          updatesData = fallbackRes.data;
        }

        const resolvedSignages = await Promise.all(
          signagesData.map(async (s: any) => {
            const allUpdates = updatesData?.filter((u: any) => u.signage_id === s.id) || [];
            const currentMonthUpdate = allUpdates.find((u: any) => u.month === currentMonth);
            const latest = currentMonthUpdate || allUpdates[0] || null;
            const status: SignageStatus = currentMonthUpdate ? 'Updated' : (currentDay > deadlineDay ? 'Overdue' : 'Pending');

            let latestWithPhoto: SignageUpdate | null = null;
            if (latest) {
              const photoUrl = await getSignedPhotoUrl(latest.photo_path);
              latestWithPhoto = {
                ...latest,
                photo_url: photoUrl || latest.photo_url || latest.photo_path,
              };
            }

            return {
              ...s,
              latest_update: latestWithPhoto,
              current_month_status: status,
            };
          })
        );

        return resolvedSignages;
      }
    }

    const signages = getStored<Signage[]>(STORAGE_KEYS.SIGNAGES, INITIAL_SIGNAGES);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const areas = getStored<Area[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const updates = getStored<SignageUpdate[]>(STORAGE_KEYS.UPDATES, INITIAL_UPDATES);

    let result = signages;
    if (params?.unit_id) result = result.filter(s => s.unit_id === params.unit_id);
    if (params?.area_id) result = result.filter(s => s.area_id === params.area_id);
    if (params?.assigned_to) result = result.filter(s => s.assigned_to === params.assigned_to);
    if (params?.is_active !== undefined) result = result.filter(s => s.is_active === params.is_active);

    return result.map(s => {
      const latestUpdate = updates
        .filter(u => u.signage_id === s.id)
        .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())[0] || null;

      const currentMonthUpdate = updates.find(u => u.signage_id === s.id && u.month === currentMonth);
      const status: SignageStatus = currentMonthUpdate ? 'Updated' : (currentDay > deadlineDay ? 'Overdue' : 'Pending');

      return {
        ...s,
        unit: units.find(u => u.id === s.unit_id),
        area: areas.find(a => a.id === s.area_id),
        assigned_profile: profiles.find(p => p.id === s.assigned_to) || null,
        latest_update: currentMonthUpdate || latestUpdate,
        current_month_status: status,
      };
    });
  },

  async getSignageById(id: string): Promise<Signage | null> {
    const signages = await this.getSignages();
    return signages.find(s => s.id === id) || null;
  },

  // BD EXECUTIVE: REGISTER NEW SIGNAGE
  async createSignage(data: {
    unit_id: string;
    area_id: string;
    address: string;
    latitude: number;
    longitude: number;
    type: SignageType;
    size?: string;
    assigned_to?: string | null;
    code?: string;
  }): Promise<Signage> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();

      // Ensure assigned_to has a fallback to the current authenticated user if not passed
      let assignedTo = data.assigned_to;
      if (!assignedTo) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user?.id) {
            assignedTo = authData.user.id;
          }
        } catch (authErr) {
          console.warn('Could not retrieve current auth user id:', authErr);
        }
      }

      const insertPayload: Record<string, any> = {
        unit_id: data.unit_id,
        area_id: data.area_id,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        type: data.type,
        size: data.size || null,
        assigned_to: assignedTo || null,
        is_active: true,
      };
      if (data.code) {
        insertPayload.code = data.code;
      }

      let res = await supabase
        .from('signages')
        .insert(insertPayload)
        .select('*, unit:units(*), area:areas(*), assigned_profile:profiles(*)')
        .single();

      // Fallback if 'code' column does not exist yet in Supabase
      if (res.error && res.error.message?.includes('code')) {
        delete insertPayload.code;
        res = await supabase
          .from('signages')
          .insert(insertPayload)
          .select('*, unit:units(*), area:areas(*), assigned_profile:profiles(*)')
          .single();
      }

      if (res.error) {
        console.error('Supabase createSignage error:', res.error);
        const errParts = [
          res.error.message,
          res.error.details,
          res.error.hint ? `Hint: ${res.error.hint}` : null,
          res.error.code ? `Code: ${res.error.code}` : null,
        ].filter(Boolean);
        throw new Error(errParts.join(' | ') || res.error.message);
      }
      return res.data;
    }

    const signages = getStored<Signage[]>(STORAGE_KEYS.SIGNAGES, INITIAL_SIGNAGES);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const areas = getStored<Area[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);

    const newSignage: Signage = {
      id: crypto.randomUUID(),
      code: data.code || null,
      unit_id: data.unit_id,
      area_id: data.area_id,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      type: data.type,
      size: data.size || null,
      installed_date: new Date().toISOString().slice(0, 10),
      assigned_to: data.assigned_to || null,
      is_active: true,
      created_at: new Date().toISOString(),
      unit: units.find(u => u.id === data.unit_id),
      area: areas.find(a => a.id === data.area_id),
      assigned_profile: data.assigned_to ? profiles.find(p => p.id === data.assigned_to) || null : null,
      latest_update: null,
      current_month_status: 'Pending',
    };

    signages.unshift(newSignage);
    setStored(STORAGE_KEYS.SIGNAGES, signages);
    return newSignage;
  },

  async reassignSignage(id: string, assignedTo: string | null): Promise<Signage> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data, error } = await supabase.from('signages').update({ assigned_to: assignedTo }).eq('id', id).select('*, unit:units(*), area:areas(*), assigned_profile:profiles(*)').single();
      if (error) throw new Error(error.message);
      return data;
    }

    const signages = getStored<Signage[]>(STORAGE_KEYS.SIGNAGES, INITIAL_SIGNAGES);
    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const idx = signages.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Signage not found');
    signages[idx] = {
      ...signages[idx],
      assigned_to: assignedTo,
      assigned_profile: assignedTo ? profiles.find(p => p.id === assignedTo) || null : null,
    };
    setStored(STORAGE_KEYS.SIGNAGES, signages);
    return signages[idx];
  },

  async toggleSignageActive(id: string, is_active: boolean): Promise<Signage> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data, error } = await supabase.from('signages').update({ is_active }).eq('id', id).select('*, unit:units(*), area:areas(*), assigned_profile:profiles(*)').single();
      if (error) throw new Error(error.message);
      return data;
    }

    const signages = getStored<Signage[]>(STORAGE_KEYS.SIGNAGES, INITIAL_SIGNAGES);
    const idx = signages.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Signage not found');
    signages[idx] = { ...signages[idx], is_active };
    setStored(STORAGE_KEYS.SIGNAGES, signages);
    return signages[idx];
  },

  // BD EXECUTIVE: MONTHLY PHOTO INSPECTION UPLOAD
  async uploadSignageUpdate(params: {
    signage_id: string;
    condition: SignageCondition;
    remarks?: string;
    latitude: number;
    longitude: number;
    photo_file: File | Blob;
    uploaded_by?: string;
    signage_lat?: number;
    signage_lng?: number;
  }): Promise<SignageUpdate> {
    const currentMonth = getCurrentMonthKey();
    
    let signage: Signage | null = null;
    try {
      signage = await this.getSignageById(params.signage_id);
    } catch (e) {
      console.warn('Could not fetch signage for update:', e);
    }

    // Resolve signage coordinates
    const targetLat = params.signage_lat ?? signage?.latitude ?? params.latitude;
    const targetLng = params.signage_lng ?? signage?.longitude ?? params.longitude;

    // Calculate distance between user coordinates and registered signage coordinates
    const distanceMeters = calculateDistanceMeters(
      params.latitude,
      params.longitude,
      targetLat,
      targetLng
    );
    // Location mismatch flag if > 200 meters
    const isLocationMismatch = distanceMeters > 200;

    // Upload photo to Supabase Storage
    const { path: photoPath, url: photoUrl } = await uploadSignagePhoto(
      params.photo_file,
      params.signage_id,
      currentMonth
    );

    // Resolve uploader ID
    let uploaderId = params.uploaded_by;
    if (!uploaderId || uploaderId === 'c0000000-0000-0000-0000-000000000001') {
      try {
        if (isSupabaseConfigured()) {
          const supabase = createClient();
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user?.id) {
            uploaderId = authData.user.id;
          }
        }
      } catch (authErr) {
        console.warn('Could not retrieve current user for update:', authErr);
      }
    }
    const finalUploaderId = uploaderId || 'c0000000-0000-0000-0000-000000000001';

    if (isSupabaseConfigured()) {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('signage_updates')
        .upsert(
          {
            signage_id: params.signage_id,
            month: currentMonth,
            photo_path: photoPath,
            condition: params.condition,
            remarks: params.remarks || null,
            latitude: params.latitude,
            longitude: params.longitude,
            distance_from_site_m: distanceMeters,
            location_mismatch: isLocationMismatch,
            uploaded_by: finalUploaderId,
            uploaded_at: new Date().toISOString(),
          },
          { onConflict: 'signage_id,month' }
        )
        .select('*')
        .single();

      if (error) {
        console.error('Supabase uploadSignageUpdate error:', error);
        const errParts = [
          error.message,
          error.details,
          error.hint ? `Hint: ${error.hint}` : null,
          error.code ? `Code: ${error.code}` : null,
        ].filter(Boolean);
        throw new Error(`Failed to save inspection update: ${errParts.join(' | ') || error.message}`);
      }

      // If condition is Damaged or Missing, trigger high-priority alert to supervisors
      if (params.condition === 'Damaged' || params.condition === 'Missing') {
        const { data: supervisors } = await supabase.from('profiles').select('id').eq('role', 'supervisor');
        if (supervisors) {
          for (const sup of supervisors) {
            await supabase.from('notifications').insert({
              to_user: sup.id,
              type: 'condition_alert',
              title: `URGENT: Signage ${params.condition}`,
              message: `Signage at ${signage?.area?.name || 'Area'}, ${signage?.address || 'Site'} (${signage?.unit?.name || 'Unit'}) reported as ${params.condition}. Requires immediate repair.`,
              unit_id: signage?.unit_id || null,
              area_id: signage?.area_id || null,
            });
          }
        }
      }

      return { ...data, photo_url: photoUrl };
    }

    // Demo LocalStorage Mode
    const updates = getStored<SignageUpdate[]>(STORAGE_KEYS.UPDATES, INITIAL_UPDATES);
    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const uploader = profiles.find(p => p.id === finalUploaderId);

    const newUpdate: SignageUpdate = {
      id: crypto.randomUUID(),
      signage_id: params.signage_id,
      month: currentMonth,
      photo_path: photoPath,
      photo_url: photoUrl,
      condition: params.condition,
      remarks: params.remarks || '',
      latitude: params.latitude,
      longitude: params.longitude,
      distance_from_site_m: distanceMeters,
      location_mismatch: isLocationMismatch,
      uploaded_by: finalUploaderId,
      uploaded_at: new Date().toISOString(),
      uploader: uploader,
    };

    // Replace if update exists for this month, otherwise push
    const existingIdx = updates.findIndex(u => u.signage_id === params.signage_id && u.month === currentMonth);
    if (existingIdx >= 0) {
      updates[existingIdx] = newUpdate;
    } else {
      updates.push(newUpdate);
    }
    setStored(STORAGE_KEYS.UPDATES, updates);

    // If condition is Damaged or Missing, create notification for supervisors
    if (params.condition === 'Damaged' || params.condition === 'Missing') {
      const notifs = getStored<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
      const supervisors = profiles.filter(p => p.role === 'supervisor');
      supervisors.forEach(sup => {
        notifs.unshift({
          id: crypto.randomUUID(),
          to_user: sup.id,
          type: 'condition_alert',
          title: `URGENT: Signage ${params.condition}`,
          message: `Signage at ${signage?.area?.name || 'Area'}, ${signage?.address || 'Site'} (${signage?.unit?.name || 'Unit'}) reported as ${params.condition}. Requires immediate action.`,
          unit_id: signage?.unit_id || null,
          area_id: signage?.area_id || null,
          is_read: false,
          sent_at: new Date().toISOString(),
          unit: signage?.unit,
          area: signage?.area,
        });
      });
      setStored(STORAGE_KEYS.NOTIFICATIONS, notifs);
    }

    return newUpdate;
  },

  async getSignageUpdates(signageId: string): Promise<SignageUpdate[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      let { data, error } = await supabase
        .from('signage_updates')
        .select('*, uploader:profiles!signage_updates_uploaded_by_fkey(*)')
        .eq('signage_id', signageId)
        .order('uploaded_at', { ascending: false });

      if (error && (error.code === 'PGRST201' || error.message?.includes('more than one relationship'))) {
        const fallbackRes = await supabase
          .from('signage_updates')
          .select('*')
          .eq('signage_id', signageId)
          .order('uploaded_at', { ascending: false });
        data = fallbackRes.data;
      }

      if (!error && data) {
        const resolvedUpdates = await Promise.all(
          data.map(async (u: any) => {
            const signed = await getSignedPhotoUrl(u.photo_path);
            return {
              ...u,
              photo_url: signed || u.photo_url || u.photo_path,
            };
          })
        );
        return resolvedUpdates;
      }
    }

    const updates = getStored<SignageUpdate[]>(STORAGE_KEYS.UPDATES, INITIAL_UPDATES);
    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);

    return updates
      .filter(u => u.signage_id === signageId)
      .map(u => ({
        ...u,
        uploader: profiles.find(p => p.id === u.uploaded_by),
      }))
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  },

  // DELETE MONTHLY SIGNAGE UPDATE (Photo & Record with Audit Logging)
  async deleteSignageUpdate(
    updateId: string,
    options?: { reason?: string; deletedBy?: string }
  ): Promise<void> {
    const reason = options?.reason?.trim() || 'Deleted by user';

    if (isSupabaseConfigured()) {
      const supabase = createClient();

      // 1. Fetch update record details to log in audit and get photo path
      const { data: updateData, error: fetchErr } = await supabase
        .from('signage_updates')
        .select('*')
        .eq('id', updateId)
        .single();

      if (fetchErr || !updateData) {
        console.warn('Update not found in database or already deleted:', fetchErr);
        return;
      }

      // Resolve who is deleting
      let deletedBy = options?.deletedBy;
      if (!deletedBy) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          deletedBy = authData?.user?.id;
        } catch {
          // ignore
        }
      }

      // 2. Insert audit log into signage_deletion_audit
      try {
        await supabase.from('signage_deletion_audit').insert({
          update_id: updateId,
          signage_id: updateData.signage_id,
          month: updateData.month,
          photo_path: updateData.photo_path,
          condition: updateData.condition,
          uploaded_by: updateData.uploaded_by,
          uploaded_at: updateData.uploaded_at,
          deleted_by: deletedBy || null,
          deleted_at: new Date().toISOString(),
          deletion_reason: reason,
        });
      } catch (auditErr) {
        console.warn('Could not write to signage_deletion_audit table:', auditErr);
      }

      // 3. Remove photo file from Supabase Storage bucket
      if (updateData.photo_path) {
        await deleteSignagePhoto(updateData.photo_path);
      }

      // 4. Delete row from signage_updates
      const { error: delErr } = await supabase
        .from('signage_updates')
        .delete()
        .eq('id', updateId);

      if (delErr) {
        console.error('Supabase deleteSignageUpdate error:', delErr);
        throw new Error(`Failed to delete update: ${delErr.message}`);
      }

      return;
    }

    // Demo LocalStorage Mode
    const updates = getStored<SignageUpdate[]>(STORAGE_KEYS.UPDATES, INITIAL_UPDATES);
    const target = updates.find(u => u.id === updateId);
    if (target) {
      // Store in audit storage
      const audits = getStored<any[]>('st_deletion_audit_v1', []);
      audits.unshift({
        update_id: updateId,
        signage_id: target.signage_id,
        month: target.month,
        photo_path: target.photo_path,
        condition: target.condition,
        uploaded_by: target.uploaded_by,
        uploaded_at: target.uploaded_at,
        deleted_by: options?.deletedBy || 'current-user',
        deleted_at: new Date().toISOString(),
        deletion_reason: reason,
      });
      setStored('st_deletion_audit_v1', audits);

      // Remove from updates list
      const filtered = updates.filter(u => u.id !== updateId);
      setStored(STORAGE_KEYS.UPDATES, filtered);
    }
  },

  // ADMIN: SAVE AUDIT REMARK / FEEDBACK FOR A MONTHLY UPDATE
  async saveAdminFeedback(params: {
    update_id: string;
    signage_id: string;
    admin_remarks: string;
    admin_action_type: string;
    admin_id?: string;
    assigned_to?: string | null;
    signage_address?: string;
  }): Promise<SignageUpdate> {
    const reviewedAt = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('signage_updates')
        .update({
          admin_remarks: params.admin_remarks,
          admin_action_type: params.admin_action_type,
          admin_reviewed_at: reviewedAt,
          admin_reviewed_by: params.admin_id || null,
        })
        .eq('id', params.update_id)
        .select('*')
        .single();

      if (error) {
        console.error('Supabase saveAdminFeedback error:', error);
        throw new Error(error.message);
      }

      // Notify the assigned BD executive about the admin remark
      if (params.assigned_to) {
        try {
          await supabase.from('notifications').insert({
            to_user: params.assigned_to,
            type: 'condition_alert',
            title: `Admin Action Required: ${params.admin_action_type}`,
            message: `Admin reviewed signage at ${params.signage_address || 'site'}: "${params.admin_remarks}". Please take required action.`,
            sent_at: reviewedAt,
            is_read: false,
          });
        } catch (notifErr) {
          console.warn('Could not dispatch notification:', notifErr);
        }
      }

      return data;
    }

    // LocalStorage demo fallback
    const updates = getStored<SignageUpdate[]>(STORAGE_KEYS.UPDATES, INITIAL_UPDATES);
    const idx = updates.findIndex(u => u.id === params.update_id);
    if (idx === -1) throw new Error('Inspection update not found');
    updates[idx] = {
      ...updates[idx],
      admin_remarks: params.admin_remarks,
      admin_action_type: params.admin_action_type,
      admin_reviewed_at: reviewedAt,
      admin_reviewed_by: params.admin_id || null,
    };
    setStored(STORAGE_KEYS.UPDATES, updates);
    return updates[idx];
  },

  // SUPERVISOR: UNIT-WISE STATUS SUMMARY (Updated / Pending / Overdue)
  async getUnitStatusSummary(): Promise<{
    unit: Unit;
    total: number;
    updated: number;
    pending: number;
    overdue: number;
    complianceRate: number;
  }[]> {
    const units = await this.getUnits();
    const signages = await this.getSignages({ is_active: true });

    return units.map(unit => {
      const unitSignages = signages.filter(s => s.unit_id === unit.id);
      const total = unitSignages.length;
      const updated = unitSignages.filter(s => s.current_month_status === 'Updated').length;
      const pending = unitSignages.filter(s => s.current_month_status === 'Pending').length;
      const overdue = unitSignages.filter(s => s.current_month_status === 'Overdue').length;
      const complianceRate = total > 0 ? Math.round((updated / total) * 100) : 0;

      return {
        unit,
        total,
        updated,
        pending,
        overdue,
        complianceRate,
      };
    });
  },

  // SCHEDULED JOB: FINDS SIGNAGES NOT UPDATED IN CURRENT MONTH
  // Sends reminders to BD executives, and escalates to supervisor with unit and area name
  async runMonthlyReminderJob(): Promise<{
    remindersSent: number;
    escalationsSent: number;
    details: string[];
  }> {
    const signages = await this.getSignages({ is_active: true });
    const profiles = await this.getProfiles();
    const settings = await this.getSettings();
    const notifs = getStored<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);

    const pendingOrOverdue = signages.filter(s => s.current_month_status !== 'Updated');
    const supervisors = profiles.filter(p => p.role === 'supervisor');

    let remindersSent = 0;
    let escalationsSent = 0;
    const details: string[] = [];

    for (const s of pendingOrOverdue) {
      const unitName = s.unit?.name || 'Unit';
      const areaName = s.area?.name || 'Area';
      const bdProfile = profiles.find(p => p.id === s.assigned_to);

      // Stage 1: Send reminder to BD Executive
      if (bdProfile) {
        remindersSent++;
        const reminderMsg = `Reminder: Monthly photo inspection pending for signage at ${areaName}, ${s.address} (${unitName}). Please capture photo via camera.`;
        details.push(`[Reminder to BD: ${bdProfile.full_name}] - ${areaName}, ${unitName}`);

        if (isSupabaseConfigured()) {
          const supabase = createClient();
          await supabase.from('notifications').insert({
            to_user: bdProfile.id,
            type: 'reminder',
            title: `Monthly Inspection Reminder (${areaName})`,
            message: reminderMsg,
            unit_id: s.unit_id,
            area_id: s.area_id,
          });
        } else {
          notifs.unshift({
            id: crypto.randomUUID(),
            to_user: bdProfile.id,
            type: 'reminder',
            title: `Monthly Inspection Reminder (${areaName})`,
            message: reminderMsg,
            unit_id: s.unit_id,
            area_id: s.area_id,
            is_read: false,
            sent_at: new Date().toISOString(),
            unit: s.unit,
            area: s.area,
          });
        }
      }

      // Stage 2: Escalate to Supervisor if status is Overdue or approaching deadline
      if (s.current_month_status === 'Overdue' || new Date().getDate() >= 20) {
        for (const sup of supervisors) {
          escalationsSent++;
          const escalationMsg = `ESCALATION: Overdue signage inspection in Unit: "${unitName}", Area: "${areaName}". Address: ${s.address}. Assigned BD: ${bdProfile?.full_name || 'Unassigned'}.`;
          details.push(`[Escalation to Supervisor: ${sup.full_name}] - Unit: "${unitName}", Area: "${areaName}"`);

          if (isSupabaseConfigured()) {
            const supabase = createClient();
            await supabase.from('notifications').insert({
              to_user: sup.id,
              type: 'escalation',
              title: `Signage Escalation: ${unitName} - ${areaName}`,
              message: escalationMsg,
              unit_id: s.unit_id,
              area_id: s.area_id,
            });
          } else {
            notifs.unshift({
              id: crypto.randomUUID(),
              to_user: sup.id,
              type: 'escalation',
              title: `Signage Escalation: ${unitName} - ${areaName}`,
              message: escalationMsg,
              unit_id: s.unit_id,
              area_id: s.area_id,
              is_read: false,
              sent_at: new Date().toISOString(),
              unit: s.unit,
              area: s.area,
            });
          }
        }
      }
    }

    if (!isSupabaseConfigured()) {
      setStored(STORAGE_KEYS.NOTIFICATIONS, notifs);
    }

    return {
      remindersSent,
      escalationsSent,
      details,
    };
  },

  // EXPORT MONTHLY REPORT TO CSV
  async exportMonthlyReportCSV(unitId?: string): Promise<string> {
    const signages = await this.getSignages({ is_active: true, unit_id: unitId });
    const currentMonth = getCurrentMonthKey();

    const headers = [
      'Signage ID',
      'Hospital Unit',
      'City',
      'Area',
      'Address',
      'Signage Type',
      'Size',
      'Latitude',
      'Longitude',
      'Assigned BD Executive',
      'BD Phone',
      'Current Month Status',
      'Condition',
      'Last Inspection Date',
      'Location Mismatch (>200m)',
      'GPS Distance (meters)',
      'Photo URL',
      'Remarks',
    ];

    const rows = signages.map(s => {
      const update = s.latest_update;
      return [
        s.id,
        `"${(s.unit?.name || '').replace(/"/g, '""')}"`,
        `"${(s.unit?.city || '').replace(/"/g, '""')}"`,
        `"${(s.area?.name || '').replace(/"/g, '""')}"`,
        `"${(s.address || '').replace(/"/g, '""')}"`,
        s.type,
        s.size || 'N/A',
        s.latitude,
        s.longitude,
        `"${(s.assigned_profile?.full_name || 'Unassigned').replace(/"/g, '""')}"`,
        s.assigned_profile?.phone || 'N/A',
        s.current_month_status || 'Pending',
        update?.condition || 'Pending Inspection',
        update?.uploaded_at ? new Date(update.uploaded_at).toLocaleDateString() : 'None',
        update?.location_mismatch ? 'YES (Mismatch)' : (update ? 'NO (Matched)' : 'N/A'),
        update?.distance_from_site_m !== undefined && update?.distance_from_site_m !== null ? `${update.distance_from_site_m}m` : 'N/A',
        update?.photo_url || update?.photo_path || 'No Photo',
        `"${(update?.remarks || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  },

  // SETTINGS
  async getSettings(): Promise<AppSettings> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data: deadlineData } = await supabase.from('app_settings').select('value').eq('key', 'monthly_deadline').single();
      const { data: reminderData } = await supabase.from('app_settings').select('value').eq('key', 'reminder_days').single();
      return {
        deadline_day: deadlineData?.value?.deadline_day ?? 25,
        reminder_days: reminderData?.value?.days ?? [20, 28],
      };
    }

    return getStored<AppSettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  },

  async updateSettings(settings: AppSettings): Promise<AppSettings> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.from('app_settings').upsert({ key: 'monthly_deadline', value: { deadline_day: settings.deadline_day } });
      await supabase.from('app_settings').upsert({ key: 'reminder_days', value: { days: settings.reminder_days } });
      return settings;
    }

    setStored(STORAGE_KEYS.SETTINGS, settings);
    return settings;
  },

  // NOTIFICATIONS
  async getNotifications(userId?: string): Promise<NotificationItem[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      let query = supabase.from('notifications').select('*').order('sent_at', { ascending: false });
      if (userId) query = query.eq('to_user', userId);
      const { data, error } = await query;
      if (!error && data) return data;
    }

    const notifs = getStored<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    if (!userId) return notifs;
    return notifs.filter(n => n.to_user === userId || n.to_user === 'all');
  },

  async markNotificationRead(id: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      return;
    }

    const notifs = getStored<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    const updated = notifs.map(n => n.id === id ? { ...n, is_read: true } : n);
    setStored(STORAGE_KEYS.NOTIFICATIONS, updated);
  },

  // TRAVEL REQUESTS (Unit Head Approvals & Mileage Verification)
  async getTravelRequests(params?: {
    unit_id?: string;
    bd_executive_id?: string;
    status?: TravelRequestStatus;
  }): Promise<TravelRequest[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      try {
        let query = supabase
          .from('travel_requests')
          .select(`
            *,
            bd_executive:profiles!travel_requests_bd_executive_id_fkey(*),
            unit:units(*),
            reviewer:profiles!travel_requests_reviewed_by_fkey(*),
            stops:travel_request_stops(*)
          `)
          .order('created_at', { ascending: false });

        if (params?.unit_id) query = query.eq('unit_id', params.unit_id);
        if (params?.bd_executive_id) query = query.eq('bd_executive_id', params.bd_executive_id);
        if (params?.status) query = query.eq('status', params.status);

        const { data, error } = await query;
        if (!error && data) return data as TravelRequest[];

        // Fallback without explicit fkey alias if table was created with standard names
        let simpleQuery = supabase.from('travel_requests').select('*').order('created_at', { ascending: false });
        if (params?.unit_id) simpleQuery = simpleQuery.eq('unit_id', params.unit_id);
        if (params?.bd_executive_id) simpleQuery = simpleQuery.eq('bd_executive_id', params.bd_executive_id);
        if (params?.status) simpleQuery = simpleQuery.eq('status', params.status);

        const fallbackRes = await simpleQuery;
        if (!fallbackRes.error && fallbackRes.data) {
          const profiles = await this.getProfiles();
          const units = await this.getUnits();
          return fallbackRes.data.map((tr: any) => ({
            ...tr,
            bd_executive: profiles.find(p => p.id === tr.bd_executive_id) || null,
            unit: units.find(u => u.id === tr.unit_id) || null,
            reviewer: tr.reviewed_by ? profiles.find(p => p.id === tr.reviewed_by) || null : null,
          }));
        }
      } catch (err) {
        console.warn('Supabase getTravelRequests failed, checking local storage:', err);
      }
    }

    const requests = getStored<TravelRequest[]>(STORAGE_KEYS.TRAVEL_REQUESTS, []);
    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);

    let filtered = requests;
    if (params?.unit_id) filtered = filtered.filter(r => r.unit_id === params.unit_id);
    if (params?.bd_executive_id) filtered = filtered.filter(r => r.bd_executive_id === params.bd_executive_id);
    if (params?.status) filtered = filtered.filter(r => r.status === params.status);

    return filtered.map(r => ({
      ...r,
      bd_executive: profiles.find(p => p.id === r.bd_executive_id) || null,
      unit: units.find(u => u.id === r.unit_id) || null,
      reviewer: r.reviewed_by ? profiles.find(p => p.id === r.reviewed_by) || null : null,
    }));
  },

  async updateTravelRequestStatus(params: {
    requestId: string;
    status: TravelRequestStatus;
    reviewedBy: string;
    reviewComment?: string;
  }): Promise<TravelRequest> {
    const updatePayload = {
      status: params.status,
      reviewed_by: params.reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_comment: params.reviewComment || null,
    };

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('travel_requests')
        .update(updatePayload)
        .eq('id', params.requestId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update travel request: ${error.message}`);
      }

      // Notify BD Executive via Resend & in-app
      try {
        fetch('/api/travel-requests/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reviewed', requestId: params.requestId }),
        }).catch(e => console.warn('Review notification trigger error:', e));
      } catch (notifyErr) {
        console.warn('Could not trigger review notification API:', notifyErr);
      }

      return data as TravelRequest;
    }

    const requests = getStored<TravelRequest[]>(STORAGE_KEYS.TRAVEL_REQUESTS, []);
    const idx = requests.findIndex(r => r.id === params.requestId);
    if (idx === -1) throw new Error('Travel request not found');

    requests[idx] = {
      ...requests[idx],
      ...updatePayload,
    };
    setStored(STORAGE_KEYS.TRAVEL_REQUESTS, requests);
    return requests[idx];
  },

  async submitTravelRequest(data: {
    bd_executive_id: string;
    unit_id: string;
    month: string;
    total_distance_km: number;
    start_location?: string | null;
    is_round_trip?: boolean;
    travel_purpose?: string | null;
    stops: Array<{
      signage_id: string;
      signage_update_id?: string | null;
      latitude: number;
      longitude: number;
      visited_at?: string;
      distance_from_previous_km: number;
    }>;
  }): Promise<TravelRequest> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();

      // Check for existing request for this month
      const { data: existing } = await supabase
        .from('travel_requests')
        .select('id, status')
        .eq('bd_executive_id', data.bd_executive_id)
        .eq('month', data.month)
        .maybeSingle();

      if (existing && existing.status !== 'rejected') {
        throw new Error(`A travel request for ${data.month} has already been submitted (Status: ${existing.status.toUpperCase()}). Only one pending or approved request per month is allowed.`);
      }

      let request: any = null;

      if (existing && existing.status === 'rejected') {
        // Re-submit / update existing rejected request to pending
        const { data: updated, error: upErr } = await supabase
          .from('travel_requests')
          .update({
            total_distance_km: data.total_distance_km,
            start_location: data.start_location || 'Hospital Base Office',
            is_round_trip: data.is_round_trip ?? false,
            travel_purpose: data.travel_purpose || null,
            status: 'pending',
            submitted_at: new Date().toISOString(),
            reviewed_by: null,
            reviewed_at: null,
            review_comment: null,
          })
          .eq('id', existing.id)
          .select('*')
          .single();

        if (upErr) throw new Error(`Failed to update travel request: ${upErr.message}`);
        request = updated;

        // Clear old stops to replace with updated route
        await supabase
          .from('travel_request_stops')
          .delete()
          .eq('travel_request_id', existing.id);
      } else {
        const { data: created, error: reqErr } = await supabase
          .from('travel_requests')
          .insert({
            bd_executive_id: data.bd_executive_id,
            unit_id: data.unit_id,
            month: data.month,
            total_distance_km: data.total_distance_km,
            start_location: data.start_location || 'Hospital Base Office',
            is_round_trip: data.is_round_trip ?? false,
            travel_purpose: data.travel_purpose || null,
            status: 'pending',
            submitted_at: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (reqErr) throw new Error(`Failed to create travel request: ${reqErr.message}`);
        request = created;
      }

      if (data.stops.length > 0) {
        const stopsPayload = data.stops.map(s => ({
          travel_request_id: request.id,
          signage_id: s.signage_id,
          signage_update_id: s.signage_update_id || null,
          latitude: s.latitude,
          longitude: s.longitude,
          visited_at: s.visited_at || new Date().toISOString(),
          distance_from_previous_km: s.distance_from_previous_km || 0,
        }));

        const { error: stopsErr } = await supabase
          .from('travel_request_stops')
          .insert(stopsPayload);

        if (stopsErr) console.warn('Warning inserting travel request stops:', stopsErr);
      }

      // Trigger Email & In-App Notification via Resend to Unit Head
      try {
        fetch('/api/travel-requests/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'submitted', requestId: request.id }),
        }).catch(e => console.warn('Submission notification trigger error:', e));
      } catch (notifyErr) {
        console.warn('Could not trigger submission notification API:', notifyErr);
      }

      return request as TravelRequest;
    }

    const requests = getStored<TravelRequest[]>(STORAGE_KEYS.TRAVEL_REQUESTS, []);
    const existingIdx = requests.findIndex(r => r.bd_executive_id === data.bd_executive_id && r.month === data.month);

    if (existingIdx !== -1 && requests[existingIdx].status !== 'rejected') {
      throw new Error(`A travel request for ${data.month} has already been submitted (Status: ${requests[existingIdx].status.toUpperCase()}). Only one pending or approved request per month is allowed.`);
    }

    if (existingIdx !== -1 && requests[existingIdx].status === 'rejected') {
      requests[existingIdx] = {
        ...requests[existingIdx],
        total_distance_km: data.total_distance_km,
        start_location: data.start_location || 'Hospital Base Office',
        is_round_trip: data.is_round_trip ?? false,
        travel_purpose: data.travel_purpose || null,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        reviewed_by: null,
        reviewed_at: null,
        review_comment: null,
      };
      setStored(STORAGE_KEYS.TRAVEL_REQUESTS, requests);
      return requests[existingIdx];
    }

    const newReq: TravelRequest = {
      id: crypto.randomUUID(),
      bd_executive_id: data.bd_executive_id,
      unit_id: data.unit_id,
      month: data.month,
      total_distance_km: data.total_distance_km,
      start_location: data.start_location || 'Hospital Base Office',
      is_round_trip: data.is_round_trip ?? false,
      travel_purpose: data.travel_purpose || null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    requests.unshift(newReq);
    setStored(STORAGE_KEYS.TRAVEL_REQUESTS, requests);
    return newReq;
  },

  // BD EXECUTIVE: MONTHLY VISITS & TRAVEL DISTANCE SUMMARY
  async getMonthlyTravelSummary(
    executiveId: string,
    monthKey: string = getCurrentMonthKey(),
    options?: { isRoundTrip?: boolean; startLocation?: string }
  ): Promise<MonthlyTravelSummary> {
    let rawVisits: any[] = [];
    let existingRequest: TravelRequest | null = null;
    let pastRequests: TravelRequest[] = [];
    let userUnit: any = null;

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      try {
        // Fetch executive's assigned unit
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, unit_id, unit:units(*)')
          .eq('id', executiveId)
          .maybeSingle();

        if (profileData?.unit) {
          userUnit = profileData.unit;
        }

        // 1. Fetch current month updates uploaded by this executive
        const { data: updates, error: updateErr } = await supabase
          .from('signage_updates')
          .select('*, signage:signages(*, area:areas(*), unit:units(*))')
          .eq('month', monthKey)
          .eq('uploaded_by', executiveId)
          .order('uploaded_at', { ascending: true });

        if (!updateErr && updates) {
          rawVisits = updates;
        }

        // Fallback: check updates for signages assigned to this executive
        if (rawVisits.length === 0) {
          const { data: mySignages } = await supabase
            .from('signages')
            .select('id, address, type, area:areas(*), unit:units(*)')
            .eq('assigned_to', executiveId);

          if (mySignages && mySignages.length > 0) {
            const signageIds = mySignages.map(s => s.id);
            const { data: fallbackUpdates } = await supabase
              .from('signage_updates')
              .select('*')
              .eq('month', monthKey)
              .in('signage_id', signageIds)
              .order('uploaded_at', { ascending: true });

            if (fallbackUpdates) {
              rawVisits = fallbackUpdates.map(u => ({
                ...u,
                signage: mySignages.find(s => s.id === u.signage_id),
              }));
            }
          }
        }

        // 2. Fetch travel requests for this executive
        const { data: reqs } = await supabase
          .from('travel_requests')
          .select('*, reviewer:profiles!travel_requests_reviewed_by_fkey(*), unit:units(*), stops:travel_request_stops(*)')
          .eq('bd_executive_id', executiveId)
          .order('month', { ascending: false });

        if (reqs) {
          pastRequests = reqs as TravelRequest[];
          existingRequest = pastRequests.find(r => r.month === monthKey) || null;
        } else {
          // Simple query fallback
          const { data: simpleReqs } = await supabase
            .from('travel_requests')
            .select('*')
            .eq('bd_executive_id', executiveId)
            .order('month', { ascending: false });
          if (simpleReqs) {
            pastRequests = simpleReqs as TravelRequest[];
            existingRequest = pastRequests.find(r => r.month === monthKey) || null;
          }
        }
      } catch (err) {
        console.warn('Error fetching monthly travel data from Supabase:', err);
      }
    } else {
      // LocalStorage Demo Mode
      const updates = getStored<SignageUpdate[]>(STORAGE_KEYS.UPDATES, INITIAL_UPDATES);
      const signages = getStored<Signage[]>(STORAGE_KEYS.SIGNAGES, INITIAL_SIGNAGES);
      const areas = getStored<Area[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
      const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
      const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);

      const userProfile = profiles.find(p => p.id === executiveId);
      userUnit = userProfile?.unit || units.find(u => u.id === userProfile?.unit_id) || null;

      rawVisits = updates
        .filter(u => u.month === monthKey && (u.uploaded_by === executiveId || signages.some(s => s.id === u.signage_id && s.assigned_to === executiveId)))
        .map(u => {
          const s = signages.find(sig => sig.id === u.signage_id);
          return {
            ...u,
            signage: s ? {
              ...s,
              area: areas.find(a => a.id === s.area_id),
              unit: units.find(unit => unit.id === s.unit_id),
            } : null,
          };
        });

      const allRequests = getStored<TravelRequest[]>(STORAGE_KEYS.TRAVEL_REQUESTS, []);
      pastRequests = allRequests.filter(r => r.bd_executive_id === executiveId);
      existingRequest = pastRequests.find(r => r.month === monthKey) || null;
    }

    // Determine base hospital office coordinates
    const baseLocation = getUnitBaseCoordinates(userUnit || rawVisits[0]?.signage?.unit || null);

    // Sort visits by uploaded_at ascending
    rawVisits.sort((a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime());

    // Default round-trip to true (travel from hospital to hoarding and return to hospital)
    const isRoundTrip = options?.isRoundTrip ?? existingRequest?.is_round_trip ?? true;

    // Calculate direct Hospital to Hoarding distance for each visited signage
    let totalKmSum = 0;
    const stops: ExecutiveVisitStop[] = await Promise.all(
      rawVisits.map(async (v, index) => {
        const signageCode = getSignageCode(v.signage, index + 1);

        // Calculate distance directly from Hospital Base Office to this hoarding
        const distMeters = calculateDistanceMeters(
          baseLocation.latitude,
          baseLocation.longitude,
          v.latitude,
          v.longitude
        );
        const distFromHospitalKm = Number((distMeters / 1000).toFixed(1));
        const roundTripKm = Number((distFromHospitalKm * 2).toFixed(1));
        const activeTripKm = isRoundTrip ? roundTripKm : distFromHospitalKm;
        totalKmSum += activeTripKm;

        let photoUrl = v.photo_url;
        if (!photoUrl && v.photo_path) {
          photoUrl = await getSignedPhotoUrl(v.photo_path);
        }

        const directGmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${baseLocation.latitude},${baseLocation.longitude}&destination=${v.latitude},${v.longitude}&travelmode=driving`;

        return {
          signage_id: v.signage_id,
          signage_code: signageCode,
          signage_update_id: v.id,
          signage_address: v.signage?.address || 'Signage Site',
          signage_area_name: v.signage?.area?.name || '',
          signage_unit_name: v.signage?.unit?.name || '',
          signage_type: v.signage?.type || 'Outdoor Signage',
          condition: v.condition,
          photo_url: photoUrl || v.photo_path,
          latitude: v.latitude,
          longitude: v.longitude,
          visited_at: v.uploaded_at,
          distance_from_hospital_km: distFromHospitalKm,
          round_trip_distance_km: roundTripKm,
          distance_from_previous_km: activeTripKm,
          google_maps_directions_url: directGmapsUrl,
        };
      })
    );

    const totalKm = Number(totalKmSum.toFixed(1));

    const googleMapsUrl = buildGoogleMapsDirectionsUrl({
      originLat: baseLocation.latitude,
      originLng: baseLocation.longitude,
      originName: baseLocation.name,
      stops: stops.map(s => ({ lat: s.latitude, lng: s.longitude, label: `${s.signage_code}: ${s.signage_address}` })),
      isRoundTrip,
    });

    return {
      month: monthKey,
      total_distance_km: totalKm,
      stops_count: stops.length,
      stops,
      origin: baseLocation,
      google_maps_url: googleMapsUrl,
      is_round_trip: isRoundTrip,
      existing_request: existingRequest,
      past_requests: pastRequests,
    };
  },

  // INSPECTION AUDIT LOGS (Long format: one row per monthly inspection)
  async getInspectionAuditLogs(params?: {
    unit_id?: string;
    area_id?: string;
    month_from?: string;
    month_to?: string;
    condition?: string;
    search?: string;
  }): Promise<InspectionAuditLogItem[]> {
    if (isSupabaseConfigured()) {
      const supabase = createClient();

      // 1. Fetch signages with unit and area
      let sQuery = supabase
        .from('signages')
        .select('id, code, name, address, latitude, longitude, unit_id, area_id, unit:units(id, name, city), area:areas(id, name)')
        .order('id', { ascending: true });

      if (params?.unit_id) {
        sQuery = sQuery.eq('unit_id', params.unit_id);
      }
      if (params?.area_id) {
        sQuery = sQuery.eq('area_id', params.area_id);
      }

      const { data: signagesData, error: sErr } = await sQuery;
      if (sErr) console.warn('Supabase signages fetch error for audit logs:', sErr);

      const signagesMap = new Map<string, any>();
      (signagesData || []).forEach((s: any, idx: number) => {
        const code = s.code && s.code.trim() ? s.code.trim().toUpperCase() : getSignageCode(s, idx + 1);
        signagesMap.set(s.id, { ...s, calculated_code: code });
      });

      // If unit_id or area_id was specified and no signages match, return empty
      if ((params?.unit_id || params?.area_id) && signagesMap.size === 0) {
        return [];
      }

      // 2. Fetch updates
      let uQuery = supabase
        .from('signage_updates')
        .select('*, uploader:profiles!signage_updates_uploaded_by_fkey(id, full_name, email)');

      if (params?.month_from) {
        const fromVal = params.month_from.length === 7 ? `${params.month_from}-01` : params.month_from;
        uQuery = uQuery.gte('month', fromVal);
      }
      if (params?.month_to) {
        const toVal = params.month_to.length === 7 ? `${params.month_to}-01` : params.month_to;
        uQuery = uQuery.lte('month', toVal);
      }
      if (params?.condition && params.condition !== 'all' && params.condition !== 'All') {
        uQuery = uQuery.eq('condition', params.condition);
      }

      let { data: updatesData, error: uErr } = await uQuery;
      if (uErr && (uErr.code === 'PGRST201' || uErr.message?.includes('more than one relationship'))) {
        let fallbackQ = supabase.from('signage_updates').select('*');
        if (params?.month_from) {
          const fromVal = params.month_from.length === 7 ? `${params.month_from}-01` : params.month_from;
          fallbackQ = fallbackQ.gte('month', fromVal);
        }
        if (params?.month_to) {
          const toVal = params.month_to.length === 7 ? `${params.month_to}-01` : params.month_to;
          fallbackQ = fallbackQ.lte('month', toVal);
        }
        if (params?.condition && params.condition !== 'all' && params.condition !== 'All') {
          fallbackQ = fallbackQ.eq('condition', params.condition);
        }
        const fallbackRes = await fallbackQ;
        updatesData = fallbackRes.data;
      }

      const profiles = await this.getProfiles();
      const profilesMap = new Map<string, Profile>(profiles.map(p => [p.id, p]));

      const results: InspectionAuditLogItem[] = [];

      for (const update of (updatesData || [])) {
        const signage = signagesMap.get(update.signage_id);
        if (!signage) continue; // Signage didn't match unit/area filter

        const uploaderProfile = update.uploader || profilesMap.get(update.uploaded_by);
        const inspectedBy = uploaderProfile?.full_name || uploaderProfile?.email || 'Field BD';

        let photoUrl = update.photo_url;
        if (!photoUrl && update.photo_path) {
          photoUrl = await getSignedPhotoUrl(update.photo_path);
        }

        const item: InspectionAuditLogItem = {
          id: update.id,
          signage_id: signage.id,
          signage_code: signage.calculated_code || getSignageCode(signage),
          unit_id: signage.unit_id || signage.unit?.id || '',
          unit_name: signage.unit?.name || 'Assigned Unit',
          unit_city: signage.unit?.city || '',
          area_id: signage.area_id || signage.area?.id || '',
          area_name: signage.area?.name || 'Area',
          address: signage.address || '',
          month: update.month,
          month_formatted: formatAuditMonth(update.month),
          latitude: Number(update.latitude) || 0,
          longitude: Number(update.longitude) || 0,
          condition: update.condition || 'Good',
          distance_from_site_m: typeof update.distance_from_site_m === 'number' ? update.distance_from_site_m : 0,
          location_mismatch: !!update.location_mismatch,
          uploaded_by_id: update.uploaded_by,
          inspected_by_name: inspectedBy,
          photo_url: photoUrl || update.photo_path || null,
          photo_path: update.photo_path || null,
          uploaded_at: update.uploaded_at,
          remarks: update.remarks || null,
        };

        // If search query is provided
        if (params?.search && params.search.trim()) {
          const q = params.search.toLowerCase().trim();
          const matches =
            item.signage_code.toLowerCase().includes(q) ||
            item.unit_name.toLowerCase().includes(q) ||
            item.area_name.toLowerCase().includes(q) ||
            item.address.toLowerCase().includes(q) ||
            item.inspected_by_name.toLowerCase().includes(q) ||
            item.month_formatted.toLowerCase().includes(q);
          if (!matches) continue;
        }

        results.push(item);
      }

      // Sort by Signage Code, then by Month (oldest to newest)
      results.sort((a, b) => {
        const codeCmp = a.signage_code.localeCompare(b.signage_code, undefined, { numeric: true, sensitivity: 'base' });
        if (codeCmp !== 0) return codeCmp;
        return a.month.localeCompare(b.month);
      });

      return results;
    }

    // LocalStorage fallback for demo mode
    const updates = getStored<SignageUpdate[]>(STORAGE_KEYS.UPDATES, INITIAL_UPDATES);
    const signages = getStored<Signage[]>(STORAGE_KEYS.SIGNAGES, INITIAL_SIGNAGES);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const areas = getStored<Area[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);

    const unitsMap = new Map(units.map(u => [u.id, u]));
    const areasMap = new Map(areas.map(a => [a.id, a]));
    const profilesMap = new Map(profiles.map(p => [p.id, p]));

    const signagesMap = new Map<string, any>();
    signages.forEach((s, idx) => {
      const u = s.unit_id ? unitsMap.get(s.unit_id) : s.unit;
      const a = s.area_id ? areasMap.get(s.area_id) : s.area;
      const withJoins = { ...s, unit: u, area: a };
      const code = s.code && s.code.trim() ? s.code.trim().toUpperCase() : getSignageCode(withJoins, idx + 1);
      signagesMap.set(s.id, { ...withJoins, calculated_code: code });
    });

    const results: InspectionAuditLogItem[] = [];

    for (const update of updates) {
      const signage = signagesMap.get(update.signage_id);
      if (!signage) continue;

      if (params?.unit_id && signage.unit_id !== params.unit_id) continue;
      if (params?.area_id && signage.area_id !== params.area_id) continue;
      if (params?.condition && params.condition !== 'all' && params.condition !== 'All' && update.condition !== params.condition) continue;
      if (params?.month_from) {
        const fromVal = params.month_from.length === 7 ? `${params.month_from}-01` : params.month_from;
        if (update.month < fromVal) continue;
      }
      if (params?.month_to) {
        const toVal = params.month_to.length === 7 ? `${params.month_to}-01` : params.month_to;
        if (update.month > toVal) continue;
      }

      const prof = profilesMap.get(update.uploaded_by);
      const inspectedBy = prof?.full_name || prof?.email || 'Field BD';

      const item: InspectionAuditLogItem = {
        id: update.id,
        signage_id: signage.id,
        signage_code: signage.calculated_code || getSignageCode(signage),
        unit_id: signage.unit_id || '',
        unit_name: signage.unit?.name || 'Assigned Unit',
        unit_city: signage.unit?.city || '',
        area_id: signage.area_id || '',
        area_name: signage.area?.name || 'Area',
        address: signage.address || '',
        month: update.month,
        month_formatted: formatAuditMonth(update.month),
        latitude: update.latitude,
        longitude: update.longitude,
        condition: update.condition || 'Good',
        distance_from_site_m: update.distance_from_site_m || 0,
        location_mismatch: !!update.location_mismatch,
        uploaded_by_id: update.uploaded_by,
        inspected_by_name: inspectedBy,
        photo_url: update.photo_url || update.photo_path || null,
        photo_path: update.photo_path || null,
        uploaded_at: update.uploaded_at,
        remarks: update.remarks || null,
      };

      if (params?.search && params.search.trim()) {
        const q = params.search.toLowerCase().trim();
        const matches =
          item.signage_code.toLowerCase().includes(q) ||
          item.unit_name.toLowerCase().includes(q) ||
          item.area_name.toLowerCase().includes(q) ||
          item.address.toLowerCase().includes(q) ||
          item.inspected_by_name.toLowerCase().includes(q) ||
          item.month_formatted.toLowerCase().includes(q);
        if (!matches) continue;
      }

      results.push(item);
    }

    // Sort by Signage Code, then by Month (oldest to newest)
    results.sort((a, b) => {
      const codeCmp = a.signage_code.localeCompare(b.signage_code, undefined, { numeric: true, sensitivity: 'base' });
      if (codeCmp !== 0) return codeCmp;
      return a.month.localeCompare(b.month);
    });

    return results;
  },
};