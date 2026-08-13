/**
 * Capability registry — Sprint 9 Phase 4 marks native modules ready.
 */

export const futureCapabilities = {
  pushNotifications: { ready: true, module: 'features/native/push' },
  camera: { ready: true, module: 'features/native/camera' },
  location: { ready: true, module: 'features/native/location' },
  maps: { ready: true, module: 'features/native/maps' },
  liveTracking: { ready: false, module: 'services/tracking' },
  payments: { ready: false, module: 'services/payments' },
  voice: { ready: false, module: 'expo-av' },
  aiAssistant: { ready: true, module: 'features/provider' },
  backgroundTasks: { ready: false, module: 'features/native/device' },
  widgets: { ready: false, module: 'features/native/device' },
  wearables: { ready: false, module: 'wearables-bridge' },
  biometrics: { ready: true, module: 'features/native/biometrics' },
  offlineMedia: { ready: true, module: 'features/native/offline-media' },
  imagePicker: { ready: true, module: 'features/native/media' },
  files: { ready: true, module: 'features/native/files' },
  sharing: { ready: true, module: 'features/native/share' },
} as const;

export type FutureCapabilityKey = keyof typeof futureCapabilities;
