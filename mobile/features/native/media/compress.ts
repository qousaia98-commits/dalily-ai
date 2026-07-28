import * as ImageManipulator from 'expo-image-manipulator';
import type { NativeMediaAsset, MediaPurpose } from '../types';
import { trackNative } from '../observability';

export type CompressOptions = {
  maxWidth?: number;
  quality?: number;
  purpose?: MediaPurpose;
};

/**
 * Compress images before upload — balances quality vs battery/memory.
 */
export async function compressImage(
  uri: string,
  options: CompressOptions = {},
): Promise<{ uri: string; width?: number; height?: number }> {
  const maxWidth = options.maxWidth ?? 1600;
  const quality = options.quality ?? 0.72;
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  trackNative('camera_usage', {
    action: 'compress',
    purpose: options.purpose,
    quality,
  });
  return result;
}

/** Crop preparation — apply known crop box before upload (UI crop later). */
export async function prepareCrop(
  uri: string,
  crop: { originX: number; originY: number; width: number; height: number },
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ crop }], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

export function createMediaAsset(
  partial: Omit<NativeMediaAsset, 'id' | 'createdAt' | 'compressed'> & {
    compressed?: boolean;
  },
): NativeMediaAsset {
  return {
    ...partial,
    compressed: partial.compressed ?? false,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
}
