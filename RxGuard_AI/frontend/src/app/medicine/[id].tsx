import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { Alert, Badge, Button, Card, C, EmptyState, SectionTitle, Spinner } from '@/components/ui';

export default function MedicineDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const isMobile = width < 860;

  useEffect(() => {
    if (!id) return;
    api.get(`/medicines/${id}`)
      .then((r: any) => setProduct(r.product))
      .catch((e: any) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card elevated>
            <EmptyState title="Medicine record unavailable" subtitle={error} />
            <View style={styles.errorActions}><Button title="Go back" variant="secondary" onPress={() => router.back()} /></View>
          </Card>
        </ScrollView>
      </View>
    );
  }
  if (!product) {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.aliceBlue }}><Spinner label="Loading medicine..." /></View>;
  }

  const isSafe = product.is_safe;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="link" style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back to results</Text>
      </Pressable>

      <Card style={styles.heroCard} elevated>
        <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>MEDICINE REGISTRY RECORD</Text>
            <Text accessibilityRole="header" style={styles.brand}>{product.brand_name}</Text>
            <Text style={styles.sub}>{product.dosage_form || 'Unknown form'} · {product.registration_number ? `Registration #${product.registration_number}` : 'No registration number displayed'}</Text>
            <View style={styles.statusLine}>
              <Badge status={product.safety_status} />
              <Text style={isSafe ? styles.safeText : styles.unsafeText}>{isSafe ? 'Registry status is currently marked safe.' : 'Registry status needs attention — review the alerts below.'}</Text>
            </View>
          </View>
          <View style={[styles.infoBox, isMobile && styles.infoBoxMobile]}>
            <Text style={styles.infoBoxTitle}>Record details</Text>
            <InfoRow label="Manufacturer" value={product.manufacturer_name || 'Unknown'} />
            <InfoRow label="Country" value={product.manufacturer_country || '—'} />
            <InfoRow label="Registration date" value={product.registration_date ? new Date(product.registration_date).toLocaleDateString() : '—'} />
          </View>
        </View>
      </Card>

      {!isSafe ? <Alert tone="warning" title="Review this registry status" message="This record is not currently marked safe. Review the associated batch and safety-alert information before making a medication decision." /> : null}

      <Card>
        <SectionTitle subtitle="Active ingredients and recorded strengths from this registry entry.">Ingredients</SectionTitle>
        {product.ingredients.length === 0 ? (
          <Text style={styles.muted}>No ingredient data available.</Text>
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            {product.ingredients.map((ing: any, i: number) => (
              <View key={i} style={styles.ingredientRow}>
                <Text style={styles.ingredientName}>{ing.name}</Text>
                <Text style={styles.ingredientStrength}>
                  {ing.strength_value ? `${ing.strength_value} ${ing.strength_unit || ''}` : ing.composition_text || '—'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {product.batches && product.batches.length > 0 ? (
        <Card>
          <SectionTitle subtitle="Recorded batches associated with this medicine.">Batch details</SectionTitle>
          <View style={{ gap: 10, marginTop: 10 }}>
            {product.batches.map((b: any) => (
              <View key={b.batch_id} style={styles.batchBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={styles.batchNumber}>Batch #{b.batch_number}</Text>
                  {b.classification ? <Badge status={b.classification.toLowerCase().includes('unregistered') ? 'unregistered' : 'substandard'} small /> : null}
                </View>
                <Text style={styles.batchMeta}>
                  Mfg: {b.manufacturing_date ? new Date(b.manufacturing_date).toLocaleDateString() : '—'} ·
                  Exp: {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : '—'}
                </Text>
                {b.remarks ? <Text style={styles.batchRemarks}>{b.remarks}</Text> : null}
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {product.notices && product.notices.length > 0 ? (
        <Card>
          <SectionTitle subtitle="Official safety notices linked to this medicine record.">Safety alerts</SectionTitle>
          <View style={{ gap: 12, marginTop: 10 }}>
            {product.notices.map((n: any) => (
              <View key={n.notice_id} style={styles.noticeBox}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge status={n.severity || 'unknown'} small />
                  <Text style={styles.noticeId}>{n.notice_identifier}</Text>
                  <Text style={styles.noticeDate}>{n.action_date ? new Date(n.action_date).toLocaleDateString() : ''}</Text>
                </View>
                <Text style={styles.noticeTitle}>{n.title}</Text>
                {n.problem_statement ? <Text style={styles.noticeBody}><Text style={{ fontWeight: '700' }}>Problem: </Text>{n.problem_statement}</Text> : null}
                {n.risk_statement ? <Text style={styles.noticeBody}><Text style={{ fontWeight: '700' }}>Risk: </Text>{n.risk_statement}</Text> : null}
                {n.action_initiated ? <Text style={styles.noticeBody}><Text style={{ fontWeight: '700' }}>Action: </Text>{n.action_initiated}</Text> : null}
                {n.source_name ? (
                  <Text style={styles.noticeSource}>Source: {n.source_name}{n.canonical_url ? ` — ${n.canonical_url}` : ''}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {!isSafe && user?.role !== 'patient' && product.alternatives && product.alternatives.length > 0 ? (
        <Card>
          <SectionTitle subtitle={product.ai_powered ? 'AI-ranked candidates from available active registry records.' : `Ranked by ingredient similarity to ${product.brand_name}.`}>Possible alternatives</SectionTitle>
          {product.ai_powered && product.ai_reason ? (
            <View style={styles.aiReasoning}>
              <View style={styles.aiReasoningHeader}><Text style={styles.aiLabel}>AI RANKING NOTE</Text><Text style={styles.aiPowered}>AI-powered</Text></View>
              <Text style={styles.aiReasoningText}>{product.ai_reason}</Text>
            </View>
          ) : <Text style={styles.muted}>These candidates are ranked from available registry information; the ranking is not a prescribing instruction.</Text>}
          <View style={{ gap: 10, marginTop: 12 }}>
            {product.alternatives.map((alt: any, idx: number) => (
              <Pressable
                key={alt.product_id}
                style={styles.altBox}
                onPress={() => router.push(`/medicine/${alt.product_id}` as any)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <Text style={styles.altName}>
                    {product.ai_powered && idx === 0 ? '\u2705 ' : ''}{alt.brand_name}
                  </Text>
                  <View style={styles.scoreChip}>
                    <Text style={styles.scoreText}>{alt.similarity_score}% match</Text>
                  </View>
                </View>
                {alt.reason && idx === 0 ? (
                  <Text style={{ fontSize: 12, color: C.textSecondary, lineHeight: 16, fontStyle: 'italic' }}>{alt.reason}</Text>
                ) : null}
                <Text style={styles.altGeneric}>Generic: {alt.generic_name}</Text>
                {alt.similar_ingredients && alt.similar_ingredients.length > 0 ? (
                  <Text style={styles.altShared}>Shared ingredients: {alt.similar_ingredients.join(', ')}</Text>
                ) : null}
                <Text style={styles.altMeta}>
                  {alt.dosage_form || '\u2014'} \u00b7 {alt.manufacturer_name || 'Unknown'}
                  {alt.registration_number ? ` \u00b7 Reg #${alt.registration_number}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          <Alert tone="warning" message="Confirm any medicine substitution with a qualified healthcare professional." />
        </Card>
      ) : null}

      {product.sources && product.sources.length > 0 ? (
        <Card>
          <SectionTitle subtitle="Source records attached to this medicine entry.">Registry sources</SectionTitle>
          <View style={{ gap: 8, marginTop: 10 }}>
            {product.sources.map((s: any, i: number) => (
              <View key={i} style={styles.sourceRow}>
                <Text style={styles.sourceName}>{s.source_name}</Text>
                <Text style={styles.sourceMeta}>
                  {s.title || s.canonical_url} {s.is_official ? '· Official' : ''}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.aliceBlue },
  content: { padding: 24, gap: 16, maxWidth: 960, width: '100%', alignSelf: 'center' as const, paddingBottom: 64 },
  errorActions: { alignItems: 'center', marginTop: -12, marginBottom: 6 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 5 },
  backText: { color: C.primaryDark, fontWeight: '800', fontSize: 13 },
  heroCard: { backgroundColor: C.white },
  headerRow: { flexDirection: 'row', gap: 22, alignItems: 'flex-start' },
  headerRowMobile: { flexDirection: 'column' },
  headerCopy: { flex: 1, gap: 7, minWidth: 220 },
  eyebrow: { color: C.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  brand: { fontSize: 28, lineHeight: 34, fontWeight: '900', color: C.navy, letterSpacing: -0.55 },
  sub: { fontSize: 13.5, color: C.textSecondary, lineHeight: 20 },
  statusLine: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 },
  safeText: { color: C.green, fontWeight: '700', fontSize: 12 },
  unsafeText: { color: C.red, fontWeight: '700', fontSize: 12, flexShrink: 1 },
  infoBox: { width: 280, backgroundColor: C.gray50, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: C.border },
  infoBoxMobile: { width: '100%' },
  infoBoxTitle: { color: C.navy, fontWeight: '900', fontSize: 12.5, marginBottom: 2 },
  infoLabel: { fontSize: 11.5, color: C.textSecondary },
  infoValue: { fontSize: 11.5, color: C.text, fontWeight: '700', flexShrink: 1 },
  muted: { fontSize: 12.5, color: C.textSecondary, marginTop: 9, lineHeight: 19 },
  ingredientRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 11, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border, gap: 12 },
  ingredientName: { fontSize: 13.5, fontWeight: '800', color: C.text, flex: 1 },
  ingredientStrength: { fontSize: 12.5, color: C.textSecondary, textAlign: 'right' },
  batchBox: { padding: 13, borderRadius: 13, backgroundColor: C.redBg, borderWidth: 1, borderColor: '#F2C0C7', gap: 5 },
  batchNumber: { fontSize: 14, fontWeight: '900', color: C.red },
  batchMeta: { fontSize: 12, color: C.textSecondary },
  batchRemarks: { fontSize: 12.5, color: C.text, lineHeight: 18 },
  noticeBox: { padding: 14, borderRadius: 13, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border, gap: 6 },
  noticeId: { fontSize: 11.5, fontWeight: '800', color: C.primaryDark },
  noticeDate: { fontSize: 11, color: C.textSecondary },
  noticeTitle: { fontSize: 14, fontWeight: '900', color: C.text },
  noticeBody: { fontSize: 12.5, color: C.text, lineHeight: 19 },
  noticeSource: { fontSize: 11.5, color: C.textSecondary, fontStyle: 'italic' },
  aiReasoning: { backgroundColor: '#F0ECFF', borderRadius: 13, padding: 13, marginTop: 12, borderWidth: 1, borderColor: '#DDD3FF', gap: 5 },
  aiReasoningHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  aiLabel: { fontSize: 9.5, letterSpacing: 0.8, color: '#6046B2', fontWeight: '900' },
  aiPowered: { fontSize: 9.5, color: '#6046B2', fontWeight: '900', backgroundColor: C.white, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  aiReasoningText: { fontSize: 12, color: '#493C7A', lineHeight: 18 },
  altBox: { padding: 14, borderRadius: 13, backgroundColor: C.greenBg, borderWidth: 1, borderColor: '#B7E5D8', gap: 5 },
  altName: { fontSize: 14.5, fontWeight: '900', color: C.text, flex: 1 },
  scoreChip: { backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  scoreText: { color: C.white, fontWeight: '900', fontSize: 11 },
  altGeneric: { fontSize: 12.5, color: C.text },
  altShared: { fontSize: 12, color: C.green, fontWeight: '700' },
  altMeta: { fontSize: 11.5, color: C.textSecondary },
  sourceRow: { padding: 12, borderRadius: 11, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border, gap: 2 },
  sourceName: { fontSize: 13, fontWeight: '800', color: C.text },
  sourceMeta: { fontSize: 11.5, color: C.textSecondary },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
