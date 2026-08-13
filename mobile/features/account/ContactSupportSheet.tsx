import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, Button, Input, BottomSheet } from '@/components/ui';
import { submitSupportMessage } from '@/features/account/support-service';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  role: 'customer' | 'business';
};

export function ContactSupportSheet({ visible, onClose, role }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function reset() {
    setSubject('');
    setMessage('');
    setError(null);
    setSent(false);
  }

  async function onSubmit() {
    setError(null);
    if (!subject.trim() || !message.trim()) {
      setError(t('support.errors.required'));
      return;
    }
    setSending(true);
    try {
      await submitSupportMessage({ role, subject, message });
      setSent(true);
    } catch {
      setError(t('support.errors.submitFailed'));
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        onClose();
        reset();
      }}
    >
      {sent ? (
        <View style={styles.wrap}>
          <Text variant="subtitle">{t('support.successTitle')}</Text>
          <Text muted>{t('support.successBody')}</Text>
          <Button
            title={t('support.close')}
            variant="secondary"
            onPress={() => {
              onClose();
              reset();
            }}
          />
        </View>
      ) : (
        <View style={styles.wrap}>
          <Text variant="subtitle">{t('support.title')}</Text>
          <Text muted>{t('support.subtitle')}</Text>
          <Input
            label={t('support.subjectLabel')}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('support.subjectPlaceholder')}
            editable={!sending}
          />
          <Input
            label={t('support.messageLabel')}
            value={message}
            onChangeText={setMessage}
            placeholder={t('support.messagePlaceholder')}
            multiline
            numberOfLines={4}
            style={styles.textarea}
            editable={!sending}
          />
          {error ? (
            <Text style={{ color: colors.danger }} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <Button
            title={sending ? t('support.sending') : t('support.submit')}
            onPress={() => void onSubmit()}
            loading={sending}
          />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
});
