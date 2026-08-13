import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Button, Card } from '@/components/ui';
import { openPermissionSettings, requestPermission } from '../permissions';
import type { PermissionKind, PermissionSnapshot } from '../types';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Props = {
  kind: PermissionKind;
  title: string;
  description: string;
  snapshot?: PermissionSnapshot;
  onChanged?: (s: PermissionSnapshot) => void;
};

export function PermissionGate({ kind, title, description, snapshot, onChanged }: Props) {
  const { colors } = useTheme();
  const status = snapshot?.status ?? 'undetermined';

  return (
    <Card style={styles.card}>
      <Text variant="subtitle">{title}</Text>
      <Text muted>{description}</Text>
      <Text style={{ color: colors.textMuted }}>Status: {status}</Text>
      {status !== 'granted' ? (
        <View style={styles.row}>
          <Button
            title="Allow"
            onPress={async () => {
              const next = await requestPermission(kind);
              onChanged?.(next);
            }}
          />
          {status === 'blocked' || snapshot?.canAskAgain === false ? (
            <Button title="Open settings" variant="ghost" onPress={() => void openPermissionSettings()} />
          ) : null}
        </View>
      ) : (
        <Pressable onPress={() => void openPermissionSettings()}>
          <Text muted>Manage in system settings</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
