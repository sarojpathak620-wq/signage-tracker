export type UserRole = 'admin' | 'bd_executive' | 'supervisor';

export type SignageType = 'Hoarding' | 'Wall Paint' | 'Poster' | 'Board' | 'Flex' | 'Other';

export type SignageCondition = 'Good' | 'Needs Repair' | 'Damaged' | 'Missing';

export type SignageStatus = 'Updated' | 'Pending' | 'Overdue';

export interface Unit {
  id: string;
  name: string;
  city: string;
  address?: string;
  latitude?: number;
  longitude?: number;
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
  code?: string | null;
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
  admin_remarks?: string | null;
  admin_action_type?: string | null;
  admin_reviewed_at?: string | null;
  admin_reviewed_by?: string | null;
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

export interface SignageDeletionAudit {
  id?: string;
  update_id?: string;
  signage_id: string;
  month: string;
  photo_path?: string | null;
  condition?: SignageCondition;
  uploaded_by?: string;
  uploaded_at?: string;
  deleted_by?: string;
  deleted_at?: string;
  deletion_reason: string;
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

export type TravelRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TravelRequest {
  id: string;
  bd_executive_id: string;
  unit_id: string;
  month: string; // 'YYYY-MM-01'
  total_distance_km: number;
  status: TravelRequestStatus;
  submitted_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_comment?: string | null;
  created_at: string;
  bd_executive?: Profile | null;
  unit?: Unit | null;
  reviewer?: Profile | null;
  stops?: TravelRequestStop[];
  start_location?: string | null;
  is_round_trip?: boolean;
  travel_purpose?: string | null;
}

export interface TravelRequestStop {
  id: string;
  travel_request_id: string;
  signage_id: string;
  signage_update_id?: string | null;
  latitude: number;
  longitude: number;
  visited_at: string;
  distance_from_previous_km: number;
  signage?: Signage | null;
  signage_update?: SignageUpdate | null;
}

export interface ExecutiveVisitStop {
  signage_id: string;
  signage_code: string;
  signage_update_id?: string | null;
  signage_address: string;
  signage_area_name?: string;
  signage_unit_name?: string;
  signage_type: string;
  condition: SignageCondition;
  photo_url?: string | null;
  latitude: number;
  longitude: number;
  visited_at: string;
  distance_from_hospital_km: number;
  round_trip_distance_km: number;
  distance_from_previous_km: number;
  google_maps_directions_url: string;
}

export interface MonthlyTravelSummary {
  month: string;
  total_distance_km: number;
  stops_count: number;
  stops: ExecutiveVisitStop[];
  origin?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  google_maps_url?: string;
  is_round_trip?: boolean;
  existing_request?: TravelRequest | null;
  past_requests?: TravelRequest[];
}
