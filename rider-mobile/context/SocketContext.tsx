import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import api from "@/api/axios";
import { useAuth } from "./AuthContext";

// --------------------------------------------------
// Socket.io attaches to the server root, not /api
// --------------------------------------------------

const socketURL = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type SocketContextType = {
  socket: Socket | null;
  connected: boolean;
  reconnect: () => void;
};

// --------------------------------------------------
// CONTEXT
// --------------------------------------------------

export const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  reconnect: () => {},
});

// --------------------------------------------------
// PROVIDER
// --------------------------------------------------

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const tokenRetryRef = useRef(false);
  const initRef = useRef<() => void>(() => {});
  const { user } = useAuth();
  const userKey = user?._id ?? user?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    const teardown = (s: Socket | null) => {
      if (!s) return;
      s.off("connect");
      s.off("disconnect");
      s.off("connect_error");
      s.disconnect();
    };

    const init = async () => {
      teardown(socketRef.current);
      socketRef.current = null;
      if (!cancelled) {
        setSocket(null);
        setConnected(false);
      }
      tokenRetryRef.current = false;

      // The httpOnly cookie can't be read by JS directly, so
      // /auth/token validates the cookie and echoes the value
      // back in the JSON body. The socket then sends it in the
      // handshake auth object, which the server reads as a fallback
      // when no cookie header is present (common on React Native).
      let token = "";
      try {
        const res = await api.get("/auth/token");
        token = res.data?.token ?? "";
      } catch {
        // Not logged in yet — don't connect
        return;
      }

      if (cancelled || !token) return;

      const s = io(socketURL, {
        withCredentials: true,
        transports: ["websocket"],
        auth: { token },
      });

      socketRef.current = s;
      setSocket(s);

      const onConnect = () => {
        if (!cancelled) setConnected(true);
      };
      const onDisconnect = () => {
        if (!cancelled) setConnected(false);
      };
      const onConnectError = async (err: Error) => {
        console.log("Socket connect_error:", err.message);
        // Token may have rotated — refresh once and reconnect
        // instead of permanently disabling reconnection.
        if (
          (err.message === "Authentication required" ||
            err.message === "Invalid or expired token") &&
          !tokenRetryRef.current
        ) {
          tokenRetryRef.current = true;
          try {
            const res = await api.get("/auth/token");
            const fresh = res.data?.token ?? "";
            if (fresh && !cancelled) {
              s.auth = { ...(s.auth ?? {}), token: fresh };
              s.connect();
            }
          } catch {
            // Keep socket.io's own reconnection running
          }
        }
      };

      s.on("connect", onConnect);
      s.on("disconnect", onDisconnect);
      s.on("connect_error", onConnectError);
    };

    initRef.current = () => {
      void init();
    };
    void init();

    return () => {
      cancelled = true;
      teardown(socketRef.current);
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [userKey]);

  const reconnect = useCallback(() => {
    initRef.current();
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
}

// --------------------------------------------------
// HOOK
// --------------------------------------------------

export function useSocket(): SocketContextType {
  return useContext(SocketContext);
}
