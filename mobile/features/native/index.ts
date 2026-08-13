/**
 * Sprint 9 Phase 4 — Native mobile capabilities (public API).
 */

export * from './types';
export * from './permissions';
export * from './observability';

export * from './push/preferences';
export * from './push/history';
export * from './push/deep-links';
export {
  registerForPushNotifications,
  attachPushListeners,
  scheduleLocalNotification,
  handleIncomingNotification,
  type PushRegistration,
} from './push/service';

export * from './camera/service';
export * from './media/compress';
export * from './media/picker';
export * from './location/service';
export * from './maps/utils';
export * from './navigation/open-maps';
export * from './biometrics/service';
export * from './files/service';
export * from './offline-media/queue';
export * from './share/service';
export * from './device/prep';
export * from './security/media-security';
export * from './performance/cache';

export { PermissionGate } from './components/PermissionGate';
export { MediaPreviewList } from './components/MediaPreviewList';
export { NativeMapView } from './components/NativeMapView';
