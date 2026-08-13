import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text, Card, Button, Input, Badge, Skeleton, BottomSheet } from '@/components/ui';
import { fetchProviderProfile, submitBookingDraft } from '@/features/customer/services';
import { useBookingDraftStore } from '@/store/customer';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { useSettingsStore } from '@/store/settings';
import { featureFlags } from '@/constants/env';
import * as Haptics from 'expo-haptics';

const schema = z.object({
  address: z.string().min(5),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function BookProviderScreen() {
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const language = useSettingsStore((s) => s.language);
  const setDraft = useBookingDraftStore((s) => s.setDraft);
  const updateDraft = useBookingDraftStore((s) => s.updateDraft);
  const clearDraft = useBookingDraftStore((s) => s.clearDraft);
  const draft = useBookingDraftStore((s) => s.draft);

  const [step, setStep] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const profile = useQuery({
    queryKey: ['customer', 'provider', providerId],
    queryFn: () => fetchProviderProfile(providerId!),
    enabled: Boolean(providerId),
  });

  useEffect(() => {
    if (!providerId) return;
    setDraft({
      providerId,
      serviceId: null,
      date: new Date().toISOString().slice(0, 10),
      time: '10:00',
      address: '',
      notes: '',
      imageUris: [],
      priceEstimate: null,
      aiPriceHint: null,
    });
  }, [providerId, setDraft]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { address: '', notes: '' },
  });

  const selectedService = useMemo(() => {
    const services = profile.data?.services ?? [];
    return services.find((s) => s.id === draft?.serviceId) ?? services[0] ?? null;
  }, [profile.data, draft?.serviceId]);

  const priceEstimate = selectedService?.priceFrom ?? profile.data?.startingPrice ?? 0;
  const aiPriceHint = featureFlags.customerAi ? Math.round(priceEstimate * 1.05) : null;

  if (profile.isLoading || !profile.data || !draft) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Skeleton height={160} />
      </View>
    );
  }

  const onConfirm = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      updateDraft({
        address: values.address,
        notes: values.notes ?? '',
        priceEstimate,
        aiPriceHint,
      });
      const scheduledAt = new Date(
        `${draft.date ?? new Date().toISOString().slice(0, 10)}T${draft.time ?? '10:00'}:00`,
      ).toISOString();
      const booking = await submitBookingDraft({
        providerId: profile.data!.id,
        serviceTitle:
          language === 'ar'
            ? selectedService?.title.ar ?? 'Service'
            : selectedService?.title.en ?? 'Service',
        scheduledAt,
        address: values.address,
        notes: values.notes ?? '',
        priceEstimate: aiPriceHint ?? priceEstimate,
      });
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* optional */
      }
      clearDraft();
      setConfirmOpen(false);
      router.replace(`/(customer)/bookings/${booking.id}`);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text variant="title">{t('customer.book.title')}</Text>
      <Text muted>{profile.data.name}</Text>

      <View style={styles.steps}>
        {['service', 'schedule', 'details', 'confirm'].map((key, i) => (
          <Pressable key={key} onPress={() => setStep(i)}>
            <Badge
              label={t(`customer.book.steps.${key}`)}
              tone={step === i ? 'info' : 'default'}
            />
          </Pressable>
        ))}
      </View>

      {step === 0 ? (
        <Card style={styles.card}>
          <Text variant="subtitle">{t('customer.book.selectService')}</Text>
          {profile.data.services.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => updateDraft({ serviceId: s.id })}
              style={[
                styles.option,
                {
                  borderColor:
                    (draft.serviceId ?? profile.data!.services[0]?.id) === s.id
                      ? colors.primary
                      : colors.border,
                },
              ]}
            >
              <Text>{language === 'ar' ? s.title.ar : s.title.en}</Text>
              <Text muted>
                from {s.priceFrom} {profile.data!.currency}
              </Text>
            </Pressable>
          ))}
          <Button title={t('common.continue')} onPress={() => setStep(1)} />
        </Card>
      ) : null}

      {step === 1 ? (
        <Card style={styles.card}>
          <Text variant="subtitle">{t('customer.book.schedule')}</Text>
          <Text muted>
            {Platform.OS} · {t('customer.book.nativePickerHint')}
          </Text>
          <Input
            label={t('customer.book.date')}
            value={draft.date ?? ''}
            onChangeText={(date) => updateDraft({ date })}
            placeholder="YYYY-MM-DD"
          />
          <Input
            label={t('customer.book.time')}
            value={draft.time ?? ''}
            onChangeText={(time) => updateDraft({ time })}
            placeholder="HH:MM"
          />
          <Button title={t('common.continue')} onPress={() => setStep(2)} />
        </Card>
      ) : null}

      {step === 2 ? (
        <Card style={styles.card}>
          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('customer.book.address')}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.address?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('customer.book.notes')}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                multiline
              />
            )}
          />
          <Text muted>{t('customer.book.imagesHint')}</Text>
          <Button title={t('common.continue')} onPress={() => setStep(3)} />
        </Card>
      ) : null}

      {step === 3 ? (
        <Card style={styles.card}>
          <Text variant="subtitle">{t('customer.book.estimate')}</Text>
          <Text>
            {priceEstimate} {profile.data.currency}
          </Text>
          {aiPriceHint != null ? (
            <Text muted>
              {t('customer.book.aiPrice')}: ~{aiPriceHint} {profile.data.currency}
            </Text>
          ) : null}
          <Button title={t('customer.book.confirm')} onPress={() => setConfirmOpen(true)} />
        </Card>
      ) : null}

      <BottomSheet visible={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <Text variant="subtitle">{t('customer.book.confirmTitle')}</Text>
        <Text muted>{t('customer.book.confirmBody')}</Text>
        <Button
          title={t('customer.book.place')}
          loading={submitting}
          onPress={() => void onConfirm()}
          style={{ marginTop: spacing.md }}
        />
      </BottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { gap: spacing.md },
  option: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
