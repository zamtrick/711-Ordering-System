// Mock API for testing - replace with real API in production
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

const jar = new CookieJar();

// Mock data for testing
const mockData = {
  products: [
    {
      _id: "1",
      name: "Test Product 1",
      price: 10.0,
      stock: 10,
      categoryId: { _id: "cat1", name: "Test Category" },
    },
    {
      _id: "2",
      name: "Test Product 2",
      price: 20.0,
      stock: 5,
      categoryId: { _id: "cat2", name: "Another Category" },
    },
  ],
  branches: [{ _id: "branch1", name: "Test Branch" }],
  deliveryFee: { fee: 5.0 },
  auth: {
    me: { data: { role: "customer", email: "test@example.com" } },
    login: { success: true },
    logout: { success: true },
  },
  profile: {
    me: {
      data: {
        user: {
          firstname: "Test",
          lastname: "User",
          email: "test@example.com",
        },
        phone: "123456789",
        address: "123 Test St",
        age: "25",
      },
    },
  },
  orders: [],
  settings: { deliveryFee: { fee: 5.0 } },
};

const mock = wrapper(
  axios.create({
    baseURL: "http://localhost:3000/api",
    headers: {
      "Content-Type": "application/json",
    },
    jar,
    withCredentials: true,
  }),
);

// Mock all API calls
mock.interceptors.request.use((config) => {
  console.log("Mock API request:", config.method, config.url);
  return config;
});

mock.interceptors.response.use(
  (response) => {
    // Return mock data based on the endpoint
    const url = response.config.url || "";

    if (url.includes("/products")) {
      return { ...response, data: { success: true, data: mockData.products } };
    }
    if (url.includes("/branches")) {
      return { ...response, data: { success: true, data: mockData.branches } };
    }
    if (url.includes("/delivery-fee")) {
      return {
        ...response,
        data: { success: true, data: mockData.deliveryFee },
      };
    }
    if (url.includes("/auth/me")) {
      return { ...response, data: mockData.auth.me };
    }
    if (url.includes("/auth/login")) {
      return { ...response, data: mockData.auth.login };
    }
    if (url.includes("/auth/logout")) {
      return { ...response, data: mockData.auth.logout };
    }
    if (url.includes("/profile/me")) {
      if (response.config.method === "patch") {
        return {
          ...response,
          data: {
            ...mockData.profile.me,
            data: { ...mockData.profile.me.data, ...response.config.data },
          },
        };
      }
      return { ...response, data: mockData.profile.me };
    }
    if (url.includes("/orders") && !url.includes("/items")) {
      return { ...response, data: { success: true, orders: mockData.orders } };
    }
    if (url.includes("/orders") && url.includes("/items")) {
      return { ...response, data: { success: true } };
    }

    return response;
  },
  (error) => {
    console.log("Mock API error:", error);
    return Promise.reject(error);
  },
);

export default mock;
