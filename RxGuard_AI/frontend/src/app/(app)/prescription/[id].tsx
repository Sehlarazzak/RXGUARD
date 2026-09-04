import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, imageUrl } from '@/lib/api';
import { Badge, Card, C, EmptyState, Spinner } from '@/components/ui';

export default function PrescriptionDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [prescription, setPrescription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const { width } = useWindowDimensions();
  const isMobile = width < 860;

  useEffect(() => {
    if (!id) return;
    api.get(`/prescriptions/patient/${id}`)
      .then((r: any) => setPrescription(r.prescription))
      .catch((e: any) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <View style={styles.page}>
        <Card style={{ margin: 20, marginTop: 60 }}>
          <EmptyState title="Prescription not found" subtitle={error} />
          <Pressable style={styles.backBtn} onPress={() => router.push('/prescriptions' as any)}>
            <Text style={styles.backText}>← Back to My Prescriptions</Text>
          </Pressable>
        </Card>
      </View>
    );
  }
  if (!prescription) {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.aliceBlue }}><Spinner label="Loading prescription..." /></View>;
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable style={styles.backBtn} onPress={() => router.push('/prescriptions' as any)}>
        <Text style={styles.backText}>← Back to My Prescriptions</Text>
      </Pressable>

      <Card>
        <View style={[styles.headerRow, isMobile && { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.title}>{prescription.title}</Text>
            <Text style={styles.date}>Created {new Date(prescription.created_at).toLocaleString()}</Text>
            <Badge status={prescription.status} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Prescription Image</Text>
        <View style={{ marginTop: 12 }}>
          {prescription.file_name && !imgFailed ? (
            <img
              src={imageUrl(prescription.prescription_id)}
              style={styles.image as any}
              alt={prescription.title}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.placeholderIcon}>℞</Text>
              <Text style={styles.placeholderText}>
                {prescription.file_name ? 'Image not found' : 'No image was uploaded for this prescription'}
              </Text>
            </View>
          )}
        </View>
      </Card>

      {prescription.details ? (
        <Card>
          <Text style={styles.sectionTitle}>Details</Text>
          <Text style={styles.detailsText}>{prescription.details}</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Record Information</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          <InfoRow label="File name" value={prescription.file_name || '—'} />
          <InfoRow label="Status" value={prescription.status} />
          <InfoRow label="Created" value={new Date(prescription.created_at).toLocaleString()} />
          <InfoRow label="Last updated" value={new Date(prescription.updated_at).toLocaleString()} />
        </View>
      </Card>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.aliceBlue },
  content: { padding: 20, gap: 14, maxWidth: 900, width: '100%', alignSelf: 'center' as const, paddingBottom: 60 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: C.primary, fontWeight: '700', fontSize: 14 },
  headerRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  title: { fontSize: 24, fontWeight: '800', color: C.text },
  date: { fontSize: 13, color: C.textSecondary },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  image: {
    width: '100%',
    minHeight: 300,
    borderRadius: 14,
    objectFit: 'contain' as any,
    backgroundColor: C.gray50,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: 'dashed',
    paddingVertical: 60,
  },
  placeholderIcon: { fontSize: 48, color: C.primary },
  placeholderText: { fontSize: 14, color: C.textSecondary },
  detailsText: { fontSize: 15, color: C.text, lineHeight: 23, marginTop: 8 },
  infoLabel: { fontSize: 13, color: C.textSecondary },
  infoValue: { fontSize: 13, color: C.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
