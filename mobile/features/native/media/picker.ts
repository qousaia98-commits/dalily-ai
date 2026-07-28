import * as ImagePicker from 'expo-image-picker';
import { ensurePermission } from '../permissions';
import { compressImage, createMediaAsset } from './compress';
import type { MediaPurpose, NativeMediaAsset } from '../types';
import { trackNative } from '../observability';

export type PickImagesOptions = {
  purpose: MediaPurpose;
  allowsMultiple?: boolean;
  selectionLimit?: number;
  compress?: boolean;
};

/**
 * Gallery selection with optional multi-select + compression.
 */
export async function pickImagesFromGallery(
  options: PickImagesOptions,
): Promise<NativeMediaAsset[]> {
  const granted = await ensurePermission('photos');
  if (!granted) {
    throw new Error('Photo library permission required');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: options.allowsMultiple ?? false,
    selectionLimit: options.selectionLimit ?? (options.allowsMultiple ? 8 : 1),
    quality: 1,
    exif: false,
  });

  if (result.canceled) return [];

  const assets: NativeMediaAsset[] = [];
  for (const asset of result.assets) {
    let uri = asset.uri;
    let compressed = false;
    let width = asset.width;
    let height = asset.height;

    if (options.compress !== false) {
      const out = await compressImage(uri, { purpose: options.purpose });
      uri = out.uri;
      width = out.width ?? width;
      height = out.height ?? height;
      compressed = true;
    }

    assets.push(
      createMediaAsset({
        uri,
        purpose: options.purpose,
        mimeType: asset.mimeType ?? 'image/jpeg',
        width,
        height,
        sizeBytes: asset.fileSize,
        compressed,
      }),
    );
  }

  trackNative('camera_usage', {
    action: 'gallery_pick',
    purpose: options.purpose,
    count: assets.length,
  });
  return assets;
}

/** Launch system camera via image picker (lighter than full CameraView). */
export async function pickFromCamera(purpose: MediaPurpose): Promise<NativeMediaAsset | null> {
  const granted = await ensurePermission('camera');
  if (!granted) throw new Error('Camera permission required');

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const out = await compressImage(asset.uri, { purpose });
  trackNative('camera_usage', { action: 'picker_camera', purpose });
  return createMediaAsset({
    uri: out.uri,
    purpose,
    mimeType: 'image/jpeg',
    width: out.width ?? asset.width,
    height: out.height ?? asset.height,
    compressed: true,
  });
}
