import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import api from "@/api/axios";
import { useSocket } from "@/context/SocketContext";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export type ChatMessage = {
  _id: string;
  conversation: string;
  sender: { _id: string; firstname: string; lastname: string };
  senderRole: "customer" | "admin";
  text: string;
  read: boolean;
  createdAt: string;
};

export type Conversation = {
  _id: string;
  customer: { _id: string; firstname: string; lastname: string; email: string };
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCustomer: number;
};

type ChatContextType = {
  conversation: Conversation | null;
  messages: ChatMessage[];
  connected: boolean;
  unread: number;
  sendMessage: (text: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  markOpened: () => void;
};

// --------------------------------------------------
// CONTEXT
// --------------------------------------------------

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// --------------------------------------------------
// PROVIDER
// --------------------------------------------------
// Reuses the single authenticated socket from SocketProvider
// (which fetches the JWT via /auth/token and passes it in the
// handshake auth). This context no longer opens its own socket.

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { socket, connected } = useSocket();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);

  // --------------------------------------------------
  // Load or create the conversation
  // --------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    api
      .get("/chat/conversation")
      .then((res) => {
        if (cancelled) return;
        const convo: Conversation = res.data?.data;
        if (convo) {
          setConversation(convo);
          setUnread(convo.unreadCustomer ?? 0);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // --------------------------------------------------
  // Real-time — conversation updates + new messages
  // (attached to the shared authenticated socket)
  // --------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const handleConversationUpdated = (updated: Conversation) => {
      setConversation(updated);
      setUnread(updated.unreadCustomer ?? 0);
    };

    const handleNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    socket.on("conversation_updated", handleConversationUpdated);
    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("conversation_updated", handleConversationUpdated);
      socket.off("new_message", handleNewMessage);
    };
  }, [socket]);

  // --------------------------------------------------
  // Load messages + join room
  // --------------------------------------------------
  const loadMessages = useCallback(async () => {
    if (!conversation || !socket) return;
    try {
      const res = await api.get(
        `/chat/conversations/${conversation._id}/messages`,
      );
      setMessages(res.data?.data ?? []);
      setUnread(0);
      socket.emit("join_conversation", {
        conversationId: conversation._id,
      });
    } catch {}
  }, [conversation, socket]);

  // --------------------------------------------------
  // Mark opened (reset unread without fetching messages again)
  // --------------------------------------------------
  const markOpened = useCallback(() => {
    setUnread(0);
    if (conversation && socket) {
      socket.emit("join_conversation", {
        conversationId: conversation._id,
      });
    }
  }, [conversation, socket]);

  // --------------------------------------------------
  // Send message
  // --------------------------------------------------
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !conversation) return;

      return new Promise<void>((resolve, reject) => {
        if (!socket) {
          reject(new Error("Socket not connected"));
          return;
        }

        socket.emit(
          "send_message",
          { conversationId: conversation._id, text: text.trim() },
          (ack: { success: boolean; data?: ChatMessage }) => {
            if (ack?.success && ack.data) {
              setMessages((prev) => {
                if (prev.some((m) => m._id === ack.data!._id)) return prev;
                return [...prev, ack.data!];
              });
              resolve();
            } else {
              reject(new Error("Failed to send message"));
            }
          },
        );
      });
    },
    [conversation, socket],
  );

  return (
    <ChatContext.Provider
      value={{
        conversation,
        messages,
        connected,
        unread,
        sendMessage,
        loadMessages,
        markOpened,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

// --------------------------------------------------
// HOOK
// --------------------------------------------------

export const useChat = (): ChatContextType => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
};
