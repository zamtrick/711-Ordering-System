import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import api from "@/api/axios";

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
};

// --------------------------------------------------
// CONTEXT
// --------------------------------------------------

export const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
});

// --------------------------------------------------
// PROVIDER
// --------------------------------------------------

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
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

      s.on("connect", () => setConnected(true));
      s.on("disconnect", () => setConnected(false));

      s.on("connect_error", (err) => {
        console.log("Socket connect_error:", err.message);
        // Auth errors won't fix themselves — stop retrying immediately
        if (
          err.message === "Authentication required" ||
          err.message === "Invalid or expired token"
        ) {
          s.io.opts.reconnection = false;
          s.disconnect();
        }
      });
    };

    init();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
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
