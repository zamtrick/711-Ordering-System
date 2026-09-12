import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Alert } from "react-native";
import api from "@/api/axios";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export type FavoriteItem = {
  _id: string; // favorite document id
  createdAt: string;
  product: {
    _id: string;
    name: string;
    price: number;
    image?: string;
    stock: number;
    categoryId?: { _id: string; name: string };
  };
};

type ProductInput = {
  _id: string;
  name: string;
  price: number;
  image?: string;
  stock?: number;
  categoryId?: { _id: string; name: string } | string | null;
};

type FavoriteContextType = {
  /** Favorited product ids — fast heart-state lookups on product cards. */
  favoriteIds: Set<string>;
  /** Full favorite records for the Favorites screen. */
  items: FavoriteItem[];
  loading: boolean;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: {
    _id: string;
    name: string;
    price: number;
    image?: string;
    stock?: number;
    categoryId?: { _id: string; name: string } | string | null;
  }) => Promise<void>;
  refresh: () => Promise<void>;
  removeFavorite: (productId: string) => Promise<void>;
};

// --------------------------------------------------
// CONTEXT
// --------------------------------------------------

const FavoriteContext = createContext<FavoriteContextType | undefined>(
  undefined,
);

// --------------------------------------------------
// PROVIDER
// --------------------------------------------------

export const FavoriteProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/customer/favorites");
      const data = (res.data?.data ?? []) as FavoriteItem[];
      setItems(data);
    } catch {
      // Non-fatal — hearts just stay at their last known state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    refresh();
  }, [refresh]);

  const favoriteIds = new Set(items.map((i) => i.product._id));

  const isFavorite = useCallback(
    (productId: string) => favoriteIds.has(productId),
    [items],
  );

  const toggleFavorite = async (product: ProductInput) => {
    const id = product._id;
    if (pending.has(id)) return; // debounce double-taps
    setPending((prev) => new Set(prev).add(id));

    const wasFavorite = favoriteIds.has(id);

    // Optimistic update — flip the heart immediately
    if (wasFavorite) {
      setItems((prev) => prev.filter((i) => i.product._id !== id));
    } else {
      setItems((prev) => [
        {
          _id: `temp-${id}`,
          createdAt: new Date().toISOString(),
          product: {
            _id: id,
            name: product.name,
            price: product.price,
            image: product.image,
            stock: product.stock ?? 0,
            // Keep FavoriteItem strict — only object categories are stored
            categoryId:
              product.categoryId && typeof product.categoryId === "object"
                ? product.categoryId
                : undefined,
          },
        },
        ...prev,
      ]);
    }

    try {
      if (wasFavorite) {
        await api.delete(`/customer/favorites/${id}`);
      } else {
        await api.post("/customer/favorites", { productId: id });
      }
    } catch {
      // Roll back on failure
      if (wasFavorite) {
        setItems((prev) => prev); // keep state; refresh below restores truth
      } else {
        setItems((prev) => prev.filter((i) => i.product._id !== id));
      }
      Alert.alert("Error", "Could not update favorites. Please try again.");
      refresh();
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const removeFavorite = async (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product._id !== productId));
    try {
      await api.delete(`/customer/favorites/${productId}`);
    } catch {
      refresh();
    }
  };

  return (
    <FavoriteContext.Provider
      value={{
        favoriteIds,
        items,
        loading,
        isFavorite,
        toggleFavorite,
        refresh,
        removeFavorite,
      }}
    >
      {children}
    </FavoriteContext.Provider>
  );
};

// --------------------------------------------------
// HOOK
// --------------------------------------------------

export const useFavorites = (): FavoriteContextType => {
  const ctx = useContext(FavoriteContext);
  if (!ctx)
    throw new Error("useFavorites must be used inside FavoriteProvider");
  return ctx;
};
