import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ChevronLeft, Send, MessageCircle, WifiOff, Truck } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";

import useTheme from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";
import { useSocket } from "@/context/SocketContext";

// --------------------------------------------------
// Per-order delivery chat — customer <-> assigned rider.
// Opened from the order detail "Message rider" button.
// --------------------------------------------------

type ChatMessage = {
  _id: string;
  text: string;
  senderRole: "customer" | "admin" | "rider";
  sender?: { firstname?: string; lastname?: string };
  createdAt: string;
  read: boolean;
};

type OrderConvo = {
  _id: string;
  unreadCustomer: number;
  rider?: { firstname?: string; lastname?: string } | null;
  order?: { _id?: string } | null;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

export default function RiderChat() {
  const { orderId: raw } = useLocalSearchParams<{ orderId: string | string[] }>();
  const idParam = Array.isArray(raw) ? raw[0] : raw;
  const { theme } = useTheme();
  const { colors } = theme;
  const { socket, connected } = useSocket();

  const [convo, setConvo] = useState<OrderConvo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const convIdRef = useRef<string | null>(null);

  // Load (or create) the delivery chat for this order
  useEffect(() => {
    if (!idParam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derive error state from missing route param
      setLoadError("Missing order.");
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const convRes = await api.get(`/chat/order/${idParam}`);
        const c: OrderConvo = convRes.data?.data;
        if (!c?._id) throw new Error("No conversation");
        if (!mounted) return;
        setConvo(c);
        convIdRef.current = c._id;
        const msgRes = await api.get(`/chat/conversations/${c._id}/messages`);
        if (mounted) setMessages(msgRes.data?.data ?? []);
      } catch (err: unknown) {
        if (!mounted) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          router.replace("/(auth)/login");
          return;
        }
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Could not open the chat.";
        setLoadError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [idParam]);

  // Join room once socket + convo ready
  useEffect(() => {
    if (!socket || !connected || !convIdRef.current) return;
    const id = convIdRef.current;
    socket.emit("join_conversation", { conversationId: id });
    return () => {
      socket.emit("leave_conversation", { conversationId: id });
    };
  }, [socket, connected, convo?._id]);

  // Incoming messages
  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage & { conversation?: string }) => {
      if (msg.conversation && msg.conversation !== convIdRef.current) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };
    socket.on("new_message", handler);
    return () => {
      socket.off("new_message", handler);
    };
  }, [socket]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !convIdRef.current || !socket || !connected) return;
    setSending(true);
    setText("");
    socket.emit(
      "send_message",
      { conversationId: convIdRef.current, text: trimmed },
      (ack: { success: boolean; data?: ChatMessage; message?: string }) => {
        setSending(false);
        if (!ack?.success) {
          Alert.alert("Error", ack?.message ?? "Failed to send message.");
          setText(trimmed);
        }
      },
    );
  };

  const riderName = convo?.rider
    ? `${convo.rider.firstname ?? ""} ${convo.rider.lastname ?? ""}`.trim() || "Your rider"
    : "Your rider";

  const renderItem = ({ item: msg }: { item: ChatMessage }) => {
    const isMe = msg.senderRole === "customer";
    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        {!isMe && (
          <View style={[styles.avatar, { backgroundColor: "#007A53" }]}>
            <Text style={styles.avatarText}>
              {(msg.sender?.firstname?.[0] ?? "R").toUpperCase()}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isMe
              ? [styles.bubbleMe, { backgroundColor: "#007A53" }]
              : [styles.bubbleThem, { backgroundColor: colors.surface, borderColor: colors.border }],
          ]}
        >
          <Text style={[styles.bubbleText, { color: isMe ? "#FFFFFF" : colors.headline }]}>
            {msg.text}
          </Text>
          <Text style={[styles.bubbleTime, { color: isMe ? "rgba(255,255,255,0.65)" : colors.muted }]}>
            {formatTime(msg.createdAt)}
            {isMe && <Text style={styles.readTick}>{"  "}{msg.read ? "✓✓" : "✓"}</Text>}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.background }]}>
          <ChevronLeft size={22} color={colors.headline} />
        </Pressable>
        <View style={[styles.headerAvatar, { backgroundColor: "#007A53" }]}>
          <Truck size={18} color="#FFFFFF" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.headline }]} numberOfLines={1}>
            {riderName}
          </Text>
          <View style={styles.headerStatus}>
            <View style={[styles.statusDot, { backgroundColor: connected ? "#22C55E" : "#9CA3AF" }]} />
            <Text style={[styles.statusText, { color: colors.muted }]}>
              {typeof idParam === "string" ? `Order #${idParam.slice(-6).toUpperCase()}` : "Delivery chat"}
              {!connected ? " • Reconnecting…" : ""}
            </Text>
          </View>
        </View>
        {!connected && <WifiOff size={18} color={colors.muted} />}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007A53" />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Opening chat…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <MessageCircle size={38} color="#007A53" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.headline }]}>Chat unavailable</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>{loadError}</Text>
          <Pressable onPress={() => router.back()} style={styles.backToOrder}>
            <Text style={styles.backToOrderText}>Back to order</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {messages.length === 0 ? (
            <View style={styles.centered}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
                <MessageCircle size={38} color="#007A53" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.headline }]}>Say hello</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Message {riderName} about your delivery — landmarks, gate codes, delays.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}
          <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message your rider…"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                { color: colors.headline, backgroundColor: colors.background, borderColor: colors.border },
              ]}
              multiline
              maxLength={2000}
              returnKeyType="default"
            />
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || sending || !connected}
              style={[styles.sendBtn, { backgroundColor: text.trim() && connected ? "#007A53" : colors.border }]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Send size={18} color={text.trim() && connected ? "#FFFFFF" : colors.muted} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: "800" },
  headerStatus: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11 },
  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 6, gap: 8 },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubbleRowLeft: { justifyContent: "flex-start" },
  avatar: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  avatarText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  bubble: { maxWidth: "75%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4, textAlign: "right" },
  readTick: { fontSize: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { fontSize: 19, fontWeight: "800" },
  emptyText: { fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 20, maxWidth: 280 },
  backToOrder: { marginTop: 18, height: 44, paddingHorizontal: 24, borderRadius: 12, backgroundColor: "#007A53", alignItems: "center", justifyContent: "center" },
  backToOrderText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 42, maxHeight: 110, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sendBtn: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
