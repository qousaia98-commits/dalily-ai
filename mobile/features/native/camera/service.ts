import { CameraView, useCameraPermissions } from 'expo-camera';
import { ensurePermission } from '../permissions';
import { compressImage, createMediaAsset } from '../media/compress';
import type { MediaPurpose, NativeMediaAsset } from '../types';
import { trackNative } from '../observability';

export { CameraView, useCameraPermissions };

export type CaptureResult = {
  asset: NativeMediaAsset;
  rawUri: string;
};

/**
 * Process a camera capture URI into a compressed media asset.
 * Retake is handled by the UI (discard asset and open camera again).
 */
export async function processCameraCapture(input: {
  uri: string;
  purpose: MediaPurpose;
  compress?: boolean;
}): Promise<CaptureResult> {
  const granted = await ensurePermission('camera');
  if (!granted) {
    throw new Error('Camera permission required');
  }

  trackNative('camera_usage', { action: 'capture', purpose: input.purpose });

  let uri = input.uri;
  let compressed = false;
  let width: number | undefined;
  let height: number | undefined;

  if (input.compress !== false) {
    const out = await compressImage(uri, { purpose: input.purpose });
    uri = out.uri;
    width = out.width;
    height = out.height;
    compressed = true;
  }

  return {
    rawUri: input.uri,
    asset: createMediaAsset({
      uri,
      purpose: input.purpose,
      mimeType: 'image/jpeg',
      width,
      height,
      compressed,
    }),
  };
}
