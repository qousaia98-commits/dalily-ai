/**
 * Store permission justifications — App Store / Play compliance copy.
 */

export const permissionReview = {
  camera: {
    purpose: 'Profile photos, job documentation, verification documents',
    iosKey: 'NSCameraUsageDescription',
    android: ['CAMERA'],
    required: false,
    userFacing:
      'Dalily uses the camera so you can take profile photos, document completed jobs, and upload verification documents.',
  },
  photos: {
    purpose: 'Booking attachments and business gallery',
    iosKey: 'NSPhotoLibraryUsageDescription',
    android: ['READ_MEDIA_IMAGES'],
    required: false,
    userFacing:
      'Dalily accesses your photo library so you can attach images to bookings, your business gallery, and support requests.',
  },
  location: {
    purpose: 'Nearby search, address detection, job navigation',
    iosKey: 'NSLocationWhenInUseUsageDescription',
    android: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    required: false,
    userFacing:
      'Dalily uses your location to show nearby providers, detect your service address, and help navigate to jobs.',
  },
  locationBackground: {
    purpose: 'Optional live arrival during active jobs',
    iosKey: 'NSLocationAlwaysAndWhenInUseUsageDescription',
    android: ['ACCESS_BACKGROUND_LOCATION'],
    required: false,
    enabledInBuild: false,
    userFacing:
      'Dalily may use background location only during an active job when you explicitly opt in for live arrival updates.',
  },
  notifications: {
    purpose: 'Booking updates, job alerts, messages, AI briefings',
    iosKey: 'UIBackgroundModes remote-notification',
    android: ['POST_NOTIFICATIONS'],
    required: false,
    userFacing: 'Dalily sends notifications about bookings, jobs, messages, and important account updates.',
  },
  biometrics: {
    purpose: 'Secure unlock and re-authentication',
    iosKey: 'NSFaceIDUsageDescription',
    android: ['USE_BIOMETRIC', 'USE_FINGERPRINT'],
    required: false,
    userFacing:
      'Dalily uses Face ID / fingerprint to unlock the app and confirm sensitive actions such as account changes.',
  },
  storage: {
    purpose: 'Document pickers and invoice downloads (scoped storage)',
    iosKey: 'NSPhotoLibraryAddUsageDescription',
    android: [],
    required: false,
    userFacing: 'Dalily may save invoices and job photos when you choose to download them.',
  },
  backgroundTasks: {
    purpose: 'Silent notification handling and future offline sync',
    iosKey: 'UIBackgroundModes fetch',
    android: ['RECEIVE_BOOT_COMPLETED'],
    required: false,
    userFacing: 'Dalily may refresh content in the background so bookings and jobs stay up to date.',
  },
  future: {
    contacts: 'Not requested in 1.0 — requires separate consent screen before enabling.',
    calendar: 'Not requested in 1.0 — optional booking sync later.',
    microphone: 'Not requested in 1.0 — voice search remains prep-only.',
  },
} as const;
