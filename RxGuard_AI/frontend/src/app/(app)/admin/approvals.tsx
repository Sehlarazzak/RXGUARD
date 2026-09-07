import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { api } from '@/lib/api';
import { Alert, Button, Card, C, EmptyState, LoadingPanel, PageHeader, PageShell, SectionTitle, useConfirm } from '@/components/ui';

interface PendingDoctor {
  user_id: string;
  email: string;
  full_name: string;
  cnic: string;
  phone: string | null;
  license_number: string | null;
  clinic_name: string | null;
  created_at: string;
}

export default function AdminApprovalsPage() {
  const [pending, setPending] = useState<PendingDoctor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isMobile = width < 860;
  const { ask, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ pending: PendingDoctor[] }>('/admin/approvals');
      setPending(res.pending);
    } catch (e: any) {
      setError(e.message);
      setPending([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (d: PendingDoctor, decision: 'approved' | 'rejected') => {
    const ok = await ask({
      title: decision === 'approved' ? 'Approve doctor' : 'Reject doctor',
      message: `${decision === 'approved' ? 'Verify and approve' : 'Reject'} the registration of ${d.full_name}?`,
      confirmLabel: decision === 'approved' ? 'Approve' : 'Reject',
      danger: decision === 'rejected',
    });
    if (!ok) return;
    setBusyId(d.user_id);
    try {
      await api.post(`/admin/approvals/${d.user_id}`, { decision });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (pending === null) {
    return (
      <PageShell>
        <PageHeader eyebrow="Administration" title="Doctor approvals" subtitle="Review doctor registration details before prescription permissions are enabled." />
        <LoadingPanel label="Loading pending registrations…" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {dialog}
      <PageHeader
        eyebrow="Administration"
        title="Doctor approvals"
        subtitle="Review registration details before a doctor can save and print prescriptions."
      />

      {error ? <Alert tone="error" title="Could not update approvals" message={error} action={<Button title="Retry" size="sm" variant="secondary" onPress={load} />} /> : null}

      <Card elevated>
        <SectionTitle subtitle="Approval enables prescription draft saving and printing.">{pending.length} pending registration{pending.length === 1 ? '' : 's'}</SectionTitle>
        {pending.length === 0 ? (
          <View style={{ marginTop: 10 }}>
            <EmptyState title="No pending approvals." subtitle="New doctor registrations will appear here for verification." />
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 12 }}>
            {pending.map((d) => (
              <View key={d.user_id} style={styles.card}>
                <View style={[styles.cardRow, isMobile && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1, gap: 6, minWidth: 200 }}>
                    <Text style={styles.name}>{d.full_name}</Text>
                    <Text style={styles.meta}>{d.email}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Chip label={`CNIC ${d.cnic || '—'}`} />
                      <Chip label={`License ${d.license_number || '—'}`} />
                      <Chip label={d.clinic_name || 'No clinic'} />
                      {d.phone ? <Chip label={d.phone} /> : null}
                    </View>
                    <Text style={styles.date}>Registered {new Date(d.created_at).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.actionRow, isMobile && styles.actionRowMobile]}>
                    <Button
                      title="Approve"
                      variant="success"
                      size="sm"
                      disabled={busyId === d.user_id}
                      onPress={() => decide(d, 'approved')}
                    />
                    <Button
                      title="Reject"
                      variant="danger"
                      size="sm"
                      disabled={busyId === d.user_id}
                      onPress={() => decide(d, 'rejected')}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </PageShell>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.gray50,
    padding: 16,
  },
  cardRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionRowMobile: { width: '100%', justifyContent: 'flex-start' },
  name: { fontSize: 16.5, fontWeight: '800', color: C.text },
  meta: { fontSize: 13, color: C.textSecondary },
  chip: {
    backgroundColor: C.aliceBlue,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  chipText: { fontSize: 11.5, color: C.primaryDark, fontWeight: '600' },
  date: { fontSize: 11.5, color: C.textSecondary },
});
