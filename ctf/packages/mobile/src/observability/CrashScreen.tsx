import { Component, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import * as Updates from 'expo-updates';
import { onAppFailure, recordAppFailure, type AppFailure } from './crashHandler';
import { reportError } from './report';

// The screen a member sees instead of the app closing. System fonts and fixed colors only: the fonts,
// theme and auth providers may be what failed, so this depends on none of them.
function CrashScreen({ failure }: { failure: AppFailure }) {
  const [reloadError, setReloadError] = useState<string | null>(null);

  const reload = () => {
    Updates.reloadAsync().catch((error: unknown) => {
      reportError(error, { area: 'app', op: 'reload_after_crash', extra: { reference: failure.reference } });
      setReloadError('Could not restart the app. Close it and open it again.');
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>Skills Economy stopped because of an error</Text>
      <Text style={styles.body}>
        Take a screenshot of this screen and send it with a bug report, so the cause can be found.
      </Text>
      <Text style={styles.label}>Reference</Text>
      <Text style={styles.value} selectable>
        {failure.reference}
      </Text>
      {/* The reason is shown, not only the reference: when the app cannot start, the bug report
          screen is out of reach and Sentry may not be configured, so this line is the only record
          a member can pass on. It is the error message alone, never a stack. */}
      <Text style={styles.label}>What failed</Text>
      <Text style={styles.value} selectable>
        {failure.reason}
      </Text>
      <TouchableOpacity style={styles.button} onPress={reload} accessibilityRole="button">
        <Text style={styles.buttonText}>Restart the app</Text>
      </TouchableOpacity>
      {reloadError ? <Text style={styles.body}>{reloadError}</Text> : null}
    </ScrollView>
  );
}

type BoundaryProps = { onFailure: (_failure: AppFailure) => void; children: ReactNode };

// Catches an error thrown while drawing a screen, which would otherwise unmount the app.
class RenderErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onFailure(recordAppFailure(error, 'render_error'));
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// The root the app registers. `App` is null when loading the app's code itself failed, in which case
// `initialFailure` carries that reason.
export function CrashGuard({
  App,
  initialFailure,
}: {
  App: ComponentType | null;
  initialFailure: AppFailure | null;
}) {
  const [failure, setFailure] = useState<AppFailure | null>(initialFailure);

  useEffect(() => {
    onAppFailure(setFailure);
    return () => onAppFailure(null);
  }, []);

  if (failure || !App) {
    return (
      <CrashScreen
        failure={failure ?? { reason: 'The app code did not load.', reference: 'none' }}
      />
    );
  }
  return (
    <RenderErrorBoundary onFailure={setFailure}>
      <App />
    </RenderErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1117' },
  inner: { padding: 24, paddingTop: 72 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  body: { color: '#C9CBD3', fontSize: 15, lineHeight: 22, marginBottom: 20 },
  label: { color: '#8A8FA0', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  value: { color: '#FFFFFF', fontSize: 15, marginBottom: 16 },
  button: {
    backgroundColor: '#006D72',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
