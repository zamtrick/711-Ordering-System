import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  Linking,
  Dimensions,
} from "react-native";
import { X } from "lucide-react-native";
import { router } from "expo-router";
import api from "@/api/axios";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Ad = {
  _id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

// API base for relative image paths
const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");
const toAbsolute = (image?: string | null) =>
  image && !/^https?:\/\//i.test(image) ? `${apiOrigin}${image}` : (image ?? "");

// Countdown before the skip button becomes tappable (seconds) — mirrors
// real ad-network behavior without being obnoxious.
const SKIP_DELAY = 3;

// --------------------------------------------------
// COMPONENT
// --------------------------------------------------

const AppOpenAdModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipIn, setSkipIn] = useState(SKIP_DELAY);

  // Fetch the active campaign when the modal is told to show
  useEffect(() => {
    if (!visible) return;
    let mounted = true;

    const load = async () => {
      try {
        const res = await api.get("/app-open-ad/active");
        if (!mounted) return;
        setAd(res.data?.data?.ad ?? null);
      } catch {
        if (mounted) setAd(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [visible]);

  // Skip countdown
  useEffect(() => {
    if (!visible || loading || !ad || skipIn === 0) return;
    const t = setTimeout(() => setSkipIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [visible, loading, ad, skipIn]);

  if (!visible) return null;

  const handleClose = () => {
    setAd(null);
    onClose();
  };

  const handleCta = () => {
    if (!ad?.ctaUrl) {
      handleClose();
      return;
    }
    if (/^https?:\/\//i.test(ad.ctaUrl)) {
      Linking.openURL(ad.ctaUrl).catch(() => {});
      handleClose();
    } else {
      // In-app route (e.g. "/(customer)/products")
      try {
        router.push(ad.ctaUrl as never);
      } catch {
        // bad route — just close
      }
      handleClose();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {loading ? (
          <ActivityIndicator size="large" color="#FFFFFF" />
        ) : ad ? (
          <View style={styles.card}>
            <Image
              source={{ uri: toAbsolute(ad.imageUrl) }}
              style={styles.creative}
              resizeMode="cover"
            />
            <View style={styles.scrim} pointerEvents="none" />

            {/* Close / skip */}
            <Pressable
              onPress={handleClose}
              disabled={skipIn > 0}
              style={[styles.closeBtn, skipIn > 0 && { opacity: 0.6 }]}
              hitSlop={8}
            >
              {skipIn > 0 ? (
                <Text style={styles.closeText}>{skipIn}</Text>
              ) : (
                <X size={18} color="#FFFFFF" />
              )}
            </Pressable>

            {/* Copy + CTA */}
            <View style={styles.copyWrap} pointerEvents="box-none">
              <Text style={styles.title} numberOfLines={2}>
                {ad.title}
              </Text>
              {ad.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {ad.subtitle}
                </Text>
              ) : null}

              <View style={styles.ctaRow} pointerEvents="box-none">
                {ad.ctaUrl ? (
                  <Pressable style={styles.ctaButton} onPress={handleCta}>
                    <Text style={styles.ctaText}>{ad.ctaLabel || "Shop Now"}</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.ctaButton} onPress={handleClose}>
                    <Text style={styles.ctaText}>{ad.ctaLabel || "Shop Now"}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        ) : (
          // Nothing to show — auto-dismiss
          <AutoClose onClose={handleClose} />
        )}
      </View>
    </Modal>
  );
};

// Small helper: when no ad was returned, close immediately on mount.
const AutoClose = ({ onClose }: { onClose: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 0);
    return () => clearTimeout(t);
  }, [onClose]);
  return null;
};

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    width: width * 0.92,
    height: height * 0.82,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#111111",
  },

  creative: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },

  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },

  closeText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },

  copyWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 26,
    zIndex: 2,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 29,
  },

  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13.5,
    fontWeight: "600",
    marginTop: 6,
  },

  ctaRow: {
    flexDirection: "row",
    marginTop: 14,
  },

  ctaButton: {
    backgroundColor: "#007A53",
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  ctaText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});

export default AppOpenAdModal;
