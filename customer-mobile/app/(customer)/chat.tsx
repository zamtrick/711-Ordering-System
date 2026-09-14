import { useState, useEffect, useRef } from "react";
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
  ScrollView,
} from "react-native";
import {
  ChevronLeft,
  Send,
  MessageCircle,
  WifiOff,
  Store,
  ChevronDown,
} from "lucide-react-native";
import { router } from "expo-router";

import useTheme from "@/hooks/useTheme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";
import { useSocket } from "@/context/SocketContext";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Branch = {
  _id: string;
  name: string;
  branchCode: string;
};

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
  branch: { _id: string; name: string; branchCode: string };
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
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

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
  const { theme } = useTheme();
  const { colors } = theme;
  const { socket, connected } = useSocket();

  // ── branch picker ─────────────────────────────────
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // ── chat ──────────────────────────────────────────
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const convIdRef = useRef<string | null>(null);

  // --------------------------------------------------
  // LOAD BRANCHES on mount
  // --------------------------------------------------

  useEffect(() => {
    api
      .get("/customer/branches")
      .then((res) => {
        const list: Branch[] = res.data?.data ?? [];
        setBranches(list);
        if (list.length === 1) setSelectedBranch(list[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingBranches(false));
  }, []);

  // --------------------------------------------------
  // LOAD CONVERSATION whenever selectedBranch changes
  // --------------------------------------------------

  useEffect(() => {
    if (!selectedBranch) return;

    // Leave any previous conversation room
    if (convIdRef.current && socket) {
      socket.emit("leave_conversation", { conversationId: convIdRef.current });
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset chat when branch changes
    setConversation(null);
    setMessages([]);
    convIdRef.current = null;
    setLoadingChat(true);

    let mounted = true;

    const load = async () => {
      try {
        const convRes = await api.get("/chat/conversation", {
          params: { branchId: selectedBranch._id },
        });
        const convo: Conversation = convRes.data?.data;
        if (!convo?._id) throw new Error("No conversation");
        if (!mounted) return;

        setConversation(convo);
        convIdRef.current = convo._id;

        const msgRes = await api.get(`/chat/conversations/${convo._id}/messages`);
        if (mounted) setMessages(msgRes.data?.data ?? []);
      } catch (err: any) {
        if (err?.response?.status === 401) router.replace("/(auth)/login");
      } finally {
        if (mounted) setLoadingChat(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [selectedBranch?._id]);

  // --------------------------------------------------
  // JOIN CONVERSATION ROOM once socket + convo ready
  // --------------------------------------------------

  useEffect(() => {
    if (!socket || !connected || !convIdRef.current) return;
    socket.emit("join_conversation", { conversationId: convIdRef.current });
    return () => {
      if (convIdRef.current) {
        socket.emit("leave_conversation", { conversationId: convIdRef.current });
      }
    };
  }, [socket, connected, conversation?._id]);

  // --------------------------------------------------
  // REAL-TIME — INCOMING MESSAGES
  // --------------------------------------------------

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };
    socket.on("new_message", handler);
    return () => { socket.off("new_message", handler); };
  }, [socket]);

  // --------------------------------------------------
  // AUTO-SCROLL
  // --------------------------------------------------

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
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
          setText(trimmed);
        }
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
          <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dateLabel, { color: colors.muted }]}>{item.label}</Text>
          <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
        </View>
      );
    }
    const msg = item.data;
    const isMe = msg.senderRole === "customer";
    return (
      <View style={[styles.bubbleRow, isMe ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
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

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  if (loadingBranches) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      {/* ── HEADER ───────────────────────── */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
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
          <Text style={[styles.headerTitle, { color: colors.headline }]}>Support</Text>
          {selectedBranch ? (
            <Text style={[styles.headerSub, { color: colors.muted }]} numberOfLines={1}>
              {selectedBranch.name}
            </Text>
          ) : (
            <View style={styles.headerStatus}>
              <View style={[styles.statusDot, { backgroundColor: connected ? "#22C55E" : "#9CA3AF" }]} />
              <Text style={[styles.statusText, { color: colors.muted }]}>
                {connected ? "Online" : "Reconnecting…"}
              </Text>
            </View>
          )}
        </View>

        {!connected && <WifiOff size={18} color={colors.muted} />}
      </View>

      {/* ── BRANCH PICKER ────────────────── */}
      <View style={[styles.branchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Store size={14} color="#007A53" />
        <Text style={[styles.branchLabel, { color: colors.muted }]}>Branch:</Text>

        {/* Branch selector */}
        <Pressable
          onPress={() => setShowBranchPicker((v) => !v)}
          style={[styles.branchSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
        >
          <Text style={[styles.branchSelectorText, { color: colors.headline }]} numberOfLines={1}>
            {selectedBranch ? selectedBranch.name : "Select a branch…"}
          </Text>
          <ChevronDown size={14} color={colors.muted} />
        </Pressable>
      </View>

      {/* Branch dropdown */}
      {showBranchPicker && (
        <View style={[styles.branchDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            {branches.map((b) => (
              <Pressable
                key={b._id}
                onPress={() => {
                  setSelectedBranch(b);
                  setShowBranchPicker(false);
                }}
                style={[
                  styles.branchOption,
                  { borderBottomColor: colors.border },
                  selectedBranch?._id === b._id && { backgroundColor: "#E8F5EF" },
                ]}
              >
                <Text
                  style={[
                    styles.branchOptionText,
                    { color: selectedBranch?._id === b._id ? "#007A53" : colors.headline },
                  ]}
                >
                  {b.name}
                </Text>
                <Text style={[styles.branchOptionCode, { color: colors.muted }]}>
                  #{b.branchCode}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── CHAT AREA ────────────────────── */}
      {!selectedBranch ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <Store size={38} color="#007A53" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.headline }]}>Choose a branch</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Select a branch above to chat with their support team.
          </Text>
        </View>
      ) : loadingChat ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007A53" />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Loading chat…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
                <MessageCircle size={38} color="#007A53" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.headline }]}>Start a conversation</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Send a message and the {selectedBranch.name} team will reply shortly.
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
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}

          {/* Input bar */}
          <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
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
              style={[
                styles.sendBtn,
                { backgroundColor: text.trim() && connected ? "#007A53" : colors.border },
              ]}
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

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: "800" },
  headerSub: { fontSize: 11, marginTop: 2 },
  headerStatus: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11 },

  // Branch bar
  branchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  branchLabel: { fontSize: 12, fontWeight: "600" },
  branchSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  branchSelectorText: { fontSize: 13, fontWeight: "600", flex: 1 },
  branchDropdown: {
    position: "absolute",
    top: 116, // below header + branch bar
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 12,
    zIndex: 99,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  branchOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  branchOptionText: { fontSize: 13, fontWeight: "600" },
  branchOptionCode: { fontSize: 11 },

  // Messages
  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  dateSeparator: { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 8 },
  dateLine: { flex: 1, height: 1 },
  dateLabel: { fontSize: 11, fontWeight: "600" },

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

  // Empty state
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { fontSize: 19, fontWeight: "800" },
  emptyText: { fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 20, maxWidth: 260 },

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
  sendBtn: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
