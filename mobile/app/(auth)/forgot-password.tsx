import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Card, Input, Text } from '@/components/ui';
import { forgotPassword, forgotPasswordSchema } from '@/services/auth/auth-service';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type FormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await forgotPassword(values);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  });

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text variant="title">{t('auth.forgotPassword')}</Text>
        <Card style={styles.card}>
          {done ? (
            <Text>{t('common.continue')}</Text>
          ) : (
            <>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('auth.email')}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    error={errors.email?.message}
                  />
                )}
              />
              {error ? (
                <Text variant="caption" style={{ color: colors.danger }}>
                  {error}
                </Text>
              ) : null}
              <Button title={t('auth.sendReset')} loading={isSubmitting} onPress={onSubmit} />
            </>
          )}
          <Link href="/(auth)/login" asChild>
            <Text>{t('auth.login')}</Text>
          </Link>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  card: { gap: spacing.md },
});
