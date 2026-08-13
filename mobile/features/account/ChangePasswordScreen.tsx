import React, { useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, Card, Button, Input } from '@/components/ui';
import { changePassword } from '@/services/auth/auth-service';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!currentPassword || !newPassword) {
      setError(t('account.changePassword.errors.required'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('account.changePassword.errors.tooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('account.changePassword.errors.mismatch'));
      return;
    }

    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      Alert.alert(t('account.changePassword.successTitle'), t('account.changePassword.successBody'));
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown';
      setError(
        message === 'wrong_current_password'
          ? t('account.changePassword.errors.wrongCurrent')
          : t('account.changePassword.errors.failed'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Text variant="title">{t('account.changePassword.title')}</Text>
        <Text muted>{t('account.changePassword.subtitle')}</Text>

        <Input
          label={t('account.changePassword.currentPassword')}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoComplete="current-password"
          editable={!saving}
        />
        <Input
          label={t('account.changePassword.newPassword')}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
          editable={!saving}
        />
        <Input
          label={t('account.changePassword.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          editable={!saving}
        />

        {error ? (
          <Text style={{ color: colors.danger }} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Button
          title={saving ? t('account.changePassword.saving') : t('account.changePassword.submit')}
          onPress={() => void onSubmit()}
          loading={saving}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
});
