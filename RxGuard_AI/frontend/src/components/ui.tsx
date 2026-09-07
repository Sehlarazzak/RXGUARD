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
} from 'react-native';

// Central RxGuard visual language. Keep all product-facing colors and surfaces
// here so every role workflow feels like the same application.
export const C = {
  navy: '#0B2540',
  navySoft: '#173C5E',
  primary: '#1769AA',
  primaryDark: '#0F4F86',
  primaryLight: '#DDEFFC',
  lightBlue: '#67B9E8',
  aliceBlue: '#F4F8FC',
  white: '#FFFFFF',
  text: '#102A43',
  textSecondary: '#627D98',
  textMuted: '#829AB1',
  border: '#D9E2EC',
  borderStrong: '#B8C9D9',
  green: '#14806A',
  greenBg: '#E7F7F1',
  red: '#C43D4A',
  redBg: '#FDECEE',
  amber: '#B66A12',
  amberBg: '#FFF6E5',
  info: '#2B6CB0',
  infoBg: '#EAF4FD',
  gray50: '#F8FAFC',
  gray100: '#EEF2F6',
  shadow: 'rgba(15, 79, 134, 0.16)',
};

export const S = {
  pageMax: 1180,
  readingMax: 940,
  radius: 14,
  radiusLg: 20,
  space: 16,
};

export function Card({ children, style, elevated = false }: { children: React.ReactNode; style?: any; elevated?: boolean }) {
  return <View style={[styles.card, elevated && styles.cardElevated, style]}>{children}</View>;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.pageHeaderActions}>{actions}</View> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  size = 'md',
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  disabled?: boolean;
  loading?: boolean;
  style?: any;
  size?: 'sm' | 'md' | 'lg';
  accessibilityLabel?: string;
}) {
  const isSolid = variant === 'primary' || variant === 'danger' || variant === 'success';
  const bg = variant === 'primary' ? C.primary : variant === 'danger' ? C.red : variant === 'success' ? C.green : 'transparent';
  const fg = isSolid ? C.white : variant === 'ghost' ? C.primary : C.primaryDark;
  const border = variant === 'secondary' ? C.borderStrong : variant === 'ghost' ? 'transparent' : bg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        size === 'lg' && styles.buttonLg,
        { backgroundColor: disabled ? '#C9D7E4' : bg, borderColor: border },
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        pressed && !disabled && !loading && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.buttonText, size === 'sm' && styles.buttonTextSm, { color: disabled && !isSolid ? C.textMuted : fg }]}>{title}</Text>
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
  disabled,
  hint,
  accessibilityLabel,
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
  disabled?: boolean;
  hint?: string;
  accessibilityLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inputWrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput
        accessibilityLabel={accessibilityLabel || label || placeholder}
        accessibilityState={{ disabled: Boolean(disabled) }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          disabled && styles.inputDisabled,
          multiline && styles.inputMultiline,
        ]}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Alert({
  tone = 'info',
  title,
  message,
  action,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  action?: React.ReactNode;
}) {
  const map = {
    info: { bg: C.infoBg, border: '#B9D9F4', color: C.info, mark: 'i' },
    success: { bg: C.greenBg, border: '#B7E5D8', color: C.green, mark: '✓' },
    warning: { bg: C.amberBg, border: '#F2D5A5', color: C.amber, mark: '!' },
    error: { bg: C.redBg, border: '#F2C0C7', color: C.red, mark: '!' },
  }[tone];
  return (
    <View accessibilityRole="alert" style={[styles.alert, { backgroundColor: map.bg, borderColor: map.border }]}>
      <View style={[styles.alertMark, { backgroundColor: map.color }]}><Text style={styles.alertMarkText}>{map.mark}</Text></View>
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={[styles.alertTitle, { color: map.color }]}>{title}</Text> : null}
        <Text style={[styles.alertText, { color: tone === 'error' ? '#8F2631' : C.text}]}>{message}</Text>
      </View>
      {action ? <View style={styles.alertAction}>{action}</View> : null}
    </View>
  );
}

export function Badge({ status, small }: { status: string; small?: boolean }) {
  const normalized = String(status || 'unknown').toLowerCase();
  const colors: Record<string, { bg: string; fg: string; dot: string }> = {
    active: { bg: C.greenBg, fg: C.green, dot: C.green },
    safe: { bg: C.greenBg, fg: C.green, dot: C.green },
    success: { bg: C.greenBg, fg: C.green, dot: C.green },
    approved: { bg: C.greenBg, fg: C.green, dot: C.green },
    printed: { bg: C.greenBg, fg: C.green, dot: C.green },
    recalled: { bg: C.redBg, fg: C.red, dot: C.red },
    substandard: { bg: C.redBg, fg: C.red, dot: C.red },
    spurious: { bg: C.redBg, fg: C.red, dot: C.red },
    falsified: { bg: C.redBg, fg: C.red, dot: C.red },
    unregistered: { bg: C.redBg, fg: C.red, dot: C.red },
    rejected: { bg: C.redBg, fg: C.red, dot: C.red },
    discontinued: { bg: C.amberBg, fg: C.amber, dot: C.amber },
    suspended: { bg: C.amberBg, fg: C.amber, dot: C.amber },
    cancelled: { bg: C.amberBg, fg: C.amber, dot: C.amber },
    expired: { bg: C.amberBg, fg: C.amber, dot: C.amber },
    draft: { bg: C.amberBg, fg: C.amber, dot: C.amber },
    pending: { bg: C.amberBg, fg: C.amber, dot: C.amber },
    patient: { bg: C.infoBg, fg: C.info, dot: C.info },
    doctor: { bg: '#F0ECFF', fg: '#6046B2', dot: '#6046B2' },
    admin: { bg: '#E7EFF8', fg: C.navySoft, dot: C.navySoft },
    unknown: { bg: C.gray100, fg: C.textSecondary, dot: C.textMuted },
  };
  const tone = colors[normalized] || colors.unknown;
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }, small && styles.badgeSmall]}>
      <View style={[styles.badgeDot, { backgroundColor: tone.dot }, small && styles.badgeDotSmall]} />
      <Text style={[styles.badgeText, { color: tone.fg }, small && styles.badgeTextSmall]}>{normalized.replace(/_/g, ' ')}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
  icon = '⌁',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}><Text style={styles.emptyIcon}>{icon}</Text></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function Spinner({ label, compact = false }: { label?: string; compact?: boolean }) {
  return (
    <View style={[styles.spinnerWrap, compact && styles.spinnerCompact]} accessibilityRole="progressbar">
      <ActivityIndicator size={compact ? 'small' : 'large'} color={C.primary} />
      {label ? <Text style={styles.spinnerText}>{label}</Text> : null}
    </View>
  );
}

export function Skeleton({ width = '100%', height = 14, style }: { width?: number | string; height?: number; style?: any }) {
  return <View style={[styles.skeleton, { width, height }, style]} />;
}

export function LoadingPanel({ label = 'Loading data…' }: { label?: string }) {
  return (
    <Card style={styles.loadingPanel} elevated>
      <View style={{ gap: 12 }}>
        <Skeleton width="42%" height={18} />
        <Skeleton width="100%" />
        <Skeleton width="82%" />
      </View>
      <Spinner label={label} compact />
    </Card>
  );
}

// Simple bar chart for dashboards; avoids a visual dependency while preserving
// readable labels and an adaptable layout.
export function BarChart({ data, color = C.primary }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={styles.chart}>
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} style={styles.barColumn}>
          <Text style={styles.barValue}>{d.value}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.bar, { height: `${Math.max(9, (d.value / max) * 100)}%`, backgroundColor: color }]} />
          </View>
          <Text numberOfLines={1} style={styles.barLabel}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function PageShell({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: any }) {
  if (!scroll) return <View style={[styles.page, style]}>{children}</View>;
  return (
    <ScrollView style={[styles.page, style]} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

// Web-safe confirmation dialog. Alert.alert() buttons do not render on web.
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })), []);
  const done = useCallback((value: boolean) => {
    setState((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const dialog = state ? (
    <Modal visible transparent animationType="fade" onRequestClose={() => done(false)}>
      <Pressable style={styles.confirmOverlay} onPress={() => done(false)} accessibilityLabel="Close confirmation dialog">
        <Pressable style={styles.confirmSheet} onPress={(e: any) => e.stopPropagation?.()}>
          <View style={[styles.confirmIcon, { backgroundColor: state.danger ? C.redBg : C.infoBg }]}>
            <Text style={{ color: state.danger ? C.red : C.info, fontSize: 20, fontWeight: '800' }}>{state.danger ? '!' : '?'}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.confirmTitle}>{state.title}</Text>
          {state.message ? <Text style={styles.confirmMessage}>{state.message}</Text> : null}
          <View style={styles.confirmActions}>
            <Button title="Cancel" variant="secondary" onPress={() => done(false)} style={{ flex: 1 }} />
            <Button title={state.confirmLabel || 'Confirm'} variant={state.danger ? 'danger' : 'primary'} onPress={() => done(true)} style={{ flex: 1 }} />
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
    borderRadius: S.radiusLg,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardElevated: {
    shadowColor: C.navy,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  pageHeader: { flexDirection: 'row', gap: 18, alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap' },
  pageHeaderCopy: { flex: 1, minWidth: 220, gap: 5 },
  eyebrow: { color: C.primary, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  pageTitle: { color: C.navy, fontSize: 29, fontWeight: '800', letterSpacing: -0.5 },
  pageSubtitle: { color: C.textSecondary, fontSize: 14, lineHeight: 21, maxWidth: 720 },
  pageHeaderActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  button: { borderRadius: 11, paddingHorizontal: 17, paddingVertical: 11, minHeight: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonSm: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9 },
  buttonLg: { minHeight: 50, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 13 },
  buttonSecondary: { backgroundColor: C.white },
  buttonGhost: { paddingHorizontal: 10, backgroundColor: 'transparent' },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  buttonText: { fontWeight: '800', fontSize: 14 },
  buttonTextSm: { fontSize: 12.5 },
  inputWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800', color: C.text },
  hint: { fontSize: 12, color: C.textSecondary, lineHeight: 17 },
  input: { borderWidth: 1, borderColor: C.borderStrong, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, minHeight: 44, fontSize: 14.5, backgroundColor: C.white, color: C.text },
  inputFocused: { borderColor: C.primary, shadowColor: C.primary, shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  inputError: { borderColor: C.red, backgroundColor: '#FFF9FA' },
  inputDisabled: { backgroundColor: C.gray100, color: C.textMuted },
  inputMultiline: { height: 110, textAlignVertical: 'top' },
  errorText: { color: C.red, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 13, padding: 12 },
  alertMark: { height: 20, width: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  alertMarkText: { color: C.white, fontWeight: '800', fontSize: 12 },
  alertTitle: { fontSize: 13.5, fontWeight: '800' },
  alertText: { fontSize: 13, lineHeight: 19 },
  alertAction: { alignSelf: 'center' },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgeSmall: { paddingHorizontal: 7, paddingVertical: 3 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeDotSmall: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontWeight: '800', fontSize: 11.5, textTransform: 'capitalize' },
  badgeTextSmall: { fontSize: 10 },
  empty: { alignItems: 'center', paddingVertical: 38, paddingHorizontal: 20, gap: 7, maxWidth: 500, alignSelf: 'center' },
  emptyIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  emptyIcon: { color: C.primary, fontSize: 24, fontWeight: '800' },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: C.text, textAlign: 'center' },
  emptySub: { fontSize: 13, lineHeight: 19, color: C.textSecondary, textAlign: 'center' },
  emptyAction: { marginTop: 7 },
  spinnerWrap: { paddingVertical: 30, alignItems: 'center', gap: 10 },
  spinnerCompact: { paddingVertical: 6, flexDirection: 'row', justifyContent: 'center' },
  spinnerText: { color: C.textSecondary, fontSize: 13.5 },
  skeleton: { backgroundColor: C.gray100, borderRadius: 8 },
  loadingPanel: { gap: 12, paddingVertical: 24 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, minHeight: 155, paddingTop: 14 },
  barColumn: { flex: 1, alignItems: 'center', gap: 5 },
  barValue: { fontSize: 11, fontWeight: '700', color: C.textSecondary },
  barTrack: { height: 96, width: '70%', borderRadius: 8, backgroundColor: C.gray100, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8 },
  barLabel: { fontSize: 10, color: C.textSecondary, textAlign: 'center', maxWidth: 70 },
  page: { flex: 1, backgroundColor: C.aliceBlue },
  pageContent: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 64, gap: 18, maxWidth: S.pageMax, width: '100%', alignSelf: 'center' as const },
  sectionHeading: { gap: 3 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.navy, letterSpacing: -0.15 },
  sectionSubtitle: { fontSize: 12.5, color: C.textSecondary, lineHeight: 18 },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(7, 25, 45, 0.52)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  confirmSheet: { backgroundColor: C.white, borderRadius: 20, padding: 24, width: '100%', maxWidth: 430, shadowColor: C.navy, shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  confirmIcon: { height: 42, width: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  confirmTitle: { fontSize: 20, fontWeight: '800', color: C.navy },
  confirmMessage: { fontSize: 14, color: C.textSecondary, marginTop: 8, lineHeight: 21 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
});
