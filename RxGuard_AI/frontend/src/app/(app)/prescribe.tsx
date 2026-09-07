import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { Alert, Badge, Button, C, Card, PageHeader, SectionTitle } from '@/components/ui';

interface AnalysisItem {
  line: string;
  matched_name: string | null;
  product_id: string | null;
  confidence: number;
  safety_status: string;
  safe: boolean;
  match: string;
}

interface Analysis {
  items: AnalysisItem[];
  all_safe: boolean;
  total: number;
}

interface Suggestion {
  product_id: string;
  brand_name: string;
  dosage_form: string | null;
  safety_status: string;
  manufacturer_name: string | null;
}

interface PopupState {
  product_id: string;
  minimized: boolean;
  z: number;
}

export default function PrescribePage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ fileId?: string; dpId?: string }>();
  const { width } = useWindowDimensions();
  const isMobile = width < 1000;

  const [files, setFiles] = useState<any[]>([]);
  const [fileId, setFileId] = useState<string>('');
  const [newPatient, setNewPatient] = useState('');
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dpId, setDpId] = useState<string | null>(null);
  const [popups, setPopups] = useState<PopupState[]>([]);
  const [productCache, setProductCache] = useState<Record<string, any>>({});
  const zCounter = useRef(10);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestTimer = useRef<any>(null);

  const loadFiles = useCallback(async () => {
    try {
      const res = await api.get<{ files: any[] }>('/prescriptions/files');
      setFiles(res.files);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Reopen a draft from a patient folder (query params from patients/[fileId])
  useEffect(() => {
    const pid = params.dpId;
    const fid = params.fileId;
    if (fid) setFileId(String(fid));
    if (pid) {
      api
        .get<{ prescription: any }>(`/prescriptions/draft/${pid}`)
        .then((r) => {
          setContent(r.prescription.content || '');
          setDpId(r.prescription.dp_id);
          setFileId(r.prescription.file_id);
        })
        .catch((e: any) => setError(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.dpId, params.fileId]);

  const createFolder = async () => {
    if (!newPatient.trim()) return;
    setError(null);
    try {
      const res = await api.post<{ file: { file_id: string } }>('/prescriptions/files', { patientName: newPatient.trim() });
      setFileId(res.file.file_id);
      setNewPatient('');
      setDpId(null);
      setContent('');
      setAnalysis(null);
      loadFiles();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const runAnalysis = async () => {
    if (!content.trim()) {
      setError('Please type a prescription first.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await api.post<Analysis>('/prescriptions/analyze', { content });
      setAnalysis(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const saveDraft = async () => {
    if (!content.trim()) {
      setError('Please type a prescription first.');
      return;
    }
    if (!fileId) {
      setError('Please select or create a patient file first.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post<{ prescription: any; analysis: Analysis }>('/prescriptions/draft', {
        fileId,
        content,
        dpId: dpId || undefined,
      });
      setDpId(res.prescription.dp_id);
      setAnalysis(res.analysis);
      setSuccess('Draft saved.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openPopup = async (productId: string) => {
    // Already open? Just restore it
    setPopups((p) => {
      const existing = p.find((x) => x.product_id === productId);
      if (existing) {
        return p.map((x) => (x.product_id === productId ? { ...x, minimized: false, z: ++zCounter.current } : x));
      }
      return [...p, { product_id: productId, minimized: false, z: ++zCounter.current }];
    });
    if (!productCache[productId]) {
      try {
        const res = await api.get<{ product: any }>(`/medicines/${productId}`);
        setProductCache((c) => ({ ...c, [productId]: res.product }));
      } catch (e: any) {
        setError(e.message);
      }
    }
  };

  const closePopup = (productId: string) => {
    setPopups((p) => p.filter((x) => x.product_id !== productId));
  };

  const minimizePopup = (productId: string) => {
    setPopups((p) => p.map((x) => (x.product_id === productId ? { ...x, minimized: true } : x)));
  };

  const focusPopup = (productId: string) => {
    setPopups((p) => p.map((x) => (x.product_id === productId ? { ...x, z: ++zCounter.current } : x)));
  };

  const print = async () => {
    if (!content.trim()) {
      setError('Please type a prescription first.');
      return;
    }
    if (!fileId) {
      setError('Please select or create a patient file first.');
      return;
    }
    setPrinting(true);
    setError(null);
    try {
      const res = await api.post<{ analysis: Analysis }>('/prescriptions/print', {
        fileId,
        content,
        dpId: dpId || undefined,
      });
      setAnalysis(res.analysis);
      // Close all popups then open the system print dialog
      setPopups([]);
      setSuccess('Prescription verified safe. Opening print...');
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          // Render a clean print view then call the browser print dialog
          const patient = files.find((f) => f.file_id === fileId);
          const w = window.open('', '_blank', 'width=800,height=1000');
          if (w) {
            w.document.write(`
              <html><head><title>Prescription — ${patient ? patient.patient_name : 'Patient'}</title>
              <style>
                body { font-family: Georgia, serif; padding: 48px; color: #111; }
                .head { display:flex; justify-content:space-between; border-bottom:3px solid #6495ED; padding-bottom:12px; }
                .head h1 { margin:0; font-size:22px; color:#4A7BD8; }
                .rx { font-size:34px; margin:18px 0 6px; }
                pre { font-family:Georgia,serif; font-size:16px; line-height:1.7; white-space:pre-wrap; }
                .foot { margin-top:40px; border-top:1px solid #ccc; padding-top:10px; font-size:12px; color:#555; }
              </style></head><body>
              <div class="head">
                <div><h1>RxGuard AI</h1><span>Verified Safe Prescription</span></div>
                <div style="text-align:right">
                  <div><b>${user?.full_name || ''}</b></div>
                  <div>${user?.license_number || ''}</div>
                  <div>${user?.clinic_name || ''}</div>
                  <div>${new Date().toLocaleString()}</div>
                </div>
              </div>
              <div class="rx">℞</div>
              <pre>${content.replace(/</g, '&lt;')}</pre>
              <div class="foot">
                Patient: ${patient ? patient.patient_name : ''} · All medicines verified against the RxGuard DRAP database.
                Generated by RxGuard AI.
              </div>
              <script>window.onload = function(){ window.print(); }</script>
              </body></html>
            `);
            w.document.close();
          }
        }
      }, 300);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPrinting(false);
    }
  };

  // Live medicine suggestions for the line currently being typed (like the search page)
  const onContentChange = (text: string) => {
    setContent(text);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const lines = text.split('\n');
    const currentLine = lines[lines.length - 1].trim();
    if (currentLine.length < 2) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await api.get<{ suggestions: Suggestion[] }>(`/medicines/suggest?q=${encodeURIComponent(currentLine)}`);
        setSuggestions(res.suggestions.slice(0, 6));
        setShowSuggest(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  };

  // Insert a picked suggestion in place of the line being typed. Picking a
  // medicine from the autocomplete is a lookup — record it in search history.
  const applySuggestion = (name: string) => {
    const lines = content.split('\n');
    lines[lines.length - 1] = name;
    setContent(lines.join('\n'));
    setShowSuggest(false);
    setSuggestions([]);
    api.post('/history/search', { query: name }).catch(() => undefined);
  };

  const allSafe = analysis?.all_safe === true;

  return (
    <View style={[styles.page, isMobile && styles.pageColumn]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <PageHeader
          eyebrow="Doctor workspace"
          title="Prescription workspace"
          subtitle="Select a patient file, prepare a draft, and review its current registry safety status before printing."
          actions={fileId ? <View style={styles.selectedPill}><Text style={styles.selectedPillText}>Patient file selected</Text></View> : undefined}
        />

        {user?.approval_status !== 'approved' ? (
          <Alert
            tone="warning"
            title="Awaiting administrator approval"
            message="You can prepare the prescription workspace, but saving and printing unlock after an administrator verifies your registration."
          />
        ) : null}

        {error ? <Alert tone="error" title="Workspace update failed" message={error} /> : null}
        {success ? <Alert tone="success" title="Workspace updated" message={success} /> : null}

        {/* Patient file selector stays in flow so it never overlaps workspace actions. */}
        <Card style={styles.patientCard} elevated>
          <SectionTitle subtitle="Drafts are kept in the selected patient file.">Patient file</SectionTitle>
          <View style={styles.fileOptions}>
            {files.map((f) => (
              <Pressable
                key={f.file_id}
                accessibilityRole="button"
                accessibilityState={{ selected: fileId === f.file_id }}
                accessibilityLabel={`Select ${f.patient_name}`}
                onPress={() => {
                  // Re-target the file without wiping the notepad: the doctor may
                  // want to keep typing and save into the newly selected file.
                  setFileId(f.file_id);
                  setDpId(null);
                  setError(null);
                  setShowSuggest(false);
                }}
                style={[styles.fileChip, fileId === f.file_id && styles.fileChipActive]}
              >
                <Text style={[styles.fileChipText, fileId === f.file_id && { color: C.primary }]} numberOfLines={1}>
                  {f.patient_name}
                </Text>
              </Pressable>
            ))}
            {files.length === 0 ? <Text style={styles.fileHint}>No patient files yet — create the first one below.</Text> : null}
          </View>
          <View style={[styles.newPatientRow, isMobile && styles.newPatientRowMobile]}>
            <TextInput
              value={newPatient}
              onChangeText={setNewPatient}
              placeholder="New patient name"
              placeholderTextColor={C.textMuted}
              accessibilityLabel="New patient name"
              style={[styles.newPatientInput, isMobile && styles.newPatientInputMobile]}
              onSubmitEditing={createFolder}
            />
            <Button title="Create file" size="sm" onPress={createFolder} disabled={!newPatient.trim()} />
          </View>
          {fileId ? (
            <View style={styles.selectedFileRow}>
              <View style={styles.selectedFileDot} />
              <Text style={styles.selectedFile}>
                Writing for <Text style={{ fontWeight: '800' }}>{files.find((f) => f.file_id === fileId)?.patient_name || 'selected patient'}</Text>
              </Text>
            </View>
          ) : (
            <Text style={styles.selectedFileWarn}>Choose a patient file before saving or printing.</Text>
          )}
        </Card>

        <Card style={styles.notepadCard} elevated>
          <SectionTitle subtitle="Use one line per medicine. Suggestions insert an active registry record into the current line.">Prescription notepad</SectionTitle>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={content}
              onChangeText={onContentChange}
              multiline
              accessibilityLabel="Prescription notepad"
              placeholder="Enter the prescription here…"
              placeholderTextColor={C.textMuted}
              style={styles.notepad}
            />
            {showSuggest && suggestions.length > 0 ? (
              <View style={[styles.suggestBox, isMobile && styles.suggestBoxMobile]}>
                <Text style={styles.suggestHint}>Registry suggestions — tap to insert on the current line</Text>
                <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {suggestions.map((s) => (
                    <Pressable
                      key={s.product_id}
                      accessibilityRole="button"
                      accessibilityLabel={`Insert ${s.brand_name}`}
                      style={styles.suggestItem}
                      onPress={() => applySuggestion(s.brand_name)}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.suggestName}>{s.brand_name}</Text>
                        <Text style={styles.suggestSub}>{s.dosage_form || '—'} · {s.manufacturer_name || 'Unknown manufacturer'}</Text>
                      </View>
                      <Badge status={s.safety_status} small />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
          <View style={[styles.btnRow, isMobile && styles.btnRowMobile]}>
            <Button title="Save draft" variant="secondary" onPress={saveDraft} loading={saving} disabled={user?.approval_status !== 'approved'} />
            <Button title="Check safety" variant="secondary" onPress={runAnalysis} loading={analyzing} />
            <Button
              title={allSafe ? 'Print prescription' : 'Printing locked'}
              variant={allSafe ? 'primary' : 'secondary'}
              onPress={print}
              loading={printing}
              disabled={!allSafe || user?.approval_status !== 'approved'}
              style={[styles.printButton, !allSafe && { opacity: 0.65 }]}
            />
          </View>
        </Card>
      </ScrollView>

      {/* Sidebar with per-medicine safety status. */}
      <View style={[styles.sidebar, isMobile && styles.sidebarMobile]}>
        <View style={styles.sidebarHeader}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.sidebarTitle}>Safety review</Text>
            <Text style={styles.sidebarHint}>
              {analysis ? `${analysis.total} medicine${analysis.total === 1 ? '' : 's'} detected` : 'Run a safety check to begin'}
            </Text>
          </View>
          {analysis ? <Badge status={allSafe ? 'safe' : 'pending'} small /> : null}
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingVertical: 14 }} showsVerticalScrollIndicator={false}>
          {analyzing ? (
            <View style={{ paddingVertical: 26, alignItems: 'center' }}>
              <ActivityIndicator color={C.primary} />
              <Text style={styles.sidebarLoading}>Checking registry records…</Text>
            </View>
          ) : !analysis ? (
            <View style={{ paddingVertical: 24, alignItems: 'center', gap: 7 }}>
              <Text style={styles.sidebarEmptyIcon}>℞</Text>
              <Text style={styles.sidebarEmpty}>The medicines entered in the notepad appear here after a safety check or draft save.</Text>
            </View>
          ) : (
            analysis.items.map((item, idx) => (
              <View key={idx} style={[styles.medicineRow, item.safe ? styles.medicineSafe : styles.medicineUnsafe]}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.medicineName, item.safe ? { color: C.green } : { color: C.red }]} numberOfLines={2}>
                    {item.matched_name || item.line}
                  </Text>
                  <Text style={styles.medicineMeta}>
                    {item.match === 'recognized' ? `${item.safety_status.replace(/_/g, ' ')} · ${Math.round(item.confidence * 100)}% match` : 'No matching registry record found'}
                  </Text>
                </View>
                {!item.safe && item.product_id ? (
                  <Pressable accessibilityRole="button" style={styles.learnMoreBtn} onPress={() => openPopup(item.product_id!)}>
                    <Text style={styles.learnMoreText}>Review</Text>
                  </Pressable>
                ) : item.safe ? <Badge status="safe" small /> : null}
              </View>
            ))
          )}
        </ScrollView>
        {analysis ? (
          <View style={[styles.allSafeBanner, allSafe ? styles.allSafeBannerPositive : styles.allSafeBannerNegative]}>
            <Text style={[styles.allSafeText, { color: allSafe ? C.green : C.red }]}>
              {allSafe
                ? 'All listed medicines currently have a safe registry status. Printing is enabled.'
                : 'One or more entries need review. Printing remains unavailable until every entry is marked safe.'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Learn More popup windows (multiple, minimizable, closable) */}
      {popups.filter((p) => !p.minimized).map((p) => (
        <LearnMorePopup
          key={p.product_id}
          productId={p.product_id}
          z={p.z}
          product={productCache[p.product_id]}
          onClose={() => closePopup(p.product_id)}
          onMinimize={() => minimizePopup(p.product_id)}
          onFocus={() => focusPopup(p.product_id)}
          isMobile={isMobile}
        />
      ))}

      {/* Minimized popup tabs */}
      {popups.some((p) => p.minimized) ? (
        <View style={[styles.minimizedBar, isMobile && { right: 16 }]}>
          {popups.filter((p) => p.minimized).map((p) => (
            <Pressable
              key={p.product_id}
              style={styles.minTab}
              onPress={() => setPopups((prev) => prev.map((x) => (x.product_id === p.product_id ? { ...x, minimized: false, z: ++zCounter.current } : x)))}
            >
              <Text style={styles.minTabText} numberOfLines={1}>
                {productCache[p.product_id]?.brand_name || 'Loading…'}
              </Text>
              <Pressable onPress={() => closePopup(p.product_id)} hitSlop={8}>
                <Text style={styles.minTabClose}>✕</Text>
              </Pressable>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LearnMorePopup({
  productId,
  z,
  product,
  onClose,
  onMinimize,
  onFocus,
  isMobile,
}: {
  productId: string;
  z: number;
  product: any;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  isMobile: boolean;
}) {
  if (!product) {
    return (
      <View style={[styles.popup, { zIndex: z }, isMobile && styles.popupMobile]}>
        <View style={styles.popupHeader}>
          <Text style={styles.popupTitle}>Loading medicine…</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={onMinimize}><Text style={styles.popupCtrl}>—</Text></Pressable>
            <Pressable onPress={onClose}><Text style={styles.popupCtrl}>✕</Text></Pressable>
          </View>
        </View>
        <View style={{ padding: 30, alignItems: 'center' }}>
          <ActivityIndicator color={C.primary} />
        </View>
      </View>
    );
  }

  return (
    <Pressable onPress={onFocus} style={[styles.popup, { zIndex: z }, isMobile && styles.popupMobile]}>
      <View style={styles.popupHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.popupTitle} numberOfLines={1}>{product.brand_name}</Text>
          <Badge status={product.safety_status} small />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={onMinimize} hitSlop={6} accessibilityLabel="Minimize">
            <Text style={styles.popupCtrl}>—</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={6} accessibilityLabel="Close">
            <Text style={styles.popupCtrl}>✕</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.popupBody} contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
        <View style={[styles.popupAlert, { backgroundColor: C.redBg, borderColor: '#FECACA' }]}>
          <Text style={{ color: C.red, fontWeight: '800', fontSize: 13 }}>
            This medicine is NOT safe to prescribe
          </Text>
          <Text style={{ color: C.red, fontSize: 12.5, marginTop: 3 }}>
            Status: {String(product.safety_status).replace('_', ' ')}
          </Text>
        </View>

        {product.notices && product.notices.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.popupSection}>Why it is not safe</Text>
            {product.notices.map((n: any) => (
              <View key={n.notice_id} style={styles.noticeBox}>
                <Text style={styles.noticeTitle}>{n.title}</Text>
                <Text style={styles.noticeMeta}>
                  {n.notice_identifier} · {n.action_date ? new Date(n.action_date).toLocaleDateString() : ''}
                  {n.severity ? ` · Severity: ${n.severity}` : ''}
                </Text>
                {n.problem_statement ? <Text style={styles.noticeBody}>{n.problem_statement}</Text> : null}
                {n.risk_statement ? <Text style={styles.noticeBody}>{n.risk_statement}</Text> : null}
                {n.source_name ? <Text style={styles.noticeSource}>Source: {n.source_name}</Text> : null}
              </View>
            ))}
          </View>
        ) : (
          <View>
            <Text style={styles.popupSection}>Why it is not safe</Text>
            <Text style={styles.noticeBody}>
              Status &quot;{String(product.safety_status).replace('_', ' ')}&quot; in the DRAP registry.
              {product.source_text ? ' ' + product.source_text : ''}
            </Text>
          </View>
        )}

        {product.ingredients && product.ingredients.length > 0 ? (
          <View>
            <Text style={styles.popupSection}>Ingredients</Text>
            <Text style={styles.noticeBody}>
              {product.ingredients.map((i: any) => i.name).join(', ')}
            </Text>
          </View>
        ) : null}

        {product.alternatives && product.alternatives.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.popupSection}>
              {product.ai_powered ? 'Safe Alternatives (AI recommended)' : 'Safe Alternatives (algorithmic ranking)'}
            </Text>
            {product.ai_powered && product.ai_reason ? (
              <View style={{ backgroundColor: '#EEF2FF', borderRadius: 8, padding: 10, marginBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#4338CA', marginBottom: 2 }}>AI Reasoning</Text>
                <Text style={{ fontSize: 12, color: '#4338CA', lineHeight: 17 }}>{product.ai_reason}</Text>
              </View>
            ) : null}
            {product.alternatives.map((alt: any, idx: number) => (
              <View key={alt.product_id} style={styles.altBox}>
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
                  <Text style={styles.altShared}>Shared: {alt.similar_ingredients.join(', ')}</Text>
                ) : (
                  <Text style={styles.altShared}>Similar therapeutic profile</Text>
                )}
                <Text style={styles.altMeta}>
                  {alt.dosage_form || '\u2014'} \u00b7 {alt.manufacturer_name || 'Unknown'}
                </Text>
              </View>
            ))}
            <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginTop: 4 }}>
              <Text style={{ fontSize: 11.5, color: '#92400E', lineHeight: 16 }}>
                Please confirm any medicine substitution with a qualified healthcare professional.
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.popupSection}>Safe Alternatives</Text>
            <Text style={styles.noticeBody}>No suitable safe alternative was found in the RxGuard database.</Text>
          </View>
        )}
      </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, flexDirection: 'row', backgroundColor: C.aliceBlue },
  pageColumn: { flexDirection: 'column' },
  scrollContent: { flex: 1, padding: 24, gap: 18, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  selectedPill: { backgroundColor: C.greenBg, borderWidth: 1, borderColor: '#B7E5D8', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  selectedPillText: { color: C.green, fontSize: 11.5, fontWeight: '800' },
  notepadCard: { flex: 1, gap: 14 },
  notepadLabel: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 10 },
  notepad: {
    // 12in x 12in notepad -> generous square canvas with 18pt black text
    minHeight: 560,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 4,
    padding: 20,
    fontSize: 18,
    color: '#111111',
    textAlignVertical: 'top',
    lineHeight: 30,
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 2, alignItems: 'center', flexWrap: 'wrap' },
  btnRowMobile: { flexDirection: 'column', alignItems: 'stretch' },
  printButton: { marginLeft: 'auto' },
  sidebar: {
    width: 340,
    backgroundColor: C.white,
    borderLeftWidth: 1,
    borderLeftColor: C.border,
    padding: 18,
  },
  sidebarMobile: { width: '100%', maxHeight: 360, borderLeftWidth: 0, borderTopWidth: 1, borderTopColor: C.border },
  sidebarHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sidebarTitle: { fontSize: 17, fontWeight: '800', color: C.navy },
  sidebarHint: { fontSize: 12.5, color: C.textSecondary, lineHeight: 18 },
  sidebarLoading: { fontSize: 12, color: C.textSecondary, marginTop: 10 },
  sidebarEmptyIcon: { fontSize: 34, color: C.primary },
  sidebarEmpty: { fontSize: 12.5, color: C.textSecondary, textAlign: 'center', lineHeight: 18, maxWidth: 250 },
  medicineRow: {
    borderRadius: 10,
    padding: 11,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  medicineSafe: { borderColor: '#86EFAC', backgroundColor: C.greenBg },
  medicineUnsafe: { borderColor: '#FCA5A5', backgroundColor: C.redBg },
  medicineName: { fontSize: 13.5, fontWeight: '800', textDecorationLine: 'underline' },
  medicineMeta: { fontSize: 11.5, color: C.textSecondary },
  learnMoreBtn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  learnMoreText: { color: C.white, fontWeight: '700', fontSize: 11.5 },
  allSafeBanner: { borderRadius: 12, padding: 12, marginTop: 4, borderWidth: 1 },
  allSafeBannerPositive: { backgroundColor: C.greenBg, borderColor: '#B7E5D8' },
  allSafeBannerNegative: { backgroundColor: C.redBg, borderColor: '#F2C0C7' },
  allSafeText: { fontWeight: '800', fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  patientCard: { gap: 12 },
  fileHint: { fontSize: 12.5, color: C.textSecondary, lineHeight: 18 },
  fileOptions: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  selectedFileRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  selectedFileDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  selectedFile: { fontSize: 12.5, color: C.green, fontWeight: '600' },
  selectedFileWarn: { fontSize: 12.5, color: C.amber, fontWeight: '700' },
  suggestBox: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: '70%',
    maxHeight: 300,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 20,
    zIndex: 300,
  },
  suggestBoxMobile: { left: 10, width: 'auto' },
  suggestHint: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSecondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.aliceBlue,
  },
  suggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: C.gray100,
    backgroundColor: C.white,
  },
  suggestName: { fontSize: 13.5, fontWeight: '700', color: C.text },
  suggestSub: { fontSize: 11.5, color: C.textSecondary },
  fileChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  fileChipActive: { borderColor: C.primary, backgroundColor: C.aliceBlue },
  fileChipText: { fontSize: 12, fontWeight: '600', color: C.textSecondary },
  newPatientRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  newPatientRowMobile: { alignItems: 'stretch' },
  newPatientInput: {
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 13,
    width: 190,
    backgroundColor: C.white,
    color: C.text,
  },
  newPatientInputMobile: { flex: 1, width: undefined },
  popup: {
    position: 'absolute',
    top: 70,
    right: 350,
    width: 480,
    maxHeight: '80%',
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 30,
    overflow: 'hidden',
  },
  popupMobile: { right: 16, left: 16, width: 'auto' },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.aliceBlue,
    gap: 10,
  },
  popupTitle: { fontSize: 15, fontWeight: '800', color: C.text, flex: 1 },
  popupCtrl: { fontSize: 18, color: C.textSecondary, fontWeight: '800', paddingHorizontal: 6 },
  popupBody: { paddingHorizontal: 14 },
  popupAlert: { borderRadius: 12, borderWidth: 1.5, padding: 12, marginTop: 12 },
  popupSection: { fontSize: 14, fontWeight: '800', color: C.text },
  noticeBox: { borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.gray50, padding: 12, gap: 4 },
  noticeTitle: { fontSize: 13.5, fontWeight: '700', color: C.text },
  noticeMeta: { fontSize: 11.5, color: C.textSecondary },
  noticeBody: { fontSize: 12.5, color: C.text, lineHeight: 18 },
  noticeSource: { fontSize: 11.5, color: C.textSecondary, fontStyle: 'italic' },
  altBox: { borderRadius: 12, borderWidth: 1.5, borderColor: '#BBF7D0', backgroundColor: C.greenBg, padding: 12, gap: 4 },
  altName: { fontSize: 14, fontWeight: '800', color: C.text, flex: 1 },
  altGeneric: { fontSize: 12.5, color: C.text },
  altShared: { fontSize: 12, color: C.green, fontWeight: '700' },
  altMeta: { fontSize: 11.5, color: C.textSecondary },
  scoreChip: { backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  scoreText: { color: C.white, fontWeight: '800', fontSize: 11.5 },
  minimizedBar: {
    position: 'absolute',
    bottom: 16,
    right: 336,
    flexDirection: 'row',
    gap: 8,
  },
  minTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  minTabText: { color: C.white, fontWeight: '700', fontSize: 12.5, maxWidth: 140 },
  minTabClose: { color: C.white, fontWeight: '800', fontSize: 13 },
});
