import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Alert, Badge, Button, Card, C, EmptyState, LoadingPanel, PageHeader, PageShell, SectionTitle, useConfirm } from '@/components/ui';

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
    return <PageShell><LoadingPanel label="Loading patient file…" /></PageShell>;
  }

  return (
    <PageShell>
      {dialog}
      <Pressable accessibilityRole="link" style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={() => router.push('/patients' as any)}>
        <Text style={styles.backText}>← All patient files</Text>
      </Pressable>

      {error ? <Alert tone="error" title="Unable to update this patient file" message={error} /> : null}

      <View style={styles.header}>
        <View style={styles.folderIcon}><Text style={styles.folderIconText}>▤</Text></View>
        <PageHeader eyebrow="Patient file" title={folder?.patient_name || 'Patient'} subtitle={`${prescriptions.length} prescription${prescriptions.length === 1 ? '' : 's'} · folder created ${folder ? new Date(folder.created_at).toLocaleDateString() : ''}`} actions={<Button title="New prescription" onPress={() => router.push({ pathname: '/prescribe', params: { fileId: fileId as string } } as any)} />} />
      </View>

      <Card style={styles.prescriptionCard}>
        <SectionTitle subtitle="Open a saved prescription to view or continue it in the notepad.">Prescriptions</SectionTitle>
        {prescriptions.length === 0 ? (
          <View style={{ marginTop: 10 }}>
            <EmptyState title="No prescriptions in this patient file." subtitle="Create one from the prescribing workspace." action={<Button title="New prescription" size="sm" onPress={() => router.push({ pathname: '/prescribe', params: { fileId: fileId as string } } as any)} />} />
          </View>
        ) : (
          <ScrollView style={{ marginTop: 12, maxHeight: rxMaxHeight }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
            {prescriptions.map((p) => {
              const open = expanded === p.dp_id;
              return (
                <View key={p.dp_id} style={styles.rxCard}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} style={({ pressed }) => [styles.rxHeader, pressed && styles.pressed]} onPress={() => setExpanded(open ? null : p.dp_id)}>
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
                      <View style={[styles.rxActions, isMobile && styles.rxActionsMobile]}>
                        <Button title="Open in notepad" variant="secondary" onPress={() => router.push({ pathname: '/prescribe', params: { fileId: fileId as string, dpId: p.dp_id } } as any)} />
                        <Button title="Delete" variant="danger" onPress={() => deletePrescription(p)} />
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
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: C.primaryDark, fontWeight: '800', fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  folderIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  folderIconText: { color: C.primaryDark, fontSize: 18, fontWeight: '900' },
  prescriptionCard: { paddingBottom: 16 },
  rxCard: { borderWidth: 1, borderColor: C.border, borderRadius: 13, backgroundColor: C.gray50, overflow: 'hidden' },
  rxHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  rxTitle: { fontSize: 14, fontWeight: '900', color: C.text },
  rxMeta: { fontSize: 11.5, color: C.textSecondary },
  chevron: { fontSize: 14, color: C.textSecondary, fontWeight: '800' },
  rxBody: { borderTopWidth: 1, borderTopColor: C.border, padding: 14, gap: 12 },
  rxContent: { fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 23, color: C.text, backgroundColor: C.white, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  rxActions: { flexDirection: 'row', gap: 10 },
  rxActionsMobile: { flexDirection: 'column' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
