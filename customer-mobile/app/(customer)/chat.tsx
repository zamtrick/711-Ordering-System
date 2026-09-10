import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ChevronLeft, Send, MessageCircle, WifiOff } from "lucide-react-native";
import { router } from "expo-router";

import { LightTheme, DarkTheme } from "@/constants/theme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";
import { useSocket } from "@/context/SocketContext";
import { useSettings } from "@/context/SettingsContext";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Message = {
  _id: string;
  text: string;
  senderRole: "customer" | "admin";
  sender?: { firstname: string; lastname: string };
  createdAt: string;
  read: boolean;
};

type Conversation = {
  _id: string;
  unreadCustomer: number;
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
};

const formatDateLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Group messages by date so we can render date separators
const groupByDate = (messages: Message[]) => {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";

  for (const msg of messages) {
    const dateLabel = formatDateLabel(msg.createdAt);
    if (dateLabel !== currentDate) {
      currentDate = dateLabel;
      groups.push({ date: dateLabel, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
};

// Flatten groups into a FlatList-compatible item array
type ListItem =
  | { type: "date"; label: string; key: string }
  | { type: "message"; data: Message; key: string };

const flattenGroups = (groups: ReturnType<typeof groupByDate>): ListItem[] => {
  const items: ListItem[] = [];
  for (const group of groups) {
    items.push({ type: "date", label: group.date, key: `date-${group.date}` });
    for (const msg of group.messages) {
      items.push({ type: "message", data: msg, key: msg._id });
    }
  }
  return items;
};

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

export default function Chat() {
  const systemScheme = useColorScheme();
  const { themePreference } = useSettings();
  const resolvedScheme =
    themePreference === "system" ? systemScheme : themePreference;
  const theme = resolvedScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;

  const { socket, connected } = useSocket();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const convIdRef = useRef<string | null>(null);

  // --------------------------------------------------
  // LOAD CONVERSATION + HISTORY
  // --------------------------------------------------

  const loadConversation = useCallback(async () => {
    try {
      setLoading(true);

      // Get or create the customer's conversation
      const convRes = await api.get("/chat/conversation");
      const convo: Conversation = convRes.data?.data;
      if (!convo?._id) throw new Error("No conversation");

      setConversation(convo);
      convIdRef.current = convo._id;

      // Fetch message history
      const msgRes = await api.get(
        `/chat/conversations/${convo._id}/messages`,
      );
      setMessages(msgRes.data?.data ?? []);
    } catch (err: any) {
      console.log("Load chat error:", err);
      if (err?.response?.status === 401) router.replace("/(auth)/login");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // --------------------------------------------------
  // JOIN CONVERSATION ROOM ONCE BOTH ARE READY
  // --------------------------------------------------

  useEffect(() => {
    if (!socket || !connected || !convIdRef.current) return;

    socket.emit("join_conversation", {
      conversationId: convIdRef.current,
    });

    return () => {
      if (convIdRef.current) {
        socket.emit("leave_conversation", {
          conversationId: convIdRef.current,
        });
      }
    };
  }, [socket, connected, conversation]);

  // --------------------------------------------------
  // REAL-TIME — INCOMING MESSAGES
  // --------------------------------------------------

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => {
        // Deduplicate in case the ack-path already added it
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    socket.on("new_message", handleNewMessage);
    return () => { socket.off("new_message", handleNewMessage); };
  }, [socket]);

  // --------------------------------------------------
  // AUTO-SCROLL to bottom when messages change
  // --------------------------------------------------

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    }
  }, [messages]);

  // --------------------------------------------------
  // SEND MESSAGE
  // --------------------------------------------------

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !convIdRef.current || !socket || !connected) return;

    setSending(true);
    setText("");

    socket.emit(
      "send_message",
      { conversationId: convIdRef.current, text: trimmed },
      (ack: { success: boolean; data?: Message; message?: string }) => {
        setSending(false);
        if (!ack?.success) {
          Alert.alert("Error", ack?.message ?? "Failed to send message.");
          setText(trimmed); // restore so the user can retry
        }
        // new_message event will add it to state — no need to push here
      },
    );
  };

  // --------------------------------------------------
  // RENDER ITEMS
  // --------------------------------------------------

  const listItems = flattenGroups(groupByDate(messages));

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "date") {
      return (
        <View style={styles.dateSeparator}>
          <View
            style={[styles.dateLine, { backgroundColor: colors.border }]}
          />
          <Text style={[styles.dateLabel, { color: colors.muted }]}>
            {item.label}
          </Text>
          <View
            style={[styles.dateLine, { backgroundColor: colors.border }]}
          />
        </View>
      );
    }

    const msg = item.data;
    const isMe = msg.senderRole === "customer";

    return (
      <View
        style={[
          styles.bubbleRow,
          isMe ? styles.bubbleRowRight : styles.bubbleRowLeft,
        ]}
      >
        {!isMe && (
          <View style={[styles.avatar, { backgroundColor: "#007A53" }]}>
            <Text style={styles.avatarText}>A</Text>
          </View>
        )}

        <View
          style={[
            styles.bubble,
            isMe
              ? [styles.bubbleMe, { backgroundColor: "#007A53" }]
              : [
                  styles.bubbleThem,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ],
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isMe ? "#FFFFFF" : colors.headline },
            ]}
          >
            {msg.text}
          </Text>
          <Text
            style={[
              styles.bubbleTime,
              { color: isMe ? "rgba(255,255,255,0.65)" : colors.muted },
            ]}
          >
            {formatTime(msg.createdAt)}
            {isMe && (
              <Text style={styles.readTick}>
                {"  "}{msg.read ? "✓✓" : "✓"}
              </Text>
            )}
          </Text>
        </View>
      </View>
    );
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading chat…
        </Text>
      </ThemedView>
    );
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <ThemedView style={styles.screen}>
      {/* ── HEADER ─────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.background }]}
        >
          <ChevronLeft size={22} color={colors.headline} />
        </Pressable>

        <View style={[styles.headerAvatar, { backgroundColor: "#007A53" }]}>
          <MessageCircle size={18} color="#FFFFFF" />
        </View>

        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.headline }]}>
            Support
          </Text>
          <View style={styles.headerStatus}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: connected ? "#22C55E" : "#9CA3AF" },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.muted }]}>
              {connected ? "Online" : "Reconnecting…"}
            </Text>
          </View>
        </View>

        {!connected && (
          <WifiOff size={18} color={colors.muted} />
        )}
      </View>

      {/* ── MESSAGES ───────────────────────── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View
              style={[styles.emptyIcon, { backgroundColor: colors.surface }]}
            >
              <MessageCircle size={38} color="#007A53" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.headline }]}>
              Start a conversation
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Send us a message and our support team will reply shortly.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={listItems}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        {/* ── INPUT BAR ──────────────────── */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                color: colors.headline,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />

          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sending || !connected}
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  text.trim() && connected ? "#007A53" : colors.border,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send
                size={18}
                color={text.trim() && connected ? "#FFFFFF" : colors.muted}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: { marginTop: 12, fontSize: 14 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  headerInfo: { flex: 1 },

  headerTitle: { fontSize: 15, fontWeight: "800" },

  headerStatus: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },

  statusDot: { width: 7, height: 7, borderRadius: 4 },

  statusText: { fontSize: 11 },

  // Messages
  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },

  // Date separator
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 8,
  },

  dateLine: { flex: 1, height: 1 },

  dateLabel: { fontSize: 11, fontWeight: "600" },

  // Bubbles
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 6,
    gap: 8,
  },

  bubbleRowRight: { justifyContent: "flex-end" },

  bubbleRowLeft: { justifyContent: "flex-start" },

  avatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  avatarText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  bubbleMe: {
    borderBottomRightRadius: 4,
  },

  bubbleThem: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },

  bubbleText: { fontSize: 14, lineHeight: 20 },

  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
  },

  readTick: { fontSize: 10 },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyTitle: { fontSize: 19, fontWeight: "800" },

  emptyText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 260,
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },

  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },

  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
