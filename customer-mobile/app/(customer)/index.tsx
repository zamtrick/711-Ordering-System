import { View } from "react-native";
import { Link } from "expo-router";
import ThemedView from "@/components/ThemedView";

const Home = () => {
  return (
    <ThemedView
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Link href="/(auth)/login">Login</Link>
    </ThemedView>
  );
};

export default Home;
