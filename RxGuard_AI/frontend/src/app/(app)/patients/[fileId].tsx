import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Badge, Card, C, EmptyState, PageShell, SectionTitle, Spinner, useConfirm } from '@/components/ui';

interface FolderPrescription {
  dp_id: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function PatientFolderPage() {
  const { fileId } = useLocalSearchParams<{ fileId: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isMobile = width < 860;
  const rxMaxHeight = Math.max(280, Math.min(560, (height || 800) - 360));
  const { ask, dialog } = useConfirm();

  const [folder, setFolder] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<FolderPrescription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!fileId) return;
    try {
      const res = await api.get<{ file: any; prescriptions: FolderPrescription[] }>(`/prescriptions/files/${fileId}`);
      setFolder(res.file);
      setPrescriptions(res.prescriptions);
    } catch (e: any) {
      setError(e.message);
      setPrescriptions([]);
    }
  }, [fileId]);

  useEffect(() => {
    load();
  }, [load]);

  const deletePrescription = async (p: FolderPrescription) => {
    const ok = await ask({
      title: 'Delete Prescription',
      message: 'Delete this prescription permanently?',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/prescriptions/draft/${p.dp_id}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!prescriptions) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><Spinner label="Loading patient folder..." /></View>;
  }

  return (
    <PageShell>
      {dialog}
      <Pressable style={styles.backBtn} onPress={() => router.push('/patients' as any)}>
        <Text style={styles.backText}>← All patient files</Text>
      </Pressable>

      {error ? <Card><Text style={{ color: C.red }}>{error}</Text></Card> : null}

      <View style={styles.header}>
        <Text style={styles.folderIcon}>🗂️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{folder?.patient_name || 'Patient'}</Text>
          <Text style={styles.subtitle}>
            {prescriptions.length} prescription{prescriptions.length === 1 ? '' : 's'} · folder created{' '}
            {folder ? new Date(folder.created_at).toLocaleDateString() : ''}
          </Text>
        </View>
        <Pressable
          style={styles.newBtn}
          onPress={() => router.push({ pathname: '/prescribe', params: { fileId: fileId as string } } as any)}
        >
          <Text style={styles.newBtnText}>+ New prescription</Text>
        </Pressable>
      </View>

      <Card>
        <SectionTitle>Prescriptions</SectionTitle>
        {prescriptions.length === 0 ? (
          <View style={{ marginTop: 10 }}>
            <EmptyState
              title="No prescriptions in this folder."
              subtitle="Create one from the Prescribe New Patient page."
            />
          </View>
        ) : (
          <ScrollView style={{ marginTop: 12, maxHeight: rxMaxHeight }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
            {prescriptions.map((p) => {
              const open = expanded === p.dp_id;
              return (
                <View key={p.dp_id} style={styles.rxCard}>
                  <Pressable
                    style={styles.rxHeader}
                    onPress={() => setExpanded(open ? null : p.dp_id)}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.rxTitle}>Prescription · {new Date(p.updated_at).toLocaleDateString()}</Text>
                      <Text style={styles.rxMeta}>
                        Updated {new Date(p.updated_at).toLocaleString()}
                      </Text>
                    </View>
                    <Badge status={p.status} small />
                    <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
                  </Pressable>

                  {open ? (
                    <View style={styles.rxBody}>
                      <Text style={styles.rxContent}>{p.content}</Text>
                      <View style={[styles.rxActions, isMobile && { flexDirection: 'column' }]}>
                        <Pressable
                          style={styles.editBtn}
                          onPress={() =>
                            router.push({
                              pathname: '/prescribe',
                              params: { fileId: fileId as string, dpId: p.dp_id },
                            } as any)
                          }
                        >
                          <Text style={styles.editBtnText}>Open in notepad</Text>
                        </Pressable>
                        <Pressable style={styles.delBtn} onPress={() => deletePrescription(p)}>
                          <Text style={styles.delBtnText}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </Card>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: C.primary, fontWeight: '700', fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  folderIcon: { fontSize: 34 },
  title: { fontSize: 24, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 13.5, color: C.textSecondary, marginTop: 2 },
  newBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newBtnText: { color: C.white, fontWeight: '700', fontSize: 13.5 },
  rxCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.gray50,
    overflow: 'hidden',
  },
  rxHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  rxTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  rxMeta: { fontSize: 12, color: C.textSecondary },
  chevron: { fontSize: 14, color: C.textSecondary },
  rxBody: { borderTopWidth: 1, borderTopColor: C.border, padding: 14, gap: 12 },
  rxContent: {
    fontFamily: 'Georgia, serif',
    fontSize: 14.5,
    lineHeight: 24,
    color: C.text,
    backgroundColor: C.white,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  rxActions: { flexDirection: 'row', gap: 10 },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: C.primary,
  },
  editBtnText: { color: C.white, fontWeight: '700', fontSize: 12.5 },
  delBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: C.red,
    backgroundColor: C.white,
  },
  delBtnText: { color: C.red, fontWeight: '700', fontSize: 12.5 },
});
