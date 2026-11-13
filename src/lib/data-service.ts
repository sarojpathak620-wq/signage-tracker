'use client';

import {
  Unit, Area, Profile, Signage, SignageUpdate,
  AppSettings, NotificationItem, SignageStatusView, SignageType, SignageCondition, SignageStatus
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

// Helper to get current month first-day string: 'YYYY-MM-01'
export function getCurrentMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
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
        const { data: updatesData } = await supabase
          .from('signage_updates')
          .select('*, uploader:profiles(*)')
          .order('uploaded_at', { ascending: false });

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

      const { data: newSignage, error } = await supabase
        .from('signages')
        .insert({
          unit_id: data.unit_id,
          area_id: data.area_id,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          type: data.type,
          size: data.size || null,
          assigned_to: assignedTo || null,
          is_active: true,
        })
        .select('*, unit:units(*), area:areas(*), assigned_profile:profiles(*)')
        .single();

      if (error) {
        console.error('Supabase createSignage error:', error);
        const errParts = [
          error.message,
          error.details,
          error.hint ? `Hint: ${error.hint}` : null,
          error.code ? `Code: ${error.code}` : null,
        ].filter(Boolean);
        throw new Error(errParts.join(' | ') || error.message);
      }
      return newSignage;
    }

    const signages = getStored<Signage[]>(STORAGE_KEYS.SIGNAGES, INITIAL_SIGNAGES);
    const units = getStored<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const areas = getStored<Area[]>(STORAGE_KEYS.AREAS, INITIAL_AREAS);
    const profiles = getStored<Profile[]>(STORAGE_KEYS.PROFILES, INITIAL_PROFILES);

    const newSignage: Signage = {
      id: crypto.randomUUID(),
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
        .select('*, uploader:profiles(*)')
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
      const { data, error } = await supabase
        .from('signage_updates')
        .select('*, uploader:profiles(*)')
        .eq('signage_id', signageId)
        .order('uploaded_at', { ascending: false });

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
  async exportMonthlyReportCSV(): Promise<string> {
    const signages = await this.getSignages({ is_active: true });
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
};