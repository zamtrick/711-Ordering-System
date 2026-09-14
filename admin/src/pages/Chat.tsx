import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, Send, Users, WifiOff, Search, Store } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Branch = {
  _id: string;
  name: string;
  branchCode: string;
};

type Conversation = {
  _id: string;
  customer: {
    _id: string;
    firstname: string;
    lastname: string;
    email: string;
  };
  branch: Branch;
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
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const initials = (c: Conversation["customer"]) =>
  `${c.firstname[0] ?? ""}${c.lastname[0] ?? ""}`.toUpperCase();

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function Chat() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";

  // ── socket ───────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // ── branch filter (superadmin only) ─────────────
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>(""); // "" = all

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

    socket.on("new_message", (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on("conversation_updated", (updated: Conversation) => {
      setConversations((prev) =>
        prev
          .map((c) => (c._id === updated._id ? { ...c, ...updated } : c))
          .sort((a, b) => ((b.lastMessageAt ?? "") > (a.lastMessageAt ?? "") ? 1 : -1)),
      );
      if (activeConvRef.current?._id === updated._id) {
        setActiveConv((prev) => (prev ? { ...prev, unreadAdmin: 0 } : prev));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // --------------------------------------------------
  // LOAD BRANCHES (superadmin only — for filter)
  // --------------------------------------------------

  useEffect(() => {
    if (!isSuperAdmin) return;
    api
      .get("/superadmin/branches")
      .then((res) => setBranches(res.data?.data ?? res.data?.branches ?? []))
      .catch(() => {});
  }, [isSuperAdmin]);

  // --------------------------------------------------
  // FETCH CONVERSATIONS (re-runs when branch filter changes)
  // --------------------------------------------------

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const params: Record<string, string> = {};
      if (isSuperAdmin && branchFilter) params.branchId = branchFilter;
      const res = await api.get("/chat/conversations", { params });
      setConversations(res.data?.data ?? []);
    } catch (e) {
      console.error("Load conversations error:", e);
    } finally {
      setLoadingConvs(false);
    }
  }, [branchFilter, isSuperAdmin]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // --------------------------------------------------
  // OPEN A CONVERSATION
  // --------------------------------------------------

  const openConversation = useCallback(async (conv: Conversation) => {
    if (activeConvRef.current) {
      socketRef.current?.emit("leave_conversation", {
        conversationId: activeConvRef.current._id,
      });
    }

    setActiveConv({ ...conv, unreadAdmin: 0 });
    setMessages([]);
    setLoadingMsgs(true);

    socketRef.current?.emit("join_conversation", { conversationId: conv._id });

    try {
      const res = await api.get(`/chat/conversations/${conv._id}/messages`);
      setMessages(res.data?.data ?? []);
    } catch (e) {
      console.error("Load messages error:", e);
    } finally {
      setLoadingMsgs(false);
    }

    setConversations((prev) =>
      prev.map((c) => (c._id === conv._id ? { ...c, unreadAdmin: 0 } : c)),
    );
  }, []);

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
  // FILTER
  // --------------------------------------------------

  const filtered = conversations.filter(
    (c) =>
      `${c.customer.firstname} ${c.customer.lastname}`
        .toLowerCase()
        .includes(convSearch.toLowerCase()) ||
      c.customer.email.toLowerCase().includes(convSearch.toLowerCase()),
  );

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadAdmin ?? 0), 0);

  // Group messages by date
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

  const surface = isDark ? "bg-surface" : "bg-white";
  const border = isDark ? "border-line" : "border-line";
  const headline = isDark ? "text-white" : "text-ink";
  const muted = isDark ? "text-muted" : "text-muted";
  const inputBg = isDark
    ? "bg-surface border-line text-white"
    : "bg-sunken border-line text-ink";
  const hoverRow = isDark ? "hover:bg-sunken" : "hover:bg-sunken";
  const activeRow = isDark ? "bg-accent-soft" : "bg-accent-soft";

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    // h-full fills the padded content area AppLayout gives this route exactly
    // (no viewport math), so nothing overflows or gets clipped at the bottom.
    <div className="flex h-full min-h-[480px] gap-4">

      {/* ══════════════════════════════════════════
          LEFT PANEL — conversation list
      ══════════════════════════════════════════ */}
      <div className={`w-80 shrink-0 flex flex-col rounded-2xl border ${surface} ${border} overflow-hidden`}>

        {/* Header */}
        <div className={`px-4 py-4 border-b ${border}`}>
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={18} className="text-accent" />
            <h2 className={`text-base font-bold ${headline}`}>Support Chat</h2>

            {totalUnread > 0 && (
              <span className="text-xs font-bold bg-danger text-white px-2 py-0.5 rounded-full">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}

            <span
              className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                connected
                  ? isDark ? "bg-accent-soft text-accent-ink" : "bg-accent-soft text-accent"
                  : isDark ? "bg-sunken text-muted" : "bg-sunken text-muted"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-accent-ink" : "bg-faint"}`} />
              {connected ? "Live" : "Off"}
            </span>
          </div>

          {/* Branch filter — superadmin only */}
          {isSuperAdmin && (
            <div className="mb-2">
              <div className={`flex items-center gap-2 h-9 px-3 rounded-xl border ${inputBg}`}>
                <Store size={13} className="text-accent shrink-0" />
                <select
                  value={branchFilter}
                  onChange={(e) => {
                    setBranchFilter(e.target.value);
                    setActiveConv(null);
                    setMessages([]);
                  }}
                  className="flex-1 bg-transparent outline-none text-xs appearance-none cursor-pointer"
                >
                  <option value="">All branches</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Search */}
          <div className={`flex items-center gap-2 h-9 px-3 rounded-xl border ${inputBg}`}>
            <Search size={13} className={muted} />
            <input
              type="text"
              placeholder="Search customers…"
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-xs text-ink placeholder:text-faint"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            // Skeleton rows keep the panel height stable while loading
            <div className="p-3 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className={`w-10 h-10 rounded-full ${isDark ? "bg-sunken" : "bg-sunken"}`} />
                  <div className="flex-1 space-y-1.5">
                    <div className={`h-3 rounded w-1/2 ${isDark ? "bg-sunken" : "bg-sunken"}`} />
                    <div className={`h-2.5 rounded w-3/4 ${isDark ? "bg-sunken" : "bg-sunken"}`} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full gap-2 px-6 text-center ${muted}`}>
              <Users size={32} />
              <p className="text-sm font-medium">No conversations</p>
              <p className="text-xs">
                {convSearch ? "No customers match your search." : "Customer chats will appear here."}
              </p>
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
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold">
                      {initials(conv.customer)}
                    </div>
                    {/* Unread dot on avatar — visible even when scrolled */}
                    {conv.unreadAdmin > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-danger rounded-full border-2 border-white dark:border-surface" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-semibold truncate ${isActive ? "text-accent-ink" : headline}`}>
                        {conv.customer.firstname} {conv.customer.lastname}
                      </p>
                      {conv.lastMessageAt && (
                        <p className={`text-xs shrink-0 ml-1 ${muted}`}>
                          {formatDate(conv.lastMessageAt)}
                        </p>
                      )}
                    </div>

                    {/* Branch badge (superadmin sees all branches) */}
                    {conv.branch && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${
                        isDark ? "bg-accent-soft text-accent-ink" : "bg-accent-soft text-accent"
                      }`}>
                        <Store size={9} />
                        {conv.branch.name}
                      </span>
                    )}

                    <p className={`text-xs truncate mt-0.5 ${conv.unreadAdmin > 0 ? "font-medium text-ink" : muted}`}>
                      {conv.lastMessage || "No messages yet"}
                    </p>
                  </div>

                  {/* Unread count */}
                  {conv.unreadAdmin > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
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
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
                {initials(activeConv.customer)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${headline}`}>
                  {activeConv.customer.firstname} {activeConv.customer.lastname}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-xs truncate ${muted}`}>{activeConv.customer.email}</p>
                  {activeConv.branch && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      isDark ? "bg-accent-soft text-accent-ink" : "bg-accent-soft text-accent"
                    }`}>
                      <Store size={9} />
                      {activeConv.branch.name}
                    </span>
                  )}
                </div>
              </div>

              {!connected && (
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                  isDark ? "bg-warning-soft text-warning" : "bg-warning-soft text-warning"
                }`}>
                  <WifiOff size={13} />
                  Reconnecting…
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingMsgs ? (
                // Bubble skeletons while the thread loads
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"} animate-pulse`}>
                      <div className={`h-10 rounded-2xl ${i % 2 ? "w-52" : "w-64"} ${isDark ? "bg-sunken" : "bg-sunken"}`} />
                    </div>
                  ))}
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
                    <div className="flex items-center gap-3 my-4">
                      <div className={`flex-1 h-px ${isDark ? "bg-sunken" : "bg-line"}`} />
                      <span className={`text-xs font-semibold ${muted}`}>{group.date}</span>
                      <div className={`flex-1 h-px ${isDark ? "bg-sunken" : "bg-line"}`} />
                    </div>

                    {group.msgs.map((msg) => {
                      const isAdmin = msg.senderRole === "admin";
                      return (
                        <div key={msg._id} className={`flex items-end mb-2 gap-2 ${isAdmin ? "justify-end" : "justify-start"}`}>
                          {!isAdmin && (
                            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {initials(activeConv.customer)}
                            </div>
                          )}

                          <div
                            className={`max-w-[68%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isAdmin
                                ? "bg-accent text-white rounded-br-sm"
                                : isDark
                                ? "bg-sunken text-white rounded-bl-sm border border-line"
                                : "bg-sunken text-ink rounded-bl-sm border border-line"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            <p className={`text-[10px] mt-1 text-right ${
                              isAdmin ? "text-white/60" : isDark ? "text-muted" : "text-muted"
                            }`}>
                              {formatTime(msg.createdAt)}
                              {isAdmin && <span className="ml-1">{msg.read ? " ✓✓" : " ✓"}</span>}
                            </p>
                          </div>

                          {isAdmin && (
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isDark ? "bg-sunken text-muted" : "bg-sunken text-muted"
                            }`}>
                              {user ? `${user.firstname[0]}${user.lastname[0]}`.toUpperCase() : "A"}
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

            {/* Input bar — branch admin only. Superadmin is read-only. */}
            {isSuperAdmin ? (
              <div className={`px-4 py-3 border-t ${border} flex items-center justify-center gap-2`}>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${isDark ? "bg-sunken text-muted" : "bg-sunken text-muted"}`}>
                  <MessageCircle size={12} />
                  View only — only the branch admin can reply
                </span>
              </div>
            ) : (
              <div className={`px-4 py-3 border-t ${border} flex items-end gap-3`}>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  className={`flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm outline-none max-h-28 ${inputBg} placeholder:text-faint`}
                  style={{ overflowY: "auto" }}
                  disabled={!connected}
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim() || sending || !connected}
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                    text.trim() && connected
                      ? "bg-accent text-white cursor-pointer hover:opacity-90"
                      : isDark
                      ? "bg-sunken text-muted cursor-not-allowed"
                      : "bg-line text-faint cursor-not-allowed"
                  }`}
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={`flex-1 flex flex-col items-center justify-center gap-3 ${muted}`}>
            <div className={`w-20 h-20 rounded-3xl ${isDark ? "bg-sunken" : "bg-sunken"} flex items-center justify-center`}>
              <MessageCircle size={38} className="text-accent" />
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
