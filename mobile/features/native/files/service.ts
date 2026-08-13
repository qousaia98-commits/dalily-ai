import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ensurePermission } from '../permissions';
import type { MediaPurpose } from '../types';
import { trackNative } from '../observability';

export type PickedDocument = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  purpose: MediaPurpose;
};

export async function pickPdfDocument(
  purpose: MediaPurpose = 'document',
): Promise<PickedDocument | null> {
  await ensurePermission('storage');
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  trackNative('file_action', { action: 'pick', purpose, mimeType: asset.mimeType });
  return {
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType,
    size: asset.size,
    purpose,
  };
}

export async function downloadInvoice(input: {
  url: string;
  fileName?: string;
}): Promise<string> {
  const name = input.fileName ?? `invoice-${Date.now()}.pdf`;
  const dest = `${FileSystem.documentDirectory}${name}`;
  const result = await FileSystem.downloadAsync(input.url, dest);
  trackNative('file_action', { action: 'download_invoice', status: result.status });
  return result.uri;
}

export async function shareFile(uri: string, dialogTitle = 'Share with Dalily'): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing unavailable on this device');
  await Sharing.shareAsync(uri, { dialogTitle });
  trackNative('file_action', { action: 'native_share' });
}

export async function previewImageUri(uri: string): Promise<{ exists: boolean; size?: number }> {
  const info = await FileSystem.getInfoAsync(uri);
  return {
    exists: info.exists,
    size: info.exists && 'size' in info ? info.size : undefined,
  };
}

/** Secure local copy for verification documents. */
export async function stashVerificationDocument(
  sourceUri: string,
  fileName: string,
): Promise<string> {
  const dest = `${FileSystem.documentDirectory}secure/${fileName}`;
  const dir = `${FileSystem.documentDirectory}secure/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  trackNative('file_action', { action: 'stash_verification' });
  return dest;
}
