import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Card, Input, Text } from '@/components/ui';
import { login, loginSchema } from '@/services/auth/auth-service';
import { applyLanguage } from '@/i18n';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type FormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values);
      router.replace('/');
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
        <Text variant="display">{t('common.appName')}</Text>
        <Text variant="title">{t('auth.welcomeBack')}</Text>
        <Card style={styles.card}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.email')}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.password')}
                secureTextEntry
                autoComplete="password"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.password?.message}
              />
            )}
          />
          {error ? (
            <Text variant="caption" style={{ color: colors.danger }}>
              {error}
            </Text>
          ) : null}
          <Button title={t('auth.login')} loading={isSubmitting} onPress={onSubmit} />
          <Link href="/(auth)/forgot-password" asChild>
            <Text muted>{t('auth.forgotPassword')}</Text>
          </Link>
          <Link href="/(auth)/register" asChild>
            <Text>{t('auth.register')}</Text>
          </Link>
        </Card>
        <View style={styles.langRow}>
          <Button title="EN" variant="ghost" onPress={() => applyLanguage('en')} />
          <Button title="AR" variant="ghost" onPress={() => applyLanguage('ar')} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  card: { gap: spacing.md },
  langRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
});
