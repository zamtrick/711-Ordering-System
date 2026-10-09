import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Coins, TrendingUp, TrendingDown, Gift, Sparkles } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useTheme } from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";

type Tier = {
  name: string;
  color: string;
  nextTier: string | null;
  pointsToNext: number;
};

type LoyaltySummary = {
  points: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  tier: Tier;
  settings: {
    enabled: boolean;
    earnPerPeso: number;
    redeemPoints: number;
    redeemValue: number;
    minRedeemPoints: number;
  };
};

type Transaction = {
  _id: string;
  type: "earn" | "redeem" | "adjust" | "reverse";
  points: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
};

const Loyalty = () => {
  const { theme } = useTheme();
  const { colors } = theme;
  const router = useRouter();

  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryRes, historyRes] = await Promise.all([
        api.get("/customer/loyalty"),
        api.get("/customer/loyalty/transactions", { params: { limit: 30 } }),
      ]);
      setSummary(summaryRes.data?.data ?? null);
      setTransactions(historyRes.data?.data ?? []);
    } catch (err: any) {
      console.log("Loyalty load error:", err);
      if (err?.response?.status === 401) router.replace("/(auth)/login");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading rewards...
        </Text>
      </ThemedView>
    );
  }

  const tier = summary?.tier;
  const settings = summary?.settings;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007A53" />
        }
      >
        <Text style={[styles.title, { color: colors.headline }]}>Rewards</Text>

        {/* BALANCE CARD */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceLabel}>Available Points</Text>
              <Text style={styles.balanceValue}>{summary?.points ?? 0}</Text>
            </View>
            <View style={styles.tierPill}>
              <Sparkles size={14} color="#fff" />
              <Text style={styles.tierText}>{tier?.name ?? "Bronze"}</Text>
            </View>
          </View>

          {tier?.nextTier ? (
            <Text style={styles.tierHint}>
              {tier.pointsToNext} more points to reach {tier.nextTier}
            </Text>
          ) : (
            <Text style={styles.tierHint}>You&apos;ve reached the highest tier. 🎉</Text>
          )}

          <View style={styles.balanceStats}>
            <View style={styles.statItem}>
              <TrendingUp size={16} color="#BBF7D0" />
              <Text style={styles.statValue}>{summary?.lifetimeEarned ?? 0}</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <TrendingDown size={16} color="#FECACA" />
              <Text style={styles.statValue}>{summary?.lifetimeRedeemed ?? 0}</Text>
              <Text style={styles.statLabel}>Redeemed</Text>
            </View>
          </View>
        </View>

        {/* HOW IT WORKS */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: "#E8F5EF" }]}>
              <Coins size={18} color="#007A53" />
            </View>
            <View style={styles.infoText}>
              <Text style={[styles.infoTitle, { color: colors.headline }]}>
                Earn points
              </Text>
              <Text style={[styles.infoSubtitle, { color: colors.muted }]}>
                Get{" "}
                {settings ? Math.round(1 / (settings.earnPerPeso || 1)) : 10} point(s)
                for every ₱1 spent on completed orders.
              </Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: "#FEF3C7" }]}>
              <Gift size={18} color="#D97706" />
            </View>
            <View style={styles.infoText}>
              <Text style={[styles.infoTitle, { color: colors.headline }]}>
                Redeem points
              </Text>
              <Text style={[styles.infoSubtitle, { color: colors.muted }]}>
                {settings?.redeemPoints ?? 100} points = ₱
                {settings?.redeemValue ?? 5} off. Minimum{" "}
                {settings?.minRedeemPoints ?? 100} points.
              </Text>
            </View>
          </View>
        </View>

        {/* HISTORY */}
        <Text style={[styles.sectionTitle, { color: colors.headline }]}>
          Points History
        </Text>

        {transactions.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Coins size={28} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No points activity yet. Complete an order to start earning!
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.historyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {transactions.map((tx, index) => {
              const positive = tx.points > 0;
              return (
                <View key={tx._id}>
                  <View style={styles.txRow}>
                    <View
                      style={[
                        styles.txIcon,
                        { backgroundColor: positive ? "#E8F5EF" : "#FEE2E2" },
                      ]}
                    >
                      {positive ? (
                        <TrendingUp size={16} color="#007A53" />
                      ) : (
                        <TrendingDown size={16} color="#DA291C" />
                      )}
                    </View>
                    <View style={styles.txContent}>
                      <Text
                        style={[styles.txReason, { color: colors.headline }]}
                        numberOfLines={1}
                      >
                        {tx.reason || tx.type}
                      </Text>
                      <Text style={[styles.txDate, { color: colors.muted }]}>
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.txRight}>
                      <Text
                        style={[
                          styles.txPoints,
                          { color: positive ? "#007A53" : "#DA291C" },
                        ]}
                      >
                        {positive ? "+" : ""}
                        {tx.points}
                      </Text>
                      <Text style={[styles.txBalance, { color: colors.muted }]}>
                        bal {tx.balanceAfter}
                      </Text>
                    </View>
                  </View>
                  {index < transactions.length - 1 && (
                    <View
                      style={[styles.divider, { backgroundColor: colors.border }]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 25, fontWeight: "800", marginBottom: 18 },

  balanceCard: {
    backgroundColor: "#007A53",
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
  },
  balanceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  balanceLabel: { color: "#C7E9DB", fontSize: 13, fontWeight: "600" },
  balanceValue: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "900",
    marginTop: 4,
  },
  tierPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tierText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  tierHint: { color: "#D7F0E6", fontSize: 12, marginTop: 10 },

  balanceStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingVertical: 12,
  },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { color: "#fff", fontSize: 16, fontWeight: "800" },
  statLabel: { color: "#C7E9DB", fontSize: 11 },
  statDivider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.25)" },

  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 25,
  },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: { flex: 1, marginLeft: 11 },
  infoTitle: { fontSize: 13, fontWeight: "700", marginBottom: 3 },
  infoSubtitle: { fontSize: 12, lineHeight: 17 },

  divider: { height: 1 },

  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: 12 },

  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 30,
    alignItems: "center",
    gap: 10,
  },
  emptyText: { fontSize: 13, textAlign: "center", paddingHorizontal: 30 },

  historyCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13 },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txContent: { flex: 1, marginLeft: 11 },
  txReason: { fontSize: 13, fontWeight: "600" },
  txDate: { fontSize: 11, marginTop: 3 },
  txRight: { alignItems: "flex-end" },
  txPoints: { fontSize: 15, fontWeight: "800" },
  txBalance: { fontSize: 10, marginTop: 3 },
});

export default Loyalty;
