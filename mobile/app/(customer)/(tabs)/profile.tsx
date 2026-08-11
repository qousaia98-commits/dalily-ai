import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, Card, Button, Avatar, Badge } from '@/components/ui';
import { logout } from '@/services/auth/auth-service';
import { useAuthStore } from '@/store/auth';
import { applyLanguage } from '@/i18n';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { ContactSupportSheet } from '@/features/account/ContactSupportSheet';

export default function CustomerProfileScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { colors } = useTheme();
  const [supportOpen, setSupportOpen] = useState(false);
  const language = useSettingsStore((s) => s.language);
  const themePreference = useSettingsStore((s) => s.themePreference);
  const setThemePreference = useSettingsStore((s) => s.setThemePreference);
  const highContrast = useSettingsStore((s) => s.highContrast);
  const setHighContrast = useSettingsStore((s) => s.setHighContrast);
  const largeFonts = useSettingsStore((s) => s.largeFonts);
  const setLargeFonts = useSettingsStore((s) => s.setLargeFonts);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <View style={styles.row}>
          <Avatar name={user?.email} size={56} />
          <View style={{ flex: 1 }}>
            <Text variant="subtitle">{user?.email ?? t('customer.profile.guest')}</Text>
            <Badge label="Customer" tone="info" />
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.profile.personal')}</Text>
        <Text muted>{t('customer.profile.personalHint')}</Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.profile.addresses')}</Text>
        <Text muted>Abdoun, Amman</Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.profile.payments')}</Text>
        <Text muted>{t('customer.profile.paymentsHint')}</Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.profile.language')}</Text>
        <View style={styles.row}>
          <Button title="EN" variant={language === 'en' ? 'primary' : 'ghost'} onPress={() => applyLanguage('en')} />
          <Button title="AR" variant={language === 'ar' ? 'primary' : 'ghost'} onPress={() => applyLanguage('ar')} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.profile.theme')}</Text>
        <View style={styles.row}>
          {(['system', 'light', 'dark'] as const).map((mode) => (
            <Button
              key={mode}
              title={mode}
              variant={themePreference === mode ? 'primary' : 'ghost'}
              onPress={() => setThemePreference(mode)}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.profile.privacy')}</Text>
        <Pressable onPress={() => setHighContrast(!highContrast)}>
          <Text>
            {t('customer.profile.highContrast')}: {highContrast ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
        <Pressable onPress={() => setLargeFonts(!largeFonts)}>
          <Text>
            {t('customer.profile.largeFonts')}: {largeFonts ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">{t('customer.profile.security')}</Text>
        <Text muted>{t('customer.profile.securityHint')}</Text>
        <Button
          title={t('account.changePassword.navTitle')}
          variant="secondary"
          onPress={() => router.push('/(customer)/change-password')}
        />
      </Card>

      <Button
        title={t('support.navTitle')}
        variant="primary"
        onPress={() => setSupportOpen(true)}
      />

      <Button
        title={t('native.open')}
        variant="secondary"
        onPress={() => router.push('/(customer)/native')}
      />
      <Button
        title={t('legal.privacyTitle')}
        variant="ghost"
        onPress={() => router.push('/(customer)/privacy')}
      />

      <Button
        title={t('auth.logout')}
        variant="danger"
        onPress={async () => {
          await logout();
          router.replace('/(auth)/login');
        }}
      />

      <ContactSupportSheet
        visible={supportOpen}
        onClose={() => setSupportOpen(false)}
        role="customer"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
});
