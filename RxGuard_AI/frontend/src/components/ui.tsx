import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';

// RxGuard AI design system - light theme with cornflower blue
export const C = {
  primary: '#6495ED',
  primaryDark: '#4A7BD8',
  lightBlue: '#87CEFA',
  aliceBlue: '#F0F8FF',
  white: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  green: '#16A34A',
  greenBg: '#ECFDF5',
  red: '#DC2626',
  redBg: '#FEF2F2',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  shadow: 'rgba(100, 149, 237, 0.18)',
};

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}) {
  const bg =
    variant === 'primary' ? C.primary
    : variant === 'secondary' ? C.white
    : variant === 'danger' ? C.red
    : variant === 'success' ? C.green
    : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger' || variant === 'success' ? C.white : C.primary;
  const border = variant === 'secondary' ? C.primary : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: disabled ? '#C7D2E8' : bg, borderColor: border },
        variant === 'ghost' && { borderWidth: 0 },
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  error,
  autoCapitalize = 'none',
  keyboardType = 'default',
  multiline,
  style,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  error?: string | null;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  style?: any;
}) {
  return (
    <View style={[styles.inputWrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, error && styles.inputError, multiline && { height: 90, textAlignVertical: 'top' }]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Badge({ status, small }: { status: string; small?: boolean }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    active: { bg: C.greenBg, fg: C.green },
    safe: { bg: C.greenBg, fg: C.green },
    success: { bg: C.greenBg, fg: C.green },
    recalled: { bg: C.redBg, fg: C.red },
    substandard: { bg: C.redBg, fg: C.red },
    spurious: { bg: C.redBg, fg: C.red },
    falsified: { bg: C.redBg, fg: C.red },
    unregistered: { bg: C.redBg, fg: C.red },
    discontinued: { bg: C.amberBg, fg: C.amber },
    suspended: { bg: C.amberBg, fg: C.amber },
    cancelled: { bg: C.amberBg, fg: C.amber },
    expired: { bg: C.amberBg, fg: C.amber },
    unknown: { bg: C.gray100, fg: C.textSecondary },
    draft: { bg: C.amberBg, fg: C.amber },
    printed: { bg: C.greenBg, fg: C.green },
    pending: { bg: C.amberBg, fg: C.amber },
    approved: { bg: C.greenBg, fg: C.green },
    rejected: { bg: C.redBg, fg: C.red },
  };
  const c = colors[status] || colors.unknown;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, small && styles.badgeSmall]}>
      <Text style={{ color: c.fg, fontWeight: '700', fontSize: small ? 10 : 12, textTransform: 'capitalize' }}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <View style={styles.spinnerWrap}>
      <ActivityIndicator size="large" color={C.primary} />
      {label ? <Text style={styles.spinnerText}>{label}</Text> : null}
    </View>
  );
}

// Simple bar chart for dashboards (pure RN, no native deps)
export function BarChart({ data, color = C.primary }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, minHeight: 140, paddingTop: 10 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 11, color: C.textSecondary }}>{d.value}</Text>
          <View
            style={{
              width: '80%',
              height: Math.max(6, (d.value / max) * 100),
              backgroundColor: color,
              borderRadius: 6,
              minHeight: 6,
            }}
          />
          <Text numberOfLines={1} style={{ fontSize: 10, color: C.textSecondary, textAlign: 'center' }}>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function PageShell({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={styles.page}>{children}</View>;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// Web-safe confirmation dialog. Alert.alert() buttons do not render on
// react-native-web, so every confirm flow uses this Modal-based hook instead.
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const ask = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }, []);

  const done = useCallback((v: boolean) => {
    setState((s) => {
      s?.resolve(v);
      return null;
    });
  }, []);

  const dialog = state ? (
    <Modal visible transparent animationType="fade" onRequestClose={() => done(false)}>
      <Pressable style={styles.confirmOverlay} onPress={() => done(false)}>
        <Pressable style={styles.confirmSheet} onPress={(e: any) => e.stopPropagation?.()}>
          <Text style={styles.confirmTitle}>{state.title}</Text>
          {state.message ? <Text style={styles.confirmMessage}>{state.message}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Pressable
              style={[styles.confirmBtn, { backgroundColor: state.danger ? C.red : C.primary }]}
              onPress={() => done(true)}
            >
              <Text style={{ color: C.white, fontWeight: '700', fontSize: 14.5 }}>
                {state.confirmLabel || 'Confirm'}
              </Text>
            </Pressable>
            <Pressable style={styles.confirmCancel} onPress={() => done(false)}>
              <Text style={{ color: C.textSecondary, fontWeight: '700', fontSize: 14.5 }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  ) : null;

  return { ask, dialog };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    minHeight: 48,
  },
  buttonText: { fontWeight: '700', fontSize: 15 },
  inputWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: C.text },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: C.white,
    color: C.text,
  },
  inputError: { borderColor: C.red },
  errorText: { color: C.red, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeSmall: { paddingHorizontal: 7, paddingVertical: 2 },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: C.textSecondary, textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  spinnerWrap: { paddingVertical: 24, alignItems: 'center', gap: 10 },
  spinnerText: { color: C.textSecondary, fontSize: 14 },
  page: { flex: 1, backgroundColor: C.aliceBlue },
  pageContent: { padding: 20, gap: 16, maxWidth: 1100, width: '100%', alignSelf: 'center' as const, paddingBottom: 60 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmSheet: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 22,
    width: '100%',
    maxWidth: 420,
  },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  confirmMessage: { fontSize: 14, color: C.textSecondary, marginTop: 8, lineHeight: 21 },
  confirmBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  confirmCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: C.white,
  },
});
