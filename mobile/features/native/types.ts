/**
 * Sprint 9 Phase 4 — shared native capability types.
 */

export type PermissionKind =
  | 'camera'
  | 'photos'
  | 'location'
  | 'locationBackground'
  | 'notifications'
  | 'biometrics'
  | 'storage';

export type PermissionStatusValue =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'blocked'
  | 'unavailable';

export type PermissionSnapshot = {
  kind: PermissionKind;
  status: PermissionStatusValue;
  canAskAgain: boolean;
  updatedAt: number;
};

export type PushCategory =
  | 'booking_updates'
  | 'provider_job_updates'
  | 'messages'
  | 'ai_recommendations'
  | 'business_assistant_briefings'
  | 'promotions'
  | 'system'
  | 'silent';

export type PushPreferenceMap = Record<PushCategory, boolean>;

export type NativeNotification = {
  id: string;
  category: PushCategory;
  title: string;
  body: string;
  deepLink?: string;
  silent?: boolean;
  data?: Record<string, unknown>;
  receivedAt: number;
  read: boolean;
};

export type MediaPurpose =
  | 'profile'
  | 'business_gallery'
  | 'job_before'
  | 'job_after'
  | 'verification'
  | 'booking_attachment'
  | 'invoice'
  | 'document';

export type NativeMediaAsset = {
  id: string;
  uri: string;
  mimeType?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  purpose: MediaPurpose;
  compressed: boolean;
  createdAt: number;
};

export type OfflineMediaUpload = {
  id: string;
  asset: NativeMediaAsset;
  remotePath: string;
  status: 'queued' | 'uploading' | 'retrying' | 'success' | 'failed' | 'conflict';
  progress: number;
  attempts: number;
  lastError?: string;
  conflictRemoteUri?: string;
  createdAt: number;
  updatedAt: number;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
};

export type LocationAccuracyLevel = 'lowest' | 'balanced' | 'high' | 'best';

export type MapMarker = {
  id: string;
  coordinate: { latitude: number; longitude: number };
  title?: string;
  subtitle?: string;
  kind?: 'customer' | 'provider' | 'booking' | 'coverage';
};

export type TravelEstimate = {
  distanceMeters: number;
  durationSeconds: number;
  provider: 'haversine_estimate';
};

export type SharePayloadKind =
  | 'provider_profile'
  | 'booking_details'
  | 'invoice'
  | 'promotion'
  | 'referral';

export type DeviceFeaturePrep =
  | 'calendar'
  | 'contacts'
  | 'widgets'
  | 'live_activities'
  | 'android_shortcuts'
  | 'quick_actions'
  | 'background_tasks';
