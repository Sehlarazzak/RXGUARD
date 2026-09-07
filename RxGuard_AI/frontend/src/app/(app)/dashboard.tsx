import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { Alert, BarChart, Badge, Button, Card, C, EmptyState, LoadingPanel, PageHeader, PageShell, SectionTitle } from '@/components/ui';

interface DashboardData {
  role: string;
  stats: Record<string, number>;
  recent: any[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const isMobile = width < 860;
  const recentMaxHeight = Math.max(280, Math.min(560, (height || 800) - 360));

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<DashboardData>('/history/dashboard');
      setData(res);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <PageShell>
        <PageHeader eyebrow="Workspace overview" title="Your RxGuard dashboard" subtitle="Your latest activity and role-specific shortcuts." />
        <Alert tone="error" title="Dashboard unavailable" message={error} action={<Button title="Try again" size="sm" variant="secondary" onPress={load} />} />
      </PageShell>
    );
  }
  if (!data) {
    return <PageShell><LoadingPanel label="Loading your dashboard…" /></PageShell>;
  }

  const role = user?.role;

  const statCards = (() => {
    if (role === 'patient') {
      return [
        { label: 'Total Prescriptions', value: data.stats.total_prescriptions ?? 0 },
        { label: 'Successful Saves', value: data.stats.successful ?? 0 },
        { label: 'Saved This Week', value: data.stats.this_week ?? 0 },
      ];
    }
    if (role === 'doctor') {
      return [
        { label: 'Patient Files', value: data.stats.patient_files ?? 0 },
        { label: 'Prescriptions', value: data.stats.total_prescriptions ?? 0 },
        { label: 'This Week', value: data.stats.this_week ?? 0 },
      ];
    }
    return [
      { label: 'Total Searches', value: data.stats.total_searches ?? 0 },
      { label: 'Searches This Week', value: data.stats.this_week ?? 0 },
      { label: 'Your Role', value: null as any },
    ];
  })();

  const greeting = user?.full_name ? `Welcome back, ${user.full_name}` : 'Welcome back';

  const title = role === 'patient' ? 'Your medication records, at a glance.' : role === 'doctor' ? 'A clearer view of your prescribing workflow.' : 'Keep the RxGuard registry moving.';
  const subtitle = role === 'patient'
    ? 'Review saved prescription records and search medicine safety information.'
    : role === 'doctor'
    ? 'Manage patient files, review typed prescriptions, and search the registry.'
    : 'Review registry activity, manage users, and follow up on approvals.';
  const actions = role === 'doctor'
    ? <><Button title="Find medicine" variant="secondary" onPress={() => router.push('/search' as any)} /><Button title="New prescription" onPress={() => router.push('/prescribe' as any)} /></>
    : role === 'patient'
    ? <><Button title="My records" variant="secondary" onPress={() => router.push('/prescriptions' as any)} /><Button title="Find medicine" onPress={() => router.push('/search' as any)} /></>
    : <><Button title="Manage users" variant="secondary" onPress={() => router.push('/admin/users' as any)} /><Button title="Open registry" onPress={() => router.push('/admin' as any)} /></>;

  const quickActions = role === 'patient'
    ? [{ glyph: '⌕', title: 'Search the registry', body: 'Look up a medicine, ingredient, batch, or manufacturer.', href: '/search' }, { glyph: '▤', title: 'Save a record', body: 'Keep an uploaded prescription record available when you need it.', href: '/prescriptions' }]
    : role === 'doctor'
    ? [{ glyph: '✎', title: 'Start prescribing', body: 'Create or select a patient file and review typed medicines.', href: '/prescribe' }, { glyph: '▤', title: 'Open patient files', body: 'Review patients and their recorded prescriptions.', href: '/patients' }]
    : [{ glyph: '▦', title: 'Review registry', body: 'Search and maintain medicine records and safety data.', href: '/admin' }, { glyph: '✓', title: 'Review approvals', body: 'Follow up on doctor account approvals.', href: '/admin/approvals' }];

  return (
    <PageShell>
      <PageHeader eyebrow={`${role || 'account'} workspace`} title={greeting} subtitle={title} actions={actions} />

      {role === 'doctor' && user?.approval_status !== 'approved' ? (
        <Alert tone="warning" title="Prescription access is pending" message="You can browse and search medicines now. Prescribing becomes available once an administrator approves your license." />
      ) : null}

      <View style={[styles.statsRow, isMobile && styles.statsRowMobile]}>
        {statCards.map((s, i) => (
          <Card key={i} style={styles.statCard} elevated>
            <View style={[styles.statIcon, i === 1 && styles.statIconAlt, i === 2 && styles.statIconSoft]}><Text style={styles.statIconText}>{i === 0 ? '◷' : i === 1 ? '▤' : '⌁'}</Text></View>
            <Text style={styles.statValue}>{s.value === null ? 'Admin' : s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </Card>
        ))}
      </View>

      <View style={styles.workspaceIntro}><SectionTitle subtitle={subtitle}>Continue where you left off</SectionTitle></View>
      <View style={[styles.quickGrid, isMobile && styles.quickGridMobile]}>
        {quickActions.map((item) => <QuickAction key={item.href} {...item} onPress={() => router.push(item.href as any)} />)}
      </View>

      {role === 'admin' ? <AdminCharts /> : null}

      <Card style={styles.recentCard}>
        <SectionTitle subtitle="Select an item to continue in its relevant workspace.">{role === 'patient' ? 'Recent prescription records' : role === 'doctor' ? 'Recent patient files' : 'Recent searches'}</SectionTitle>
        <ScrollView style={{ marginTop: 14, maxHeight: recentMaxHeight }} contentContainerStyle={{ gap: 9 }} showsVerticalScrollIndicator={false}>
          {data.recent.length === 0 ? (
            <EmptyState
              title={role === 'patient' ? 'No prescription records yet.' : role === 'doctor' ? 'No patient files yet.' : 'No searches yet.'}
              subtitle={role === 'patient' ? 'Save a prescription record to keep it available here.' : role === 'doctor' ? 'Start a prescription to create your first patient file.' : 'Search the medicine registry to see activity here.'}
              action={<Button title={role === 'doctor' ? 'Start prescribing' : 'Search medicines'} size="sm" onPress={() => router.push((role === 'doctor' ? '/prescribe' : '/search') as any)} />}
            />
          ) : (
            data.recent.map((r: any) => (
              <Pressable
                key={r.prescription_id || r.file_id || r.search_id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${r.title || r.patient_name || r.query}`}
                style={({ pressed }) => [styles.recentItem, pressed && styles.pressed]}
                onPress={() => {
                  if (role === 'patient') router.push(`/prescription/${r.prescription_id}` as any);
                  else if (role === 'doctor') router.push(`/patients/${r.file_id}` as any);
                  else router.push('/search' as any);
                }}
              >
                <View style={styles.recentAvatar}><Text style={styles.recentAvatarText}>{(r.title || r.patient_name || r.query || 'R').slice(0, 1).toUpperCase()}</Text></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.recentTitle} numberOfLines={1}>{r.title || r.patient_name || r.query}</Text>
                  <Text style={styles.recentDate}>{new Date(r.created_at || r.last_updated).toLocaleString()}</Text>
                </View>
                {r.status ? <Badge status={r.status} small /> : null}
                <Text style={styles.viewText}>View →</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </Card>
    </PageShell>
  );
}

function QuickAction({ glyph, title, body, onPress }: { glyph: string; title: string; body: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]} onPress={onPress}><View style={styles.quickIcon}><Text style={styles.quickIconText}>{glyph}</Text></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickBody}>{body}</Text></View><Text style={styles.quickArrow}>→</Text></Pressable>;
}

function AdminCharts() {
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    api.get('/admin/summary').then(setSummary).catch(() => undefined);
  }, []);
  if (!summary) return null;
  const dist = summary.statusDistribution || [];
  return (
    <Card>
      <SectionTitle>Medicine Safety Distribution</SectionTitle>
      <Text style={styles.chartHint}>Live data from the RxGuard drug database</Text>
      <BarChart data={dist.map((d: any) => ({ label: d.status, value: Number(d.count) }))} />
    </Card>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 14 },
  statsRowMobile: { flexDirection: 'column' },
  statCard: { flex: 1, minHeight: 150, padding: 19, justifyContent: 'center', gap: 4 },
  statIcon: { height: 29, width: 29, borderRadius: 10, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statIconAlt: { backgroundColor: C.greenBg },
  statIconSoft: { backgroundColor: C.infoBg },
  statIconText: { color: C.primaryDark, fontSize: 14, fontWeight: '900' },
  statValue: { fontSize: 32, fontWeight: '900', color: C.navy, letterSpacing: -0.5 },
  statLabel: { fontSize: 12.5, color: C.textSecondary, fontWeight: '700' },
  workspaceIntro: { marginTop: 3 },
  quickGrid: { flexDirection: 'row', gap: 14 },
  quickGridMobile: { flexDirection: 'column' },
  quickCard: { flex: 1, minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border },
  quickIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.gray100, alignItems: 'center', justifyContent: 'center' },
  quickIconText: { color: C.primaryDark, fontSize: 17, fontWeight: '900' },
  quickTitle: { color: C.navy, fontSize: 14, fontWeight: '900' },
  quickBody: { color: C.textSecondary, fontSize: 11.5, lineHeight: 16 },
  quickArrow: { color: C.primary, fontWeight: '900', fontSize: 17 },
  chartHint: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  recentCard: { paddingBottom: 16 },
  recentItem: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 13, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border },
  recentAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  recentAvatarText: { color: C.primaryDark, fontSize: 13, fontWeight: '900' },
  recentTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  recentDate: { fontSize: 11.5, color: C.textSecondary },
  viewText: { color: C.primaryDark, fontWeight: '800', fontSize: 12 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
