import { logEvent } from '@/lib/observability';

export function trackNative(
  name:
    | 'notification_delivery'
    | 'permission_change'
    | 'camera_usage'
    | 'location_accuracy'
    | 'upload_success'
    | 'upload_failure'
    | 'offline_sync'
    | 'background_task'
    | 'biometric_session'
    | 'map_interaction'
    | 'share_action'
    | 'file_action'
    | 'navigation_open',
  payload: Record<string, unknown> = {},
): void {
  logEvent(`native_${name}`, payload);
}
