import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import {
  House,
  ShoppingBag,
  ShoppingCart,
  ClipboardList,
} from "lucide-react-native";
import { LightTheme, DarkTheme } from "@/constants/theme";

const CustomerLayout = () => {
  const colorScheme = useColorScheme(); // either dark || light

  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#078080",
        tabBarInactiveTintColor: "#888",
        tabBarStyle: {
          //attribute of the taskbar
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border, //border of the tab nav
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color, size }) => (
            <ShoppingBag color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => (
            <ShoppingCart color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => (
            <ClipboardList color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
};

export default CustomerLayout;
