import React from 'react';
import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  View,
  type ModalProps,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radii, spacing } from '@/theme/tokens';

type Props = ModalProps & {
  onClose?: () => void;
};

export function Modal({ visible, onClose, children, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose} {...rest}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

/** Bottom-sheet style modal foundation (native sheet can replace later). */
export function BottomSheet(props: Props) {
  const { colors } = useTheme();
  return (
    <RNModal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={props.onClose}>
        <View style={[styles.bottom, { backgroundColor: colors.surface }]}>{props.children}</View>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  bottom: {
    marginTop: 'auto',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    minHeight: 180,
  },
});
