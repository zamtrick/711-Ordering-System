import { View } from "react-native";
import { Link } from "expo-router";

const Home = () => {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Link href="/(auth)/login">Login</Link>
    </View>
  );
};

export default Home;
