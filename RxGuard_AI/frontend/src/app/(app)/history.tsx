import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Button, Card, C, EmptyState, PageShell, SectionTitle, Spinner } from '@/components/ui';

interface HistoryItem {
  search_id: string;
  query: string;
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ history: HistoryItem[] }>('/history/search');
      setHistory(res.history);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clearAll = async () => {
    try {
      await api.del('/history/search');
      setHistory([]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const searchAgain = (q: string) => {
    router.push(`/search?q=${encodeURIComponent(q)}` as any);
  };

  if (error) {
    return <PageShell><Card><Text style={{ color: C.red }}>{error}</Text></Card></PageShell>;
  }
  if (!history) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><Spinner label="Loading your search history..." /></View>;
  }

  return (
    <PageShell>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Search History</Text>
          <Text style={styles.subtitle}>Everything you have searched in RxGuard AI</Text>
        </View>
        {history.length > 0 ? (
          <Button title="Clear History" variant="secondary" onPress={clearAll} />
        ) : null}
      </View>

      <Card>
        <SectionTitle>{history.length} search{history.length === 1 ? '' : 'es'}</SectionTitle>
        <View style={{ gap: 8, marginTop: 12 }}>
          {history.length === 0 ? (
            <EmptyState title="No searches yet." subtitle="Your searches will appear here after you use the search bar." />
          ) : (
            history.map((h) => (
              <Pressable key={h.search_id} style={styles.historyItem} onPress={() => searchAgain(h.query)}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.queryText} numberOfLines={1}>{h.query}</Text>
                  <Text style={styles.dateText}>{new Date(h.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.searchAgainText}>Search again →</Text>
              </Pressable>
            ))
          )}
        </View>
      </Card>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 2 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.gray50,
    borderWidth: 1,
    borderColor: C.border,
  },
  queryText: { fontSize: 15, fontWeight: '700', color: C.text },
  dateText: { fontSize: 12, color: C.textSecondary },
  searchAgainText: { color: C.primary, fontWeight: '700', fontSize: 13 },
});
