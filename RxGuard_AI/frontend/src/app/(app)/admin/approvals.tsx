import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { api } from '@/lib/api';
import { Card, C, EmptyState, PageShell, SectionTitle, Spinner, useConfirm } from '@/components/ui';

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
    return <View style={{ flex: 1, justifyContent: 'center' }}><Spinner label="Loading pending approvals..." /></View>;
  }

  return (
    <PageShell>
      {dialog}
      <View>
        <Text style={styles.title}>Doctor Approvals</Text>
        <Text style={styles.subtitle}>
          Verify doctor credentials (license number and clinic) before they can save and print prescriptions.
        </Text>
      </View>

      {error ? <Card><Text style={{ color: C.red }}>{error}</Text></Card> : null}

      <Card>
        <SectionTitle>{pending.length} pending registration{pending.length === 1 ? '' : 's'}</SectionTitle>
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
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Pressable
                      style={[styles.btn, busyId === d.user_id && { opacity: 0.5 }]}
                      disabled={busyId === d.user_id}
                      onPress={() => decide(d, 'approved')}
                    >
                      <Text style={styles.btnText}>✓ Approve</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btnReject, busyId === d.user_id && { opacity: 0.5 }]}
                      disabled={busyId === d.user_id}
                      onPress={() => decide(d, 'rejected')}
                    >
                      <Text style={styles.btnRejectText}>✕ Reject</Text>
                    </Pressable>
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
  title: { fontSize: 24, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.gray50,
    padding: 16,
  },
  cardRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
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
  btn: {
    backgroundColor: C.green,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  btnText: { color: C.white, fontWeight: '700', fontSize: 13.5 },
  btnReject: {
    borderWidth: 1.5,
    borderColor: C.red,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: C.white,
  },
  btnRejectText: { color: C.red, fontWeight: '700', fontSize: 13.5 },
});
