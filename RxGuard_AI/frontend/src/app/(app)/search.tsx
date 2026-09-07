import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { Alert, Badge, Card, C, EmptyState, PageHeader, PageShell, SectionTitle, Spinner } from '@/components/ui';

interface Suggestion {
  product_id: string;
  brand_name: string;
  dosage_form: string | null;
  safety_status: string;
  manufacturer_name: string | null;
}

interface SearchResult {
  product_id: string;
  brand_name: string;
  dosage_form: string | null;
  registration_number: string | null;
  safety_status: string;
  manufacturer_name: string | null;
}

interface SmartResult extends SearchResult {
  keyword_rank: number | null;
  semantic_rank: number | null;
  semantic_score: number | null;
  rrf_score: number;
  match_source: 'keyword' | 'semantic' | 'hybrid';
}

interface SmartSearchResponse {
  results: SmartResult[];
  query: string;
  semantic_available: boolean;
  message: string;
}

export default function SearchPage() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ q?: string }>();
  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smart, setSmart] = useState(false);
  const [smartMessage, setSmartMessage] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const isMobile = width < 860;
  const resultsMaxHeight = Math.max(280, Math.min(560, (height || 800) - 360));
  const debounceRef = useRef<any>(null);

  // Live suggestions dropdown as the user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await api.get<{ suggestions: Suggestion[] }>(`/medicines/suggest?q=${encodeURIComponent(term.trim())}`);
        setSuggestions(res.suggestions);
        setShowSuggest(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [term]);

  const runSearch = useCallback(async (q?: string) => {
    const query = (q ?? term).trim();
    setShowSuggest(false);
    setSmartMessage(null);
    if (!query) {
      setError('Please type something to search.');
      return;
    }
    setSearching(true);
    setError(null);
    try {
      if (smart) {
        const res = await api.get<SmartSearchResponse>(`/medicines/search/smart?q=${encodeURIComponent(query)}`);
        setResults(res.results);
        setSmartMessage(res.message || null);
      } else {
        const res = await api.get<{ results: SearchResult[] }>(`/medicines/search?q=${encodeURIComponent(query)}`);
        setResults(res.results);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  }, [term, smart]);

  // A search arriving from the history page ("Search again") carries ?q= — run
  // it once on mount so the user sees the results immediately.
  useEffect(() => {
    if (params.q) {
      const q = String(params.q);
      setTerm(q);
      runSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  // Clicking a suggestion is a search too — log it before navigating so it
  // appears in the search history like every other executed search.
  const logSearch = (query: string) => {
    api.post('/history/search', { query }).catch(() => undefined);
  };

  // Select a medicine from the live dropdown: record the medicine NAME
  // (never the typed fragment) and open its detail page.
  const selectSuggestion = (s: Suggestion) => {
    setTerm(s.brand_name);
    setShowSuggest(false);
    logSearch(s.brand_name);
    router.push(`/medicine/${s.product_id}` as any);
  };

  return (
    <PageShell>
      <PageHeader eyebrow="Registry search" title="Find medicine information" subtitle="Search by name, ingredient, registration number, manufacturer, DRAP alert, or batch number." />

      <View style={styles.modeBar}>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: !smart }} style={({ pressed }) => [styles.modeOption, !smart && styles.modeOptionActive, pressed && styles.pressed]} onPress={() => setSmart(false)}>
          <Text style={[styles.modeTitle, !smart && styles.modeTitleActive]}>Standard search</Text>
          <Text style={styles.modeDescription}>Exact names, ingredients, batches, and manufacturers.</Text>
        </Pressable>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: smart }} style={({ pressed }) => [styles.modeOption, smart && styles.modeOptionActive, pressed && styles.pressed]} onPress={() => setSmart(true)}>
          <View style={styles.modeTitleRow}><Text style={[styles.modeTitle, smart && styles.modeTitleActive]}>Smart search</Text><Text style={styles.aiTag}>AI</Text></View>
          <Text style={styles.modeDescription}>Natural-language intent, matched to available registry records.</Text>
        </Pressable>
      </View>

      <View style={{ position: 'relative', zIndex: 100 }}>
        <View style={[styles.searchRow, isMobile && styles.searchRowMobile]}>
          <View style={styles.searchBox}>
            <Text style={styles.searchGlyph}>⌕</Text>
            <TextInput
              accessibilityLabel="Search the medicine registry"
              value={term}
              onChangeText={(t) => {
                setTerm(t);
                setResults(null);
              }}
              placeholder={smart ? 'Describe what you are looking for…' : 'Search medicines, ingredients, batches…'}
              placeholderTextColor={C.textMuted}
              style={styles.searchInput}
              onSubmitEditing={() => {
                // Autocomplete convention: Enter picks the first suggestion
                // while the dropdown is open; otherwise it runs a raw search.
                if (showSuggest && suggestions.length > 0) selectSuggestion(suggestions[0]);
                else runSearch();
              }}
              onFocus={() => setShowSuggest(true)}
            />
            {suggestLoading ? <ActivityIndicator color={C.primary} style={{ marginRight: 10 }} /> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={smart ? 'Run smart medicine search' : 'Run medicine search'} style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]} onPress={() => runSearch()}>
            <Text style={styles.searchBtnText}>{smart ? 'Smart search' : 'Search registry'}</Text>
          </Pressable>
        </View>
        <Text style={styles.smartHint}>{smart ? 'Use plain language, for example: “medicine for fever and headache”.' : 'Suggestions appear as you type; choose one to open its registry record.'}</Text>

        {showSuggest && suggestions.length > 0 ? (
          <View style={styles.suggestBox}>
            {suggestions.map((s) => (
              <Pressable
                key={s.product_id}
                style={styles.suggestItem}
                onPress={() => selectSuggestion(s)}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.suggestName}>{s.brand_name}</Text>
                  <Text style={styles.suggestSub}>
                    {s.dosage_form || '—'} · {s.manufacturer_name || 'Unknown manufacturer'}
                  </Text>
                </View>
                <Badge status={s.safety_status} small />
              </Pressable>
            ))}
            <Pressable style={[styles.suggestItem, { justifyContent: 'center' }]} onPress={() => runSearch()}>
              <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13.5 }}>
                See all results for &quot;{term.trim()}&quot;
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {error ? <Alert tone="error" title="Search unavailable" message={error} /> : null}

      {searching ? (
        <Spinner label="Searching the RxGuard registry…" />
      ) : results !== null ? (
        <Card style={styles.resultsCard}>
          <View style={styles.resultsTop}><SectionTitle subtitle={smart ? 'Results use the configured hybrid search ranking.' : 'Results match available registry fields.'}>{results.length} result{results.length === 1 ? '' : 's'}</SectionTitle>{smart ? <View style={styles.smartPill}><Text style={styles.smartPillText}>Smart results</Text></View> : null}</View>
          <ScrollView style={{ marginTop: 12, maxHeight: resultsMaxHeight }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
            {results.length === 0 ? (
              <EmptyState
                title="No medicines found."
                subtitle={smartMessage || 'Try a different spelling, or search by ingredient (e.g. Paracetamol).'}
              />
            ) : (
              results.map((r) => (
                <Pressable
                  key={r.product_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${r.brand_name}`}
                  style={({ pressed }) => [styles.resultItem, pressed && styles.pressed]}
                  onPress={() => router.push(`/medicine/${r.product_id}` as any)}
                >
                  <View style={styles.resultIcon}><Text style={styles.resultIconText}>℞</Text></View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.resultName}>{r.brand_name}</Text>
                    <Text style={styles.resultSub}>{r.dosage_form || 'Unknown form'} · {r.manufacturer_name || 'Unknown manufacturer'}</Text>
                    <View style={styles.resultMetaRow}>
                      <Text style={styles.registrationText}>{r.registration_number ? `Registration #${r.registration_number}` : 'No registration number displayed'}</Text>
                      {smart && (r as SmartResult).match_source ? <Text style={styles.matchSource}>{(r as SmartResult).match_source} match</Text> : null}
                    </View>
                  </View>
                  <View style={styles.resultRight}><Badge status={r.safety_status} /><Text style={styles.viewText}>Open →</Text></View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Card>
      ) : (
        user?.role === 'patient' ? <RetailersSection /> : null
      )}
    </PageShell>
  );
}

function RetailersSection() {
  const [retailers, setRetailers] = useState<any[]>([]);
  useEffect(() => {
    api.get('/medicines/retailers/nearby').then((r: any) => setRetailers(r.retailers)).catch(() => undefined);
  }, []);
  if (!retailers.length) return null;
  return (
    <Card>
      <SectionTitle>Nearby Medicine Retailers</SectionTitle>
      <View style={{ gap: 8, marginTop: 10 }}>
        {retailers.slice(0, 6).map((r) => (
          <View key={r.retailer_id} style={styles.retailerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.retailerName}>{r.name}</Text>
              <Text style={styles.retailerSub}>{r.address}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={styles.retailerHours}>{r.hours}</Text>
              <Text style={styles.retailerPhone}>{r.phone}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  modeBar: { flexDirection: 'row', gap: 10 },
  modeOption: { flex: 1, minHeight: 74, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, gap: 3 },
  modeOptionActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeTitle: { color: C.text, fontSize: 13, fontWeight: '900' },
  modeTitleActive: { color: C.primaryDark },
  modeDescription: { color: C.textSecondary, fontSize: 10.5, lineHeight: 15 },
  aiTag: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: '#E7E0FF', color: '#6046B2', fontSize: 8.5, fontWeight: '900' },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchRowMobile: { flexDirection: 'column' },
  searchBox: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderWidth: 1.5, borderColor: C.primary, borderRadius: 14, shadowColor: C.primary, shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  searchGlyph: { color: C.primaryDark, fontSize: 20, fontWeight: '900', marginLeft: 15 },
  searchInput: { flex: 1, paddingHorizontal: 11, paddingVertical: 14, fontSize: 15, color: C.text },
  searchBtn: { minHeight: 54, backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 22, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { color: C.white, fontWeight: '900', fontSize: 13.5 },
  smartHint: { fontSize: 11.5, color: C.textSecondary, marginTop: 8, marginLeft: 3 },
  suggestBox: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, zIndex: 200, overflow: 'hidden', shadowColor: C.navy, shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  suggestItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.gray100, backgroundColor: C.white },
  suggestName: { fontSize: 14, fontWeight: '800', color: C.text },
  suggestSub: { fontSize: 11.5, color: C.textSecondary },
  resultsCard: { paddingBottom: 15 },
  resultsTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  smartPill: { backgroundColor: '#E7E0FF', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  smartPillText: { color: '#6046B2', fontSize: 10, fontWeight: '900' },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 13, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border },
  resultIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  resultIconText: { color: C.primaryDark, fontSize: 17, fontWeight: '900' },
  resultName: { fontSize: 14.5, fontWeight: '900', color: C.text },
  resultSub: { fontSize: 11.5, color: C.textSecondary },
  resultMetaRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', alignItems: 'center' },
  registrationText: { fontSize: 10.5, color: C.textMuted },
  matchSource: { fontSize: 9.5, color: '#6046B2', fontWeight: '800', backgroundColor: '#E7E0FF', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, textTransform: 'capitalize' },
  resultRight: { alignItems: 'flex-end', gap: 5 },
  viewText: { color: C.primaryDark, fontSize: 11, fontWeight: '800' },
  retailerRow: { flexDirection: 'row', padding: 12, borderRadius: 12, backgroundColor: C.gray50, borderWidth: 1, borderColor: C.border, gap: 10 },
  retailerName: { fontSize: 14, fontWeight: '800', color: C.text },
  retailerSub: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  retailerHours: { fontSize: 12, color: C.green, fontWeight: '700' },
  retailerPhone: { fontSize: 12, color: C.textSecondary },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
