import React, { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { api, imageUrl } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { Badge, Button, Card, C, EmptyState, Input, PageShell, SectionTitle, Spinner, useConfirm } from '@/components/ui';

interface Prescription {
  prescription_id: string;
  title: string;
  details: string | null;
  file_name: string | null;
  mime_type: string | null;
  status: string;
  created_at: string;
}

const DATE_PREFIX = '[rxdate:';
function parseDate(details: string | null): { date: string | null; rest: string } {
  if (!details) return { date: null, rest: '' };
  const m = details.match(/^\[rxdate:(\d{4}-\d{2}-\d{2})\]\s?([\s\S]*)$/);
  if (m) return { date: m[1], rest: m[2] };
  return { date: null, rest: details };
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MyPrescriptionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Prescription[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [rxDate, setRxDate] = useState(todayStr());
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isMobile = width < 860;
  const { ask, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ prescriptions: Prescription[] }>('/prescriptions/patient');
      setItems(res.prescriptions);
    } catch (e: any) {
      setError(e.message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pickImage = () => {
    // Create a temporary file input on web and click it
    if (typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => onFileChosen(e);
      input.click();
    }
  };

  const onFileChosen = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, etc.).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageBase64(String(reader.result));
      setImageName(file.name);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setError(null);
    setSuccess(null);
    if (!title.trim()) return setError('Please give your prescription a name.');

    setBusy(true);
    try {
      const form = new FormData();
      form.append('title', title.trim());
      const combinedDetails = `${DATE_PREFIX}${rxDate}] ${details.trim()}`.trim();
      form.append('details', combinedDetails);
      if (imageBase64) {
        // Convert data URL to Blob for upload
        const res = await fetch(imageBase64);
        const blob = await res.blob();
        form.append('image', blob, imageName || 'prescription.jpg');
      }
      await api.upload('/prescriptions/patient', form);
      setSuccess('Prescription saved to your dashboard.');
      setTitle('');
      setDetails('');
      setRxDate(todayStr());
      setImageBase64(null);
      setImageName(null);
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const ok = await ask({
      title: 'Delete Prescription',
      message: 'Are you sure you want to delete this prescription?',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/prescriptions/patient/${id}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (items === null) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><Spinner label="Loading your prescriptions..." /></View>;
  }

  return (
    <PageShell>
      {dialog}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Prescriptions</Text>
          <Text style={styles.subtitle}>Save prescription photos with your own filename and date</Text>
        </View>
        <Button title="+ Save Prescription" onPress={() => setShowForm(!showForm)} />
      </View>

      {error ? <Card><Text style={{ color: C.red }}>{error}</Text></Card> : null}
      {success ? <Card><Text style={{ color: C.green }}>{success}</Text></Card> : null}

      {showForm ? (
        <Card>
          <SectionTitle>Save a Prescription</SectionTitle>
          <View style={{ gap: 12, marginTop: 12 }}>
            <Input label="Filename (your name for this prescription)" value={title} onChangeText={setTitle} placeholder="e.g. June Checkup 2025" autoCapitalize="words" />
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Date of prescription</Text>
              <input
                type="date"
                value={rxDate}
                onChange={(e: any) => setRxDate(e.target.value)}
                max={todayStr()}
                style={{
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 14,
                  backgroundColor: C.white,
                  color: C.text,
                  width: '100%',
                  boxSizing: 'border-box' as any,
                }}
              />
            </View>
            <Input label="Notes (optional)" value={details} onChangeText={setDetails} placeholder="Medicines, dosage notes..." multiline />
      
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Prescription Photo</Text>
              <Button title={imageBase64 ? 'Photo attached \u2713 \u2014 Choose another' : 'Upload a Photo'} variant="secondary" onPress={pickImage} />
              <Text style={styles.fileHint}>{imageName ? `Selected: ${imageName}` : 'JPG or PNG image'}</Text>
            </View>
      
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title={busy ? 'Saving...' : 'Save Prescription'} onPress={save} loading={busy} style={{ flex: 1 }} />
              <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} style={{ flex: 0, paddingHorizontal: 20 }} />
            </View>
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>{items.length} saved prescription{items.length === 1 ? '' : 's'}</SectionTitle>
        <View style={[styles.grid, isMobile && { flexDirection: 'column' }]}>
          {items.length === 0 ? (
            <EmptyState title="No prescriptions yet." subtitle="Save your first prescription photo to keep it as a personal record." />
          ) : (
            items.map((p) => {
              const { date } = parseDate(p.details);
              return (
                <View key={p.prescription_id} style={styles.prescCard}>
                  <Pressable onPress={() => p.file_name && setViewImage(imageUrl(p.prescription_id))}>
                    <View style={styles.thumbWrap}>
                      {p.file_name ? (
                        <img src={imageUrl(p.prescription_id)} style={styles.thumb} alt={p.title} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPlaceholder]}>
                          <Text style={styles.thumbIcon}>\u211E</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                  <View style={{ gap: 4, paddingHorizontal: 4 }}>
                    <Text style={styles.prescTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={styles.prescDate}>
                      {date ? `Rx date: ${new Date(date).toLocaleDateString()}` : `Uploaded: ${new Date(p.created_at).toLocaleDateString()}`}
                    </Text>
                    {p.details ? (() => {
                      const { rest } = parseDate(p.details);
                      return rest.trim() ? <Text style={styles.prescNotes} numberOfLines={2}>{rest}</Text> : null;
                    })() : null}
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 }}>
                      <Badge status={p.status} small />
                      {p.file_name ? (
                        <Pressable onPress={() => setViewImage(imageUrl(p.prescription_id))}>
                          <Text style={styles.viewText}>View</Text>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => remove(p.prescription_id)}>
                        <Text style={styles.deleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </Card>
      
      {/* Full-size image viewer */}
      {viewImage ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setViewImage(null)}>
          <Pressable style={styles.viewerOverlay} onPress={() => setViewImage(null)}>
            <img src={viewImage} style={styles.viewerImage} alt="Full prescription" />
            <Pressable style={styles.viewerClose} onPress={() => setViewImage(null)}>
              <Text style={{ color: C.white, fontWeight: '800', fontSize: 16 }}>\u2715 Close</Text>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: C.text },
  fileHint: { fontSize: 12, color: C.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14 },
  prescCard: { width: 168, gap: 6 },
  thumbWrap: { borderRadius: 12, overflow: 'hidden' },
  thumb: { width: 168, height: 126, borderRadius: 12, objectFit: 'cover' as any, backgroundColor: C.gray100 },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.aliceBlue,
    borderWidth: 1,
    borderColor: C.border,
  },
  thumbIcon: { fontSize: 42, color: C.primary, fontWeight: '800' },
  prescTitle: { fontSize: 14.5, fontWeight: '700', color: C.text },
  prescDate: { fontSize: 12, color: C.textSecondary },
  prescNotes: { fontSize: 11.5, color: C.textSecondary, lineHeight: 16 },
  viewText: { color: C.primary, fontWeight: '700', fontSize: 12 },
  deleteText: { color: C.red, fontWeight: '700', fontSize: 12 },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  viewerImage: {
    maxWidth: '90%',
    maxHeight: '85vh',
    borderRadius: 12,
    objectFit: 'contain' as any,
  } as any,
  viewerClose: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
});
