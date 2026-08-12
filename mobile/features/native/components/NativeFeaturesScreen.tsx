import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, Card, Button, Badge } from '@/components/ui';
import {
  PermissionGate,
  getAllPermissionStatuses,
  loadPushPreferences,
  setPushPreference,
  registerForPushNotifications,
  listNotificationHistory,
  scheduleLocalNotification,
  getBiometricCapability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
  setFallbackPin,
  authenticateBiometric,
  pickImagesFromGallery,
  pickFromCamera,
  MediaPreviewList,
  detectCustomerAddress,
  NativeMapView,
  enqueueMediaUpload,
  listMediaUploads,
  syncOfflineMediaQueue,
  shareReferralLink,
  deviceFeatureBlueprints,
  markDeviceFeatureInterest,
  type PermissionSnapshot,
  type PushPreferenceMap,
  type PushCategory,
  type NativeMediaAsset,
  type OfflineMediaUpload,
} from '@/features/native';
import { featureFlags } from '@/constants/env';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const PUSH_CATEGORIES: PushCategory[] = [
  'booking_updates',
  'provider_job_updates',
  'messages',
  'ai_recommendations',
  'business_assistant_briefings',
  'promotions',
  'system',
  'silent',
];

type Props = {
  role: 'customer' | 'provider';
};

export function NativeFeaturesScreen({ role }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [permissions, setPermissions] = useState<PermissionSnapshot[]>([]);
  const [prefs, setPrefs] = useState<PushPreferenceMap | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');
  const [media, setMedia] = useState<NativeMediaAsset[]>([]);
  const [uploads, setUploads] = useState<OfflineMediaUpload[]>([]);
  const [address, setAddress] = useState<string | undefined>();
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [historyCount, setHistoryCount] = useState(0);

  const refresh = async () => {
    setPermissions(await getAllPermissionStatuses());
    setPrefs(await loadPushPreferences());
    setBioEnabled(await isBiometricUnlockEnabled());
    const cap = await getBiometricCapability();
    setBioLabel(cap.label);
    setUploads(await listMediaUploads());
    setHistoryCount((await listNotificationHistory()).length);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async setup fetch, setState happens post-await
    void refresh();
  }, []);

  if (!featureFlags.nativeFeatures) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Text>{t('native.disabled')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Text variant="title">{t('native.title')}</Text>
        <Text muted>{t('native.subtitle')}</Text>
        <Badge label={role} tone="info" />
      </Card>

      <Text variant="subtitle">{t('native.permissions')}</Text>
      <PermissionGate
        kind="camera"
        title={t('native.perm.camera')}
        description={t('native.perm.cameraDesc')}
        snapshot={permissions.find((p) => p.kind === 'camera')}
        onChanged={() => void refresh()}
      />
      <PermissionGate
        kind="photos"
        title={t('native.perm.photos')}
        description={t('native.perm.photosDesc')}
        snapshot={permissions.find((p) => p.kind === 'photos')}
        onChanged={() => void refresh()}
      />
      <PermissionGate
        kind="location"
        title={t('native.perm.location')}
        description={t('native.perm.locationDesc')}
        snapshot={permissions.find((p) => p.kind === 'location')}
        onChanged={() => void refresh()}
      />
      <PermissionGate
        kind="notifications"
        title={t('native.perm.notifications')}
        description={t('native.perm.notificationsDesc')}
        snapshot={permissions.find((p) => p.kind === 'notifications')}
        onChanged={() => void refresh()}
      />

      <Card style={styles.card}>
        <Text variant="subtitle">{t('native.push.title')}</Text>
        <Text muted>
          {t('native.push.history')}: {historyCount}
        </Text>
        <Button
          title={t('native.push.register')}
          onPress={async () => {
            const reg = await registerForPushNotifications();
            setPushToken(reg.token);
            Alert.alert(
              t('native.push.title'),
              reg.token
                ? `${reg.provider.toUpperCase()} · ${reg.token.slice(0, 24)}…`
                : t('native.push.unavailable'),
            );
            await refresh();
          }}
        />
        <Button
          title={t('native.push.test')}
          variant="ghost"
          onPress={() =>
            void scheduleLocalNotification({
              title: 'Dalily',
              body: role === 'provider' ? 'New job update' : 'Booking update',
              category: role === 'provider' ? 'provider_job_updates' : 'booking_updates',
              seconds: 2,
            })
          }
        />
        {prefs
          ? PUSH_CATEGORIES.map((cat) => (
              <View key={cat} style={styles.switchRow}>
                <Text style={{ flex: 1 }}>{cat.replace(/_/g, ' ')}</Text>
                <Switch
                  value={prefs[cat]}
                  onValueChange={async (v) => {
                    const next = await setPushPreference(cat, v);
                    setPrefs(next);
                  }}
                />
              </View>
            ))
          : null}
        {pushToken ? <Text muted numberOfLines={1}>{pushToken}</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('native.biometric.title')}</Text>
        <Text muted>{bioLabel}</Text>
        <View style={styles.switchRow}>
          <Text style={{ flex: 1 }}>{t('native.biometric.enable')}</Text>
          <Switch
            value={bioEnabled}
            onValueChange={async (v) => {
              if (v) {
                const ok = await authenticateBiometric(t('native.biometric.prompt'));
                if (!ok) return;
              }
              await setBiometricUnlockEnabled(v);
              setBioEnabled(v);
            }}
          />
        </View>
        <Button
          title={t('native.biometric.setPin')}
          variant="secondary"
          onPress={async () => {
            try {
              await setFallbackPin('1357');
              Alert.alert(t('native.biometric.title'), t('native.biometric.pinSet'));
            } catch (e) {
              Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
            }
          }}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('native.media.title')}</Text>
        <View style={styles.row}>
          <Button
            title={t('native.media.camera')}
            onPress={async () => {
              const asset = await pickFromCamera(role === 'provider' ? 'business_gallery' : 'profile');
              if (asset) setMedia((m) => [asset, ...m]);
            }}
          />
          <Button
            title={t('native.media.gallery')}
            variant="secondary"
            onPress={async () => {
              const assets = await pickImagesFromGallery({
                purpose: role === 'provider' ? 'job_before' : 'booking_attachment',
                allowsMultiple: true,
                selectionLimit: 4,
              });
              setMedia((m) => [...assets, ...m]);
            }}
          />
        </View>
        <MediaPreviewList
          assets={media}
          onRemove={(id) => setMedia((m) => m.filter((a) => a.id !== id))}
          onRetake={(id) => {
            setMedia((m) => m.filter((a) => a.id !== id));
            void pickFromCamera(role === 'provider' ? 'job_after' : 'profile').then((asset) => {
              if (asset) setMedia((m) => [asset, ...m]);
            });
          }}
        />
        <Button
          title={t('native.media.queueUpload')}
          variant="ghost"
          onPress={async () => {
            for (const asset of media) {
              await enqueueMediaUpload({
                asset,
                remotePath: `${role}/${asset.purpose}/${asset.id}.jpg`,
              });
            }
            setUploads(await listMediaUploads());
          }}
        />
        <Button
          title={t('native.media.sync')}
          variant="ghost"
          onPress={async () => {
            await syncOfflineMediaQueue();
            setUploads(await listMediaUploads());
          }}
        />
        <Text muted>
          {t('native.media.queued')}: {uploads.filter((u) => u.status !== 'success').length}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('native.location.title')}</Text>
        <Button
          title={t('native.location.detect')}
          onPress={async () => {
            const result = await detectCustomerAddress();
            setCoords(result.coords);
            setAddress(result.address);
          }}
        />
        {address ? <Text>{address}</Text> : null}
        {coords && featureFlags.nativeMaps ? (
          <NativeMapView
            height={200}
            initial={coords}
            markers={[
              {
                id: 'me',
                coordinate: coords,
                title: role === 'provider' ? 'Provider GPS' : 'You',
              },
            ]}
            coverageCenter={role === 'provider' ? coords : undefined}
            coverageRadiusM={role === 'provider' ? 2500 : undefined}
            editable
            onPick={(c) => setCoords(c)}
          />
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('native.share.referral')}</Text>
        <Button
          title={t('native.share.shareReferral')}
          variant="secondary"
          onPress={() => void shareReferralLink({ code: 'DALILY-FRIEND' })}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('native.device.title')}</Text>
        <Text muted>{t('native.device.subtitle')}</Text>
        {deviceFeatureBlueprints.map((b) => (
          <Button
            key={b.id}
            title={`${b.id} · ${b.ready ? 'ready' : 'prep'}`}
            variant="ghost"
            onPress={() => markDeviceFeatureInterest(b.id)}
          />
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
