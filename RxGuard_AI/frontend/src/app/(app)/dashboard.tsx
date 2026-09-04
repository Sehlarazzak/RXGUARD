import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { api } from '@/lib/api';
import { BarChart, Badge, Card, C, EmptyState, PageShell, SectionTitle, Spinner } from '@/components/ui';

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
  const { width } = useWindowDimensions();
  const isMobile = width < 860;

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
        <Card><Text style={{ color: C.red }}>{error}</Text></Card>
      </PageShell>
    );
  }
  if (!data) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><Spinner label="Loading your dashboard..." /></View>;
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

  return (
    <PageShell>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{greeting}</Text>
          <Text style={styles.subtitle}>
            {role === 'patient'
              ? 'Your prescription records and medicine safety overview'
              : role === 'doctor'
              ? 'Your prescribing overview and patient files'
              : 'Your activity overview'}
          </Text>
        </View>
        {role === 'doctor' ? (
          <Pressable style={styles.newRxBtn} onPress={() => router.push('/prescribe' as any)}>
            <Text style={styles.newRxText}>+ Prescribe New Patient</Text>
          </Pressable>
        ) : null}
      </View>

      {role === 'doctor' && user?.approval_status !== 'approved' ? (
        <Card style={{ backgroundColor: C.amberBg, borderColor: '#FDE68A' }}>
          <Text style={{ color: C.amber, fontWeight: '700' }}>Your registration is pending administrator approval.</Text>
          <Text style={{ color: C.amber, fontSize: 13, marginTop: 4 }}>
            You can browse and search medicines, but prescribing will unlock once an admin approves your license.
          </Text>
        </Card>
      ) : null}

      <View style={[styles.statsRow, isMobile && { flexDirection: 'column' }]}>
        {statCards.map((s, i) => (
          <Card key={i} style={styles.statCard}>
            <Text style={styles.statValue}>{s.value === null ? 'Admin' : s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </Card>
        ))}
      </View>

      {role === 'admin' ? <AdminCharts /> : null}

      <Card>
        <SectionTitle>
          {role === 'patient' ? 'Recent Prescriptions' : role === 'doctor' ? 'Recent Patient Files' : 'Recent Searches'}
        </SectionTitle>
        <View style={{ gap: 10, marginTop: 12 }}>
          {data.recent.length === 0 ? (
            <EmptyState
              title={
                role === 'patient'
                  ? 'No prescriptions yet. Save your first prescription to see it here.'
                  : role === 'doctor'
                  ? 'No patient files yet. Start prescribing to build your records.'
                  : 'No searches yet. Use the search bar to look up medicines.'
              }
            />
          ) : (
            data.recent.map((r: any) => (
              <Pressable
                key={r.prescription_id || r.file_id || r.search_id}
                style={styles.recentItem}
                onPress={() => {
                  if (role === 'patient') router.push(`/prescription/${r.prescription_id}` as any);
                  else if (role === 'doctor') router.push(`/patients/${r.file_id}` as any);
                  else router.push('/search' as any);
                }}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {r.title || r.patient_name || r.query}
                  </Text>
                  <Text style={styles.recentDate}>{new Date(r.created_at || r.last_updated).toLocaleString()}</Text>
                </View>
                {r.status ? <Badge status={r.status} small /> : null}
                <Text style={{ color: C.primary, fontWeight: '700' }}>View →</Text>
              </Pressable>
            ))
          )}
        </View>
      </Card>
    </PageShell>
  );
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 2 },
  newRxBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  newRxText: { color: C.white, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 14 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 22 },
  statValue: { fontSize: 34, fontWeight: '800', color: C.primary },
  statLabel: { fontSize: 13, color: C.textSecondary, marginTop: 4, textAlign: 'center' },
  chartHint: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.gray50,
    borderWidth: 1,
    borderColor: C.border,
  },
  recentTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  recentDate: { fontSize: 12, color: C.textSecondary },
});
