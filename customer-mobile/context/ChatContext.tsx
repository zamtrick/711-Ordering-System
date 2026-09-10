import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import Constants from "expo-constants";
import api from "@/api/axios";

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

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);

  // --------------------------------------------------
  // Init socket + conversation on mount
  // --------------------------------------------------
  useEffect(() => {
    const serverUrl = (
      Constants.expoConfig?.extra?.apiUrl as string | undefined
    )?.replace(/\/api\/?$/, "") ?? "http://localhost:5000";

    const socket = io(serverUrl, {
      withCredentials: true,
      transports: ["websocket"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    // Server pushes an updated conversation object when a message arrives
    socket.on("conversation_updated", (updated: Conversation) => {
      setConversation(updated);
      setUnread(updated.unreadCustomer ?? 0);
    });

    // New message while the chat pane is open
    socket.on("new_message", (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    // Load or create the conversation
    api
      .get("/chat/conversation")
      .then((res) => {
        const convo: Conversation = res.data?.data;
        if (convo) {
          setConversation(convo);
          setUnread(convo.unreadCustomer ?? 0);
        }
      })
      .catch(() => {});

    return () => {
      socket.disconnect();
    };
  }, []);

  // --------------------------------------------------
  // Load messages + join room
  // --------------------------------------------------
  const loadMessages = useCallback(async () => {
    if (!conversation) return;
    try {
      const res = await api.get(
        `/chat/conversations/${conversation._id}/messages`,
      );
      setMessages(res.data?.data ?? []);
      setUnread(0);
      socketRef.current?.emit("join_conversation", {
        conversationId: conversation._id,
      });
    } catch {}
  }, [conversation]);

  // --------------------------------------------------
  // Mark opened (reset unread without fetching messages again)
  // --------------------------------------------------
  const markOpened = useCallback(() => {
    setUnread(0);
    if (conversation) {
      socketRef.current?.emit("join_conversation", {
        conversationId: conversation._id,
      });
    }
  }, [conversation]);

  // --------------------------------------------------
  // Send message
  // --------------------------------------------------
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !conversation) return;

      return new Promise<void>((resolve, reject) => {
        socketRef.current?.emit(
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
    [conversation],
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
