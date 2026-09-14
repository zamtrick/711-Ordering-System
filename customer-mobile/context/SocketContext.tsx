import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import api, { baseURL } from "@/api/axios";

// --------------------------------------------------
// URLs
// --------------------------------------------------

// Socket.io attaches to the server root, not /api
const socketURL = baseURL.replace(/\/api\/?$/, "");

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type SocketContextType = {
  socket: Socket | null;
  connected: boolean;
  reconnect: () => Promise<void>;
};

// --------------------------------------------------
// CONTEXT
// --------------------------------------------------

export const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  reconnect: async () => {},
});

// --------------------------------------------------
// PROVIDER
// --------------------------------------------------

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const retriedRef = useRef(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const attach = (s: Socket) => {
      const onConnect = () => setConnected(true);
      const onDisconnect = () => setConnected(false);
      const onConnectError = async (err: Error) => {
        console.log("Socket connect_error:", err.message);
        if (err.message === "Invalid or expired token" && !retriedRef.current) {
          retriedRef.current = true;
          try {
            const res = await api.get("/auth/token");
            const fresh = res.data?.token ?? "";
            if (!fresh || cancelled) return;
            s.auth = { token: fresh };
            s.connect();
          } catch {
            // give up — leave reconnection enabled
          }
        }
      };
      s.on("connect", onConnect);
      s.on("disconnect", onDisconnect);
      s.on("connect_error", onConnectError);
      return () => {
        s.off("connect", onConnect);
        s.off("disconnect", onDisconnect);
        s.off("connect_error", onConnectError);
      };
    };

    let detach: (() => void) | null = null;

    const init = async () => {
      // --------------------------------------------------
      // Fetch the raw JWT from the server.
      // The httpOnly cookie can't be read by JS directly, so
      // /auth/token validates the cookie and echoes the value
      // back in the JSON body. The socket then sends it in the
      // handshake auth object, which the server reads as a fallback
      // when no cookie header is present (common on React Native).
      // --------------------------------------------------
      let token = "";
      try {
        const res = await api.get("/auth/token");
        token = res.data?.token ?? "";
      } catch (err) {
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
      detach = attach(s);
    };

    init();

    return () => {
      cancelled = true;
      detach?.();
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, []);

  const reconnect = async () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocket(null);
    setConnected(false);
    retriedRef.current = false;
    try {
      const res = await api.get("/auth/token");
      const token = res.data?.token ?? "";
      if (!token) return;
      const s = io(socketURL, {
        withCredentials: true,
        transports: ["websocket"],
        auth: { token },
      });
      const onConnect = () => setConnected(true);
      const onDisconnect = () => setConnected(false);
      const onConnectError = async (err: Error) => {
        console.log("Socket connect_error:", err.message);
        if (err.message === "Invalid or expired token" && !retriedRef.current) {
          retriedRef.current = true;
          try {
            const r = await api.get("/auth/token");
            const fresh = r.data?.token ?? "";
            if (!fresh) return;
            s.auth = { token: fresh };
            s.connect();
          } catch {
            // give up — leave reconnection enabled
          }
        }
      };
      s.on("connect", onConnect);
      s.on("disconnect", onDisconnect);
      s.on("connect_error", onConnectError);
      socketRef.current = s;
      setSocket(s);
    } catch {
      // Not logged in — stay disconnected
    }
  };

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
