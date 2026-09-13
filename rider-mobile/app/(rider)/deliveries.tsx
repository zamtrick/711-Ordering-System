import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Image,
  Modal,
} from "react-native";
import {
  PackageCheck,
  MapPin,
  ChevronRight,
  Truck,
  Camera,
  Check,
  X,
  QrCode,
  ScanLine,
} from "lucide-react-native";
import QRCodeSVG from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions, type CameraView as CameraViewType } from "expo-camera";

import { LightTheme, DarkTheme } from "@/constants/Theme";
import ThemedView from "@/components/ThemedView";
import api from "@/api/axios";
import { router } from "expo-router";
import { useSocket } from "@/context/SocketContext";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Delivery = {
  _id: string;
  totalAmount: number;
  status: string;
  deliveryStatus: string;
  rider?: string | { _id?: string };
  createdAt: string;
  user?: { firstname: string; lastname: string; email: string };
  branch?: {
    name: string;
    branchCode: string;
    location: string;
    address?:
      | string
      | {
          street?: string;
          barangay?: string;
          city?: string;
          province?: string;
          postalCode?: string;
        };
  };
  orderItems?: {
    _id: string;
    quantity: number;
    product?: { name: string; price: number };
  }[];
  proofOfDelivery?: {
    photoUrl?: string | null;
    scannedAt?: string | null;
  } | null;
};

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const DELIVERY_STATUS: Record<
  string,
  { label: string; color: string; bg: string; next: string | null }
> = {
  assigned: { label: "Assigned", color: "#FF6720", bg: "#FFF3E8", next: "picked_up" },
  picked_up: { label: "Picked Up", color: "#007A53", bg: "#E8F5EF", next: "in_transit" },
  in_transit: { label: "In Transit", color: "#007A53", bg: "#E8F5EF", next: "delivered" },
  delivered: { label: "Delivered", color: "#007A53", bg: "#E8F5EF", next: null },
};

const NEXT_LABEL: Record<string, string> = {
  picked_up: "Mark as Picked Up",
  in_transit: "Start Delivery",
  delivered: "Mark as Delivered",
};

const NEXT_ICON: Record<string, string> = {
  picked_up: "📦",
  in_transit: "🚚",
  delivered: "✅",
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const formatBranchAddress = (
  address:
    | string
    | {
        street?: string;
        barangay?: string;
        city?: string;
        province?: string;
        postalCode?: string;
      }
    | undefined
): string => {
  if (!address) return "";
  if (typeof address === "string") return address;
  return [address.street, address.barangay, address.city, address.province, address.postalCode]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
};

// --------------------------------------------------
// COMPONENT
// --------------------------------------------------

const Deliveries = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : LightTheme;
  const { colors } = theme;
  const isDark = colorScheme === "dark";

  // ── data ─────────────────────────────────────────
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── delivery proof flow ───────────────────────────
  // activeOrderId: the delivery we're currently completing
  // step: "qr" → scan customer QR | "photo" → take proof photo
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const activeOrderIdRef = useRef<string | null>(null); // always-current ref for callbacks
  const [step, setStep] = useState<"qr" | "photo" | null>(null);
  const [qrValue, setQrValue] = useState<string | null>(null);   // orderId to encode in QR
  const [qrLoading, setQrLoading] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const scannedRef = useRef(false); // ref instead of state — no re-render needed
  const [scanned, setScanned] = useState(false); // drives onBarcodeScanned prop
  const [cameraReady, setCameraReady] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraViewType>(null);

  // ── socket ───────────────────────────────────────
  const { socket, connected } = useSocket();
  const myRiderIdRef = useRef<string | null>(null);

  useEffect(() => {
    api
      .get("/rider/profile/me")
      .then((res) => {
        myRiderIdRef.current = res.data?.data?._id ?? null;
      })
      .catch(() => {});
  }, []);

  // ── fetch ─────────────────────────────────────────
  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/rider/deliveries/mine");
      setDeliveries(res.data?.deliveries ?? []);
    } catch (err: any) {
      if (err?.response?.status === 401) router.replace("/(auth)/login");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDeliveries();
  }, [fetchDeliveries]);

  // ── live socket updates ───────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = (updated: Delivery) => {
      if (!updated?._id) return;
      const ACTIVE = ["assigned", "picked_up", "in_transit"];
      const rawRider =
        typeof updated.rider === "object" ? updated.rider?._id : updated.rider;
      const assignedToMe =
        rawRider != null && myRiderIdRef.current != null
          ? rawRider.toString() === myRiderIdRef.current.toString()
          : false;
      const gone =
        updated.deliveryStatus === "delivered" ||
        updated.status === "cancelled" ||
        updated.status === "refunded" ||
        updated.status === "completed";

      setDeliveries((prev) => {
        const exists = prev.some((d) => d._id === updated._id);
        if (exists) {
          if (gone) return prev.filter((d) => d._id !== updated._id);
          return prev.map((d) => (d._id === updated._id ? { ...d, ...updated } : d));
        }
        if (!gone && assignedToMe && ACTIVE.includes(updated.deliveryStatus)) {
          return [updated, ...prev];
        }
        return prev;
      });
    };
    socket.on("order_updated", handler);
    return () => { socket.off("order_updated", handler); };
  }, [socket]);

  // ── step 1: open QR scan flow ─────────────────────
  const startProofFlow = async (orderId: string) => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera access is needed to scan the QR code.");
        return;
      }
    }

    try {
      setQrLoading(true);
      const res = await api.get(`/rider/deliveries/${orderId}/qr`);
      const data = res.data?.data ?? {};

      if (!data.qrValue) {
        Alert.alert("Error", "Could not load QR data for this order.");
        return;
      }

      setQrValue(data.qrValue);
      setActiveOrderId(orderId);
      activeOrderIdRef.current = orderId;
      scannedRef.current = false;
      setScanned(false);
      setCapturedUri(null);
      setCameraReady(false);
      setStep("qr");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to start delivery proof.");
    } finally {
      setQrLoading(false);
    }
  };

  // ── step 2: rider scans customer's QR with camera ─
  // Uses refs (not state) so the callback never captures a stale value.
  const handleBarcodeScanned = async (scanningResult: { data: string }) => {
    if (scannedRef.current) return; // already processing a scan
    const orderId = activeOrderIdRef.current;
    if (!orderId) return;

    scannedRef.current = true; // lock immediately — prevent double-fire
    setScanned(true);          // pause onBarcodeScanned on the CameraView

    try {
      const res = await api.post(`/rider/deliveries/${orderId}/scan`, {
        qrData: scanningResult.data,
      });

      if (res.data?.success) {
        // QR verified — move to photo step
        setCameraReady(false);
        setStep("photo");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "QR does not match this order. Try again.";
      Alert.alert("Scan Failed", msg, [
        {
          text: "Try Again",
          onPress: () => {
            scannedRef.current = false;
            setScanned(false);
          },
        },
      ]);
    }
  };

  // ── step 3: take proof photo ──────────────────────
  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert("Error", "Camera not available.");
      return;
    }
    if (!cameraReady) {
      Alert.alert("Please wait", "Camera is still starting up.");
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        // No base64 — use the local URI directly as the image source.
        // Requesting base64 of a full-res photo can run out of JS memory.
      });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
      } else {
        Alert.alert("Error", "Could not capture photo. Please try again.");
      }
    } catch (err: any) {
      console.log("takePictureAsync error:", err?.message ?? err);
      Alert.alert("Error", "Could not capture photo. Please try again.");
    }
  };

  // ── step 4: submit proof + complete delivery ──────
  const completeDelivery = async () => {
    if (!activeOrderId) return;

    Alert.alert(
      "Confirm Delivery",
      capturedUri
        ? "Mark this order as delivered with photo proof?"
        : "Mark this order as delivered? (No photo captured)",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setUploadingProof(true);

              const formData = new FormData();
              formData.append("qrToken", activeOrderId);

              if (capturedUri) {
                // Append the local photo URI as a multipart file.
                // React Native's FormData accepts { uri, name, type }.
                formData.append("proofPhoto", {
                  uri: capturedUri,
                  name: `proof_${activeOrderId}.jpg`,
                  type: "image/jpeg",
                } as any);
              }

              await api.post(
                `/rider/deliveries/${activeOrderId}/complete`,
                formData,
                { headers: { "Content-Type": "multipart/form-data" } },
              );

              Alert.alert("Delivered!", "Order has been marked as delivered.");
              closeFlow();
              fetchDeliveries();
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.message || "Failed to complete delivery.");
            } finally {
              setUploadingProof(false);
            }
          },
        },
      ]
    );
  };

  const closeFlow = () => {
    setStep(null);
    setActiveOrderId(null);
    activeOrderIdRef.current = null;
    setQrValue(null);
    setCapturedUri(null);
    scannedRef.current = false;
    setScanned(false);
    setCameraReady(false);
  };

  // ── status update (non-delivery steps) ───────────
  const updateStatus = async (orderId: string, newStatus: string) => {
    const labels: Record<string, string> = {
      picked_up: "picked up",
      in_transit: "in transit",
    };
    Alert.alert(
      "Confirm Update",
      `Mark this delivery as ${labels[newStatus] ?? newStatus}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setUpdatingId(orderId);
              await api.patch(`/rider/deliveries/${orderId}/status`, {
                deliveryStatus: newStatus,
              });
              setDeliveries((prev) =>
                prev.map((d) =>
                  d._id === orderId ? { ...d, deliveryStatus: newStatus } : d
                )
              );
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.message || "Failed to update status.");
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // ── loading ───────────────────────────────────────
  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color="#007A53" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Loading deliveries...</Text>
      </ThemedView>
    );
  }

  // ── render ────────────────────────────────────────
  return (
    <ThemedView>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.smallTitle, { color: colors.muted }]}>
              Your assigned orders {connected ? "· Live" : "· Offline"}
            </Text>
            <Text style={[styles.title, { color: colors.headline }]}>My Deliveries</Text>
          </View>
          <View
            style={[styles.headerIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <PackageCheck size={21} color="#007A53" />
            <View
              style={[styles.liveDotBadge, { backgroundColor: connected ? "#007A53" : "#999" }]}
            />
          </View>
        </View>

        {/* Empty state */}
        {deliveries.length === 0 ? (
          <View
            style={[
              styles.emptyContainer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Truck size={42} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.headline }]}>No active deliveries</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Accept a delivery from the Home tab to get started
            </Text>
          </View>
        ) : (
          deliveries.map((delivery) => {
            const statusInfo =
              DELIVERY_STATUS[delivery.deliveryStatus] || DELIVERY_STATUS.assigned;
            const nextStatus = statusInfo.next;
            const updating = updatingId === delivery._id;
            const isInTransit = delivery.deliveryStatus === "in_transit";

            return (
              <View
                key={delivery._id}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={[styles.orderId, { color: colors.headline }]}>
                      #{delivery._id.slice(-6).toUpperCase()}
                    </Text>
                    <Text style={[styles.orderDate, { color: colors.muted }]}>
                      {formatDate(delivery.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                {/* Info rows */}
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>Customer</Text>
                  <Text style={[styles.infoValue, { color: colors.headline }]}>
                    {delivery.user?.firstname} {delivery.user?.lastname}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoLabelRow}>
                    <MapPin size={14} color={colors.muted} />
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Branch</Text>
                  </View>
                  <Text style={[styles.infoValue, { color: colors.headline }]}>
                    {delivery.branch?.name}
                  </Text>
                </View>

                {formatBranchAddress(delivery.branch?.address) ? (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Address</Text>
                    <Text
                      style={[styles.infoValue, { color: colors.headline }]}
                      numberOfLines={2}
                    >
                      {formatBranchAddress(delivery.branch?.address)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>Items</Text>
                  <Text style={[styles.infoValue, { color: colors.headline }]}>
                    {delivery.orderItems?.length ?? 0} item(s)
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: "#007A53" }]}>
                    ₱{delivery.totalAmount.toFixed(2)}
                  </Text>
                </View>

                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                {/* Status update button (picked_up / in_transit) */}
                {nextStatus && nextStatus !== "delivered" && (
                  <Pressable
                    onPress={() => updateStatus(delivery._id, nextStatus)}
                    disabled={updating}
                    style={[styles.actionButton, { opacity: updating ? 0.6 : 1 }]}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.actionIcon}>{NEXT_ICON[nextStatus]}</Text>
                        <Text style={styles.actionText}>{NEXT_LABEL[nextStatus]}</Text>
                        <ChevronRight size={18} color="#FFFFFF" />
                      </>
                    )}
                  </Pressable>
                )}

                {/* Scan QR + photo proof button — only available when in_transit */}
                {isInTransit && (
                  <Pressable
                    onPress={() => startProofFlow(delivery._id)}
                    disabled={qrLoading && activeOrderId === delivery._id}
                    style={[
                      styles.scanButton,
                      {
                        backgroundColor: colors.surface,
                        borderColor: "#007A53",
                        marginTop: nextStatus && nextStatus !== "delivered" ? 8 : 0,
                      },
                    ]}
                  >
                    {qrLoading && activeOrderId === delivery._id ? (
                      <ActivityIndicator size="small" color="#007A53" />
                    ) : (
                      <>
                        <QrCode size={16} color="#007A53" />
                        <Text style={[styles.scanText, { color: "#007A53" }]}>
                          Scan Customer QR to Complete Delivery
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}

                {/* Proof of delivery photo (once delivered) */}
                {delivery.proofOfDelivery?.photoUrl && (
                  <View style={[styles.proofContainer, { backgroundColor: colors.background }]}>
                    <Image
                      source={{ uri: delivery.proofOfDelivery.photoUrl }}
                      style={styles.proofImage}
                      resizeMode="cover"
                    />
                    {delivery.proofOfDelivery.scannedAt && (
                      <Text style={[styles.proofDate, { color: colors.muted }]}>
                        Delivered:{" "}
                        {new Date(delivery.proofOfDelivery.scannedAt).toLocaleTimeString()}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ====================================================
          STEP 1 — QR SCAN MODAL
          Rider points camera at customer's phone screen
      ==================================================== */}
      <Modal visible={step === "qr"} animationType="slide" onRequestClose={closeFlow}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Scan Customer QR</Text>
              <Text style={styles.modalSubtitle}>
                Point your camera at the QR code on the customer's phone
              </Text>
            </View>
            <Pressable onPress={closeFlow} style={styles.closeBtn}>
              <X size={22} color="#555" />
            </Pressable>
          </View>

          {/* Camera — barcode scan mode */}
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.scanner}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            />
            {/* Scan frame overlay — sibling of CameraView, absolutely positioned */}
            <View style={styles.scanFrame} pointerEvents="none">
              <View style={styles.scanFrameBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
            </View>
          </View>

          <Text style={styles.scanHint}>
            <ScanLine size={14} color="#555" /> Align the QR code within the frame
          </Text>

          <Pressable onPress={closeFlow} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* ====================================================
          STEP 2 — PHOTO PROOF MODAL
          Rider takes a photo as proof of delivery
      ==================================================== */}
      <Modal visible={step === "photo"} animationType="slide" onRequestClose={closeFlow}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {capturedUri ? "Review Photo" : "Take Proof Photo"}
              </Text>
              <Text style={styles.modalSubtitle}>
                {capturedUri
                  ? "Looks good? Confirm delivery or retake."
                  : "Capture a photo as proof of delivery"}
              </Text>
            </View>
            <Pressable onPress={closeFlow} style={styles.closeBtn}>
              <X size={22} color="#555" />
            </Pressable>
          </View>

          {capturedUri ? (
            /* Preview captured photo */
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: capturedUri }} style={styles.photoPreview} resizeMode="cover" />
              <View style={styles.photoActions}>
                <Pressable
                  onPress={() => setCapturedUri(null)}
                  style={[styles.photoBtn, styles.photoBtnOutline]}
                >
                  <Camera size={18} color="#007A53" />
                  <Text style={[styles.photoBtnText, { color: "#007A53" }]}>Retake</Text>
                </Pressable>
                <Pressable
                  onPress={completeDelivery}
                  disabled={uploadingProof}
                  style={[styles.photoBtn, styles.photoBtnFill, { opacity: uploadingProof ? 0.6 : 1 }]}
                >
                  {uploadingProof ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Check size={18} color="#FFF" />
                      <Text style={[styles.photoBtnText, { color: "#FFF" }]}>Confirm Delivery</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            /* Live camera — picture mode */
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.liveCamera}
                facing="back"
                mode="picture"
                onCameraReady={() => setCameraReady(true)}
              />
              {/* Shutter button — sibling of CameraView, absolutely positioned */}
              <View style={styles.captureRow} pointerEvents="box-none">
                <Pressable
                  onPress={takePicture}
                  disabled={!cameraReady}
                  style={[styles.captureBtn, { opacity: cameraReady ? 1 : 0.4 }]}
                >
                  <View style={styles.captureBtnInner} />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </ThemedView>
  );
};

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
  content: { padding: 20, paddingBottom: 35 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  smallTitle: { fontSize: 14, marginBottom: 3 },
  title: { fontSize: 25, fontWeight: "800" },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDotBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  emptyContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 40,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginTop: 14 },
  emptyText: { fontSize: 13, marginTop: 6, textAlign: "center", maxWidth: 250, lineHeight: 19 },

  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderId: { fontSize: 15, fontWeight: "800" },
  orderDate: { fontSize: 11, marginTop: 3 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  separator: { height: 1, marginVertical: 12 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  infoLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 13, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  totalValue: { fontSize: 17, fontWeight: "900" },

  actionButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#007A53",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionIcon: { fontSize: 16 },
  actionText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  scanText: { fontSize: 13, fontWeight: "600" },

  proofContainer: { marginTop: 10, borderRadius: 12, overflow: "hidden" },
  proofImage: { width: "100%", height: 150 },
  proofDate: { fontSize: 11, padding: 8, textAlign: "center" },

  // ── modals ──────────────────────────────────────
  modalContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#232323" },
  modalSubtitle: { fontSize: 13, color: "#777", marginTop: 4, maxWidth: 280 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── QR scanner ──────────────────────────────────
  scannerContainer: { flex: 1, margin: 20, borderRadius: 20, overflow: "hidden" },
  scanner: { ...StyleSheet.absoluteFill },
  scanFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrameBox: {
    width: 220,
    height: 220,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#007A53",
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanHint: { textAlign: "center", fontSize: 13, color: "#777", marginBottom: 8 },
  cancelBtn: {
    margin: 20,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600", color: "#555" },

  // ── photo capture ────────────────────────────────
  cameraContainer: { flex: 1 },
  liveCamera: { flex: 1 },
  captureRow: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  captureBtnInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
  },

  // ── photo preview ────────────────────────────────
  photoPreviewContainer: { flex: 1 },
  photoPreview: { flex: 1 },
  photoActions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    paddingBottom: 36,
  },
  photoBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoBtnOutline: { borderWidth: 1.5, borderColor: "#007A53" },
  photoBtnFill: { backgroundColor: "#007A53" },
  photoBtnText: { fontSize: 14, fontWeight: "700" },
});

export default Deliveries;
