import { StyleSheet } from "react-native";

// --------------------------------------------------
// SHARED MODAL STYLES
// --------------------------------------------------
// All profile-related modals share the same bottom-sheet layout,
// header, close button, and save button. Centralising them here
// keeps the individual modal files focused on their own content.

export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: "90%",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  title: { fontSize: 20, fontWeight: "800" },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  saveButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#007A53",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },

  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
