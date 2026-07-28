import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Card, Input, Text } from '@/components/ui';
import { register, registerSchema } from '@/services/auth/auth-service';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

type FormValues = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', fullName: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await register(values);
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
        <Text variant="title">{t('auth.createAccount')}</Text>
        <Card style={styles.card}>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.fullName')}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.fullName?.message}
              />
            )}
          />
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
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('auth.password')}
                secureTextEntry
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
          <Button title={t('auth.register')} loading={isSubmitting} onPress={onSubmit} />
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
