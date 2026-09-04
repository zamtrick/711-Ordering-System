import { Link } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

const login = () => {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>hello</Text>
      <Text>World</Text>

      <Link href="/(rider)">Go to Homepage</Link>
    </View>
  );
};

export default login;
