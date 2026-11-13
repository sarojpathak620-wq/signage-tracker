export type UserRole = 'admin' | 'bd_executive' | 'supervisor';

export type SignageType = 'Hoarding' | 'Wall Paint' | 'Poster' | 'Board' | 'Flex' | 'Other';

export type SignageCondition = 'Good' | 'Needs Repair' | 'Damaged' | 'Missing';

export type SignageStatus = 'Updated' | 'Pending' | 'Overdue';

export interface Unit {
  id: string;
  name: string;
  city: string;
  created_at?: string;
  _count?: {
    areas?: number;
    signages?: number;
  };
}

export interface Area {
  id: string;
  unit_id: string;
  name: string;
  created_at?: string;
  unit?: Unit;
  _count?: {
    signages?: number;
  };
}

export interface Profile {
  id: string;
  email?: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  unit_id?: string | null;
  unit?: Unit | null;
  created_at?: string;
}

export interface Signage {
  id: string;
  unit_id: string;
  area_id: string;
  address: string;
  latitude: number;
  longitude: number;
  type: SignageType;
  size?: string | null;
  installed_date?: string | null;
  assigned_to?: string | null;
  is_active: boolean;
  created_at?: string;
  unit?: Unit;
  area?: Area;
  assigned_profile?: Profile | null;
  latest_update?: SignageUpdate | null;
  current_month_status?: SignageStatus;
}

export interface SignageUpdate {
  id: string;
  signage_id: string;
  month: string; // 'YYYY-MM-01'
  photo_path: string;
  photo_url?: string;
  condition: SignageCondition;
  remarks?: string | null;
  latitude: number;
  longitude: number;
  distance_from_site_m?: number | null;
  location_mismatch: boolean;
  uploaded_by: string;
  uploaded_at: string;
  uploader?: Profile;
}

export interface NotificationItem {
  id: string;
  to_user: string;
  type: 'reminder' | 'escalation' | 'condition_alert';
  title: string;
  message: string;
  unit_id?: string | null;
  area_id?: string | null;
  is_read: boolean;
  sent_at: string;
  unit?: Unit;
  area?: Area;
}

export interface AppSettings {
  deadline_day: number;
  reminder_days: number[];
}

export interface SignageStatusView {
  signage_id: string;
  unit_id: string;
  unit_name: string;
  unit_city: string;
  area_id: string;
  area_name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: SignageType;
  size?: string;
  installed_date?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_to_phone?: string;
  is_active: boolean;
  created_at: string;
  update_id?: string;
  photo_path?: string;
  photo_url?: string;
  condition?: SignageCondition;
  remarks?: string;
  uploaded_at?: string;
  location_mismatch?: boolean;
  distance_from_site_m?: number;
  status: SignageStatus;
  last_condition: SignageCondition;
}
