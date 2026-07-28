import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from '@/components/ui';
import { captureException } from '@/lib/crash-reporting';
import { spacing } from '@/theme/tokens';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

/**
 * Crash recovery — catch render failures and offer reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.root}>
          <Text variant="title">Something went wrong</Text>
          <Text muted>{this.state.message}</Text>
          <Button
            title="Try again"
            onPress={() => this.setState({ hasError: false, message: '' })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
});
