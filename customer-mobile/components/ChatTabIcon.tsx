import { View, Text, type ColorValue } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { useChat } from "@/context/ChatContext";

export default function ChatTabIcon({
  color,
  size,
}: {
  color: ColorValue;
  size: number;
}) {
  const { unread } = useChat();

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <MessageCircle color={color} size={size} />
      {unread > 0 && (
        <View
          style={{
            position: "absolute",
            top: -2,
            right: -6,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: "#DA291C",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 9,
              fontWeight: "800",
              lineHeight: 16,
            }}
          >
            {unread > 99 ? "99+" : unread}
          </Text>
        </View>
      )}
    </View>
  );
}
