import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Button, Badge, Skeleton, EmptyState, BottomSheet, Input } from '@/components/ui';
import { fetchProviderJob, updateJobStatus } from '@/features/provider/services';
import type { JobStatus } from '@/features/provider/types';
import {
  openDefaultNavigation,
  openInGoogleMaps,
  openInAppleMaps,
  copyAddress,
  shareLocation,
  getEstimatedTravelTime,
  detectCustomerAddress,
  pickFromCamera,
  pickImagesFromGallery,
  MediaPreviewList,
  enqueueMediaUpload,
  shareBookingDetails,
  type NativeMediaAsset,
} from '@/features/native';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import * as Haptics from 'expo-haptics';

const NEXT: Partial<Record<JobStatus, JobStatus>> = {
  upcoming: 'active',
  active: 'completed',
};

export default function ProviderJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState('');
  const [jobMedia, setJobMedia] = useState<NativeMediaAsset[]>([]);
  const [eta, setEta] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['provider', 'job', id],
    queryFn: () => fetchProviderJob(id!),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Skeleton height={160} />
      </View>
    );
  }
  if (!data) return <EmptyState title={t('common.empty')} />;

  const dest =
    data.lat != null && data.lng != null
      ? { latitude: data.lat, longitude: data.lng, address: data.address, label: data.serviceTitle }
      : null;

  const advance = async () => {
    const next = NEXT[data.status];
    if (!next) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      /* optional */
    }
    await updateJobStatus(data.id, next);
    await qc.invalidateQueries({ queryKey: ['provider'] });
    router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Badge label={data.status} tone="info" />
        <Text variant="title">{data.serviceTitle}</Text>
        <Text muted>{data.customerName}</Text>
        <Text>{new Date(data.scheduledAt).toLocaleString()}</Text>
        <Text muted>{data.address}</Text>
        <Text>
          {data.price} {data.currency}
        </Text>
        {data.notes ? <Text muted>{data.notes}</Text> : null}
        {eta ? <Text muted>{t('native.nav.eta')}: {eta}</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.jobs.customer')}</Text>
        <Text>{data.customerName}</Text>
        {data.customerPhone ? <Text muted>{data.customerPhone}</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('providerApp.jobs.attachments')}</Text>
        <Text muted>
          {data.attachments.length
            ? `${data.attachments.length} files`
            : t('providerApp.jobs.noAttachments')}
        </Text>
        <View style={styles.row}>
          <Button
            title={t('native.media.before')}
            variant="secondary"
            onPress={async () => {
              const asset = await pickFromCamera('job_before');
              if (asset) {
                setJobMedia((m) => [asset, ...m]);
                await enqueueMediaUpload({
                  asset,
                  remotePath: `jobs/${data.id}/before/${asset.id}.jpg`,
                });
              }
            }}
          />
          <Button
            title={t('native.media.after')}
            variant="ghost"
            onPress={async () => {
              const assets = await pickImagesFromGallery({
                purpose: 'job_after',
                allowsMultiple: true,
                selectionLimit: 3,
              });
              setJobMedia((m) => [...assets, ...m]);
              for (const asset of assets) {
                await enqueueMediaUpload({
                  asset,
                  remotePath: `jobs/${data.id}/after/${asset.id}.jpg`,
                });
              }
            }}
          />
        </View>
        <MediaPreviewList
          assets={jobMedia}
          onRemove={(mediaId) => setJobMedia((m) => m.filter((a) => a.id !== mediaId))}
        />
      </Card>

      {dest ? (
        <Card style={styles.card}>
          <Text variant="subtitle">{t('native.nav.title')}</Text>
          <Button title={t('providerApp.jobs.navigate')} onPress={() => void openDefaultNavigation(dest)} />
          <Button
            title={t('native.nav.google')}
            variant="secondary"
            onPress={() => void openInGoogleMaps(dest)}
          />
          <Button
            title={t('native.nav.apple')}
            variant="ghost"
            onPress={() => void openInAppleMaps(dest)}
          />
          <Button
            title={t('native.nav.copy')}
            variant="ghost"
            onPress={() => void copyAddress(data.address)}
          />
          <Button
            title={t('native.nav.shareLocation')}
            variant="ghost"
            onPress={() => void shareLocation(dest)}
          />
          <Button
            title={t('native.nav.eta')}
            variant="ghost"
            onPress={async () => {
              try {
                const here = await detectCustomerAddress();
                setEta(getEstimatedTravelTime(here.coords, dest));
              } catch (e) {
                Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e));
              }
            }}
          />
        </Card>
      ) : null}

      <Button
        title={t('providerApp.jobs.share')}
        variant="ghost"
        onPress={() =>
          void shareBookingDetails({
            bookingId: data.id,
            serviceTitle: data.serviceTitle,
            when: new Date(data.scheduledAt).toLocaleString(),
          })
        }
      />
      <Button title={t('providerApp.jobs.addNote')} variant="ghost" onPress={() => setSheet(true)} />
      {NEXT[data.status] ? (
        <Button title={t('providerApp.jobs.advance')} onPress={() => void advance()} />
      ) : null}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)}>
        <Text variant="subtitle">{t('providerApp.jobs.notes')}</Text>
        <Input value={note} onChangeText={setNote} multiline />
        <Button title={t('common.save')} onPress={() => setSheet(false)} />
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
