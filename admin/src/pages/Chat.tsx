import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, Send, Users, WifiOff, Search } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Conversation = {
  _id: string;
  customer: {
    _id: string;
    firstname: string;
    lastname: string;
    email: string;
  };
  lastMessage: string;
  lastMessageAt: string | null;
  unreadAdmin: number;
};

type Message = {
  _id: string;
  text: string;
  senderRole: "customer" | "admin";
  sender?: { firstname: string; lastname: string };
  createdAt: string;
  read: boolean;
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const socketURL = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatTime(iso);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
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

const initials = (c: Conversation["customer"]) =>
  `${c.firstname[0] ?? ""}${c.lastname[0] ?? ""}`.toUpperCase();

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function Chat() {
  const { isDark } = useTheme();
  const { user } = useAuth();

  // ── socket ───────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // ── conversations list ───────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convSearch, setConvSearch] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);

  // ── active thread ────────────────────────────────
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef<Conversation | null>(null);
  activeConvRef.current = activeConv;

  // --------------------------------------------------
  // SOCKET — init once on mount
  // --------------------------------------------------

  useEffect(() => {
    const socket = io(socketURL, {
      withCredentials: true,
      transports: ["websocket"],
      autoConnect: true,
    });

    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // New message in the active thread
    socket.on("new_message", (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    // Conversation list update (new message from a customer, unread reset, etc.)
    socket.on("conversation_updated", (updated: Conversation) => {
      setConversations((prev) =>
        prev
          .map((c) => (c._id === updated._id ? { ...c, ...updated } : c))
          .sort((a, b) =>
            (b.lastMessageAt ?? "") > (a.lastMessageAt ?? "") ? 1 : -1,
          ),
      );

      // If the update is for the currently-open conversation, clear the badge
      if (activeConvRef.current?._id === updated._id) {
        setActiveConv((prev) =>
          prev ? { ...prev, unreadAdmin: 0 } : prev,
        );
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // --------------------------------------------------
  // FETCH ALL CONVERSATIONS
  // --------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/chat/conversations");
        setConversations(res.data?.data ?? []);
      } catch (e) {
        console.error("Load conversations error:", e);
      } finally {
        setLoadingConvs(false);
      }
    })();
  }, []);

  // --------------------------------------------------
  // OPEN A CONVERSATION
  // --------------------------------------------------

  const openConversation = useCallback(
    async (conv: Conversation) => {
      // Leave the previous room
      if (activeConvRef.current) {
        socketRef.current?.emit("leave_conversation", {
          conversationId: activeConvRef.current._id,
        });
      }

      setActiveConv({ ...conv, unreadAdmin: 0 });
      setMessages([]);
      setLoadingMsgs(true);

      // Join the new room
      socketRef.current?.emit("join_conversation", {
        conversationId: conv._id,
      });

      try {
        const res = await api.get(
          `/chat/conversations/${conv._id}/messages`,
        );
        setMessages(res.data?.data ?? []);
      } catch (e) {
        console.error("Load messages error:", e);
      } finally {
        setLoadingMsgs(false);
      }

      // Reset unread badge in list
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conv._id ? { ...c, unreadAdmin: 0 } : c,
        ),
      );
    },
    [],
  );

  // --------------------------------------------------
  // AUTO-SCROLL
  // --------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --------------------------------------------------
  // SEND MESSAGE
  // --------------------------------------------------

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !activeConv || !socketRef.current || !connected) return;

    setSending(true);
    setText("");

    socketRef.current.emit(
      "send_message",
      { conversationId: activeConv._id, text: trimmed },
      (ack: { success: boolean; data?: Message; message?: string }) => {
        setSending(false);
        if (!ack?.success) {
          alert(ack?.message ?? "Failed to send message.");
          setText(trimmed);
        }
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --------------------------------------------------
  // RENDER HELPERS
  // --------------------------------------------------

  const filtered = conversations.filter(
    (c) =>
      `${c.customer.firstname} ${c.customer.lastname}`
        .toLowerCase()
        .includes(convSearch.toLowerCase()) ||
      c.customer.email.toLowerCase().includes(convSearch.toLowerCase()),
  );

  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.unreadAdmin ?? 0),
    0,
  );

  // Group messages by date for date separators
  const grouped: { date: string; msgs: Message[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const label = formatDateLabel(msg.createdAt);
    if (label !== currentDate) {
      currentDate = label;
      grouped.push({ date: label, msgs: [msg] });
    } else {
      grouped[grouped.length - 1].msgs.push(msg);
    }
  }

  // --------------------------------------------------
  // COLOUR TOKENS
  // --------------------------------------------------

  const surface = isDark ? "bg-[#1E1E1E]" : "bg-white";
  const border = isDark ? "border-[#2E2E2E]" : "border-[#E5E2DE]";
  const headline = isDark ? "text-white" : "text-[#232323]";
  const muted = isDark ? "text-[#A0A0A0]" : "text-[#777]";
  const inputBg = isDark ? "bg-[#121212] border-[#2E2E2E] text-white" : "bg-[#F8F5F2] border-[#E5E2DE] text-[#232323]";
  const hoverRow = isDark ? "hover:bg-[#2A2A2A]" : "hover:bg-[#F8F5F2]";
  const activeRow = isDark ? "bg-[#0A3D3D]" : "bg-[#E8F5EF]";

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <div className="flex h-[calc(100vh-2rem)] gap-4">

      {/* ══════════════════════════════════════════
          LEFT PANEL — conversation list
      ══════════════════════════════════════════ */}
      <div className={`w-80 shrink-0 flex flex-col rounded-2xl border ${surface} ${border} overflow-hidden`}>

        {/* Header */}
        <div className={`px-4 py-4 border-b ${border}`}>
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={18} className="text-[#007A53] dark:text-[#078080]" />
            <h2 className={`text-base font-bold ${headline}`}>Support Chat</h2>

            {totalUnread > 0 && (
              <span className="ml-auto text-xs font-bold bg-[#DA291C] text-white px-2 py-0.5 rounded-full">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}

            {/* Connection pill */}
            <span
              className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                connected
                  ? isDark
                    ? "bg-[#0A3D3D] text-[#4CAF50]"
                    : "bg-[#E8F5EF] text-[#007A53]"
                  : isDark
                  ? "bg-[#2E2E2E] text-[#A0A0A0]"
                  : "bg-[#F0F0F0] text-[#777]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? "bg-[#22C55E]" : "bg-[#9CA3AF]"
                }`}
              />
              {connected ? "Live" : "Off"}
            </span>
          </div>

          {/* Search */}
          <div className={`flex items-center gap-2 h-9 px-3 rounded-xl border ${inputBg}`}>
            <Search size={13} className={muted} />
            <input
              type="text"
              placeholder="Search customers…"
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-xs placeholder-[#999]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className={`flex flex-col items-center justify-center h-full gap-2 ${muted}`}>
              <div className="w-5 h-5 border-2 border-[#007A53] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full gap-2 ${muted}`}>
              <Users size={32} />
              <p className="text-sm font-medium">No conversations</p>
            </div>
          ) : (
            filtered.map((conv) => {
              const isActive = activeConv?._id === conv._id;
              return (
                <button
                  key={conv._id}
                  onClick={() => openConversation(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b ${border} text-left transition-colors cursor-pointer
                    ${isActive ? activeRow : hoverRow}`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#007A53] dark:bg-[#078080] flex items-center justify-center shrink-0 text-white text-sm font-bold">
                    {initials(conv.customer)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-semibold truncate ${isActive ? "text-[#007A53] dark:text-[#4CAF50]" : headline}`}>
                        {conv.customer.firstname} {conv.customer.lastname}
                      </p>
                      {conv.lastMessageAt && (
                        <p className={`text-xs shrink-0 ml-1 ${muted}`}>
                          {formatDate(conv.lastMessageAt)}
                        </p>
                      )}
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${muted}`}>
                      {conv.lastMessage || "No messages yet"}
                    </p>
                  </div>

                  {/* Unread badge */}
                  {conv.unreadAdmin > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] bg-[#DA291C] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {conv.unreadAdmin > 9 ? "9+" : conv.unreadAdmin}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          RIGHT PANEL — message thread
      ══════════════════════════════════════════ */}
      <div className={`flex-1 flex flex-col rounded-2xl border ${surface} ${border} overflow-hidden`}>

        {activeConv ? (
          <>
            {/* Thread header */}
            <div className={`flex items-center gap-3 px-5 py-3.5 border-b ${border}`}>
              <div className="w-9 h-9 rounded-full bg-[#007A53] dark:bg-[#078080] flex items-center justify-center text-white text-sm font-bold shrink-0">
                {initials(activeConv.customer)}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${headline}`}>
                  {activeConv.customer.firstname} {activeConv.customer.lastname}
                </p>
                <p className={`text-xs ${muted}`}>{activeConv.customer.email}</p>
              </div>

              {!connected && (
                <div className={`flex items-center gap-1.5 text-xs ${muted}`}>
                  <WifiOff size={14} />
                  Reconnecting…
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-[#007A53] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : grouped.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-full gap-2 ${muted}`}>
                  <MessageCircle size={36} />
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs">Start the conversation below</p>
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-4">
                      <div className={`flex-1 h-px ${isDark ? "bg-[#2E2E2E]" : "bg-[#E5E2DE]"}`} />
                      <span className={`text-xs font-semibold ${muted}`}>
                        {group.date}
                      </span>
                      <div className={`flex-1 h-px ${isDark ? "bg-[#2E2E2E]" : "bg-[#E5E2DE]"}`} />
                    </div>

                    {group.msgs.map((msg) => {
                      const isAdmin = msg.senderRole === "admin";
                      return (
                        <div
                          key={msg._id}
                          className={`flex mb-2 ${isAdmin ? "justify-end" : "justify-start"}`}
                        >
                          {/* Customer avatar */}
                          {!isAdmin && (
                            <div className="w-7 h-7 rounded-full bg-[#007A53] dark:bg-[#078080] flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 shrink-0">
                              {initials(activeConv.customer)}
                            </div>
                          )}

                          <div
                            className={`max-w-[68%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isAdmin
                                ? "bg-[#007A53] dark:bg-[#078080] text-white rounded-br-sm"
                                : isDark
                                ? "bg-[#2A2A2A] text-white rounded-bl-sm border border-[#2E2E2E]"
                                : "bg-[#F8F5F2] text-[#232323] rounded-bl-sm border border-[#E5E2DE]"
                            }`}
                          >
                            <p>{msg.text}</p>
                            <p
                              className={`text-[10px] mt-1 text-right ${
                                isAdmin
                                  ? "text-white/60"
                                  : isDark
                                  ? "text-[#A0A0A0]"
                                  : "text-[#777]"
                              }`}
                            >
                              {formatTime(msg.createdAt)}
                              {isAdmin && (
                                <span className="ml-1">
                                  {msg.read ? " ✓✓" : " ✓"}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Admin avatar */}
                          {isAdmin && (
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ml-2 mt-1 shrink-0 ${
                                isDark
                                  ? "bg-[#2A2A2A] text-[#A0A0A0]"
                                  : "bg-[#F8F5F2] text-[#777]"
                              }`}
                            >
                              {user
                                ? `${user.firstname[0]}${user.lastname[0]}`.toUpperCase()
                                : "A"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className={`px-4 py-3 border-t ${border} flex items-end gap-3`}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                rows={1}
                className={`flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm outline-none max-h-28 ${inputBg} placeholder-[#999]`}
                style={{ overflowY: "auto" }}
                disabled={!connected}
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending || !connected}
                className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                  text.trim() && connected
                    ? "bg-[#007A53] dark:bg-[#078080] text-white cursor-pointer hover:opacity-90"
                    : isDark
                    ? "bg-[#2E2E2E] text-[#555] cursor-not-allowed"
                    : "bg-[#E5E2DE] text-[#aaa] cursor-not-allowed"
                }`}
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </>
        ) : (
          /* No conversation selected */
          <div className={`flex-1 flex flex-col items-center justify-center gap-3 ${muted}`}>
            <div className={`w-20 h-20 rounded-3xl ${isDark ? "bg-[#2A2A2A]" : "bg-[#F8F5F2]"} flex items-center justify-center`}>
              <MessageCircle size={38} className="text-[#007A53] dark:text-[#078080]" />
            </div>
            <p className={`text-base font-bold ${headline}`}>Select a conversation</p>
            <p className="text-sm text-center max-w-xs">
              Pick a customer from the list on the left to view their messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
