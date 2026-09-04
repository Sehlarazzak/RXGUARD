import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Card, C, EmptyState, PageShell, SectionTitle, Spinner, useConfirm } from '@/components/ui';

interface PatientFile {
  file_id: string;
  patient_name: string;
  created_at: string;
  prescription_count: number;
  last_updated: string | null;
}

export default function PastPrescriptionsPage() {
  const router = useRouter();
  const [files, setFiles] = useState<PatientFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isMobile = width < 860;
  const { ask, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ files: PatientFile[] }>('/prescriptions/files');
      setFiles(res.files);
    } catch (e: any) {
      setError(e.message);
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteFolder = async (f: PatientFile) => {
    const ok = await ask({
      title: 'Delete Patient File',
      message: `Delete the folder for ${f.patient_name} and all prescriptions in it?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/prescriptions/files/${f.file_id}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (files === null) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><Spinner label="Loading your patient files..." /></View>;
  }

  return (
    <PageShell>
      {dialog}
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Past Prescriptions</Text>
        <Text style={styles.subtitle}>Your saved prescriptions, organised in folders by patient name</Text>
      </View>

      {error ? <Card><Text style={{ color: C.red }}>{error}</Text></Card> : null}

      <Card>
        <SectionTitle>{files.length} patient file{files.length === 1 ? '' : 's'}</SectionTitle>
        <View style={[styles.grid, isMobile && { flexDirection: 'column' }]}>
          {files.length === 0 ? (
            <EmptyState
              title="No patient files yet."
              subtitle="Create your first file from the Prescribe New Patient page."
            />
          ) : (
            files.map((f) => (
              <View key={f.file_id} style={styles.folderCard}>
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/patients/${f.file_id}` as any)}>
                  <View style={styles.folderIcon}>🗂️</View>
                  <Text style={styles.folderName} numberOfLines={1}>{f.patient_name}</Text>
                  <Text style={styles.folderMeta}>
                    {f.prescription_count} prescription{Number(f.prescription_count) === 1 ? '' : 's'}
                  </Text>
                  {f.last_updated ? (
                    <Text style={styles.folderDate}>Updated {new Date(f.last_updated).toLocaleDateString()}</Text>
                  ) : (
                    <Text style={styles.folderDate}>Created {new Date(f.created_at).toLocaleDateString()}</Text>
                  )}
                </Pressable>
                <Pressable style={styles.deleteBtn} onPress={() => deleteFolder(f)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </Card>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  folderCard: {
    width: 200,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.gray50,
    padding: 16,
    gap: 6,
  },
  folderIcon: { fontSize: 30 },
  folderName: { fontSize: 15.5, fontWeight: '800', color: C.text, marginTop: 4 },
  folderMeta: { fontSize: 12.5, color: C.primary, fontWeight: '600' },
  folderDate: { fontSize: 11.5, color: C.textSecondary },
  deleteBtn: { alignSelf: 'flex-start', marginTop: 6 },
  deleteBtnText: { color: C.red, fontWeight: '700', fontSize: 12 },
});
