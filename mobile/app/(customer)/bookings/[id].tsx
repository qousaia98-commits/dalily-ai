import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, Card, Button, Badge, Skeleton, EmptyState } from '@/components/ui';
import { fetchBooking } from '@/features/customer/services';
import {
  shareBookingDetails,
  pickImagesFromGallery,
  MediaPreviewList,
  enqueueMediaUpload,
  NativeMapView,
  type NativeMediaAsset,
} from '@/features/native';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [attachments, setAttachments] = useState<NativeMediaAsset[]>([]);
  const { data, isLoading } = useQuery({
    queryKey: ['customer', 'booking', id],
    queryFn: () => fetchBooking(id!),
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Badge label={data.status.replace('_', ' ')} tone="info" />
        <Text variant="title">{data.serviceTitle}</Text>
        <Text muted>{data.providerName}</Text>
        <Text>{new Date(data.scheduledAt).toLocaleString()}</Text>
        <Text muted>{data.address}</Text>
        {data.notes ? <Text muted>{data.notes}</Text> : null}
        {data.priceEstimate > 0 ? (
          <Text>
            ~{data.priceEstimate} {data.currency}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.bookings.trackStatus')}</Text>
        <Text muted>{t('customer.bookings.trackHint')}</Text>
        <NativeMapView
          height={180}
          markers={[
            {
              id: 'booking',
              coordinate: { latitude: 31.9539, longitude: 35.9106 },
              title: data.address,
              kind: 'booking',
            },
          ]}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('native.media.attachments')}</Text>
        <Button
          title={t('native.media.addPhotos')}
          variant="secondary"
          onPress={async () => {
            const assets = await pickImagesFromGallery({
              purpose: 'booking_attachment',
              allowsMultiple: true,
              selectionLimit: 5,
            });
            setAttachments((m) => [...assets, ...m]);
            for (const asset of assets) {
              await enqueueMediaUpload({
                asset,
                remotePath: `bookings/${data.id}/${asset.id}.jpg`,
              });
            }
          }}
        />
        <MediaPreviewList
          assets={attachments}
          onRemove={(mediaId) => setAttachments((m) => m.filter((a) => a.id !== mediaId))}
        />
      </Card>

      <Button
        title={t('native.share.booking')}
        variant="ghost"
        onPress={() =>
          void shareBookingDetails({
            bookingId: data.id,
            serviceTitle: data.serviceTitle,
            when: new Date(data.scheduledAt).toLocaleString(),
          })
        }
      />

      {data.canReschedule ? (
        <Button
          title={t('customer.bookings.reschedule')}
          variant="secondary"
          onPress={() => router.push(`/(customer)/book/${data.providerId}`)}
        />
      ) : null}
      <Button
        title={t('customer.provider.book')}
        variant="ghost"
        onPress={() => router.push(`/(customer)/providers/${data.providerId}`)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
});
