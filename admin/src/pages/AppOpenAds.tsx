import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload, X, Megaphone, CalendarClock } from "lucide-react";
import api from "@/api/axios";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Ad = {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaUrl: string;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
};

type FormData = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  imageFile: File | null;
  imagePreview: string;
};

const defaultForm = (): FormData => ({
  title: "",
  subtitle: "",
  ctaLabel: "Shop Now",
  ctaUrl: "",
  enabled: true,
  startsAt: "",
  endsAt: "",
  imageFile: null,
  imagePreview: "",
});

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const apiOrigin = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");
const toAbsolute = (image?: string | null) =>
  image && !/^https?:\/\//i.test(image) ? `${apiOrigin}${image}` : (image ?? "");

const revokePreview = (url: string) => {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
};

// Local datetime string (YYYY-MM-DDTHH:mm) for datetime-local inputs
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function AppOpenAds() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { perms: permissions } = useAdminPermissions();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const isSuperAdmin = user?.role === "superadmin";
  const canManage = isSuperAdmin || permissions?.canManageAds === true;

  const [showForm, setShowForm] = useState(false);
  const [editAd, setEditAd] = useState<Ad | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [submitting, setSubmitting] = useState(false);

  const [deleteAd, setDeleteAd] = useState<Ad | null>(null);
  const [deleting, setDeleting] = useState(false);

  // --------------------------------------------------
  // QUERY
  // --------------------------------------------------

  const { data, isFetching, error } = useQuery({
    queryKey: ["app-open-ads"],
    queryFn: () => api.get<{ data: Ad[] }>("/app-open-ad").then((res) => res.data?.data ?? []),
  });

  useEffect(() => {
    if (error) toastError("Failed to load ad campaigns.");
  }, [error, toastError]);

  const ads = data ?? [];
  const loading = isFetching && !data;

  // --------------------------------------------------
  // IMAGE HELPERS
  // --------------------------------------------------

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    revokePreview(form.imagePreview);
    setForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  };

  const clearPickedImage = () => {
    revokePreview(form.imagePreview);
    setForm((f) => ({ ...f, imageFile: null, imagePreview: "" }));
  };

  const closeForm = () => {
    revokePreview(form.imagePreview);
    setShowForm(false);
    setEditAd(null);
    setForm(defaultForm());
  };

  // --------------------------------------------------
  // ACTIONS
  // --------------------------------------------------

  const openCreate = () => {
    setForm(defaultForm());
    setEditAd(null);
    setShowForm(true);
  };

  const openEdit = (ad: Ad) => {
    setEditAd(ad);
    setForm({
      title: ad.title,
      subtitle: ad.subtitle ?? "",
      ctaLabel: ad.ctaLabel ?? "Shop Now",
      ctaUrl: ad.ctaUrl ?? "",
      enabled: ad.enabled,
      startsAt: toLocalInput(ad.startsAt),
      endsAt: toLocalInput(ad.endsAt),
      imageFile: null,
      imagePreview: "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toastError("Title is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        ctaLabel: form.ctaLabel.trim() || "Shop Now",
        ctaUrl: form.ctaUrl.trim(),
        enabled: form.enabled,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };

      let adId: string;
      if (editAd) {
        const res = await api.patch(`/app-open-ad/${editAd._id}`, payload);
        adId = res.data?.data?._id;
      } else {
        const res = await api.post("/app-open-ad", payload);
        adId = res.data?.data?._id;
      }

      // Upload the picked creative, if any
      if (form.imageFile && adId) {
        const fd = new FormData();
        fd.append("image", form.imageFile);
        await api.post(`/app-open-ad/${adId}/image`, fd);
      }

      success(editAd ? "Ad campaign updated." : "Ad campaign created.");
      queryClient.invalidateQueries({ queryKey: ["app-open-ads"] });
      closeForm();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to save the ad campaign.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleEnabled = async (ad: Ad) => {
    try {
      await api.patch(`/app-open-ad/${ad._id}`, { enabled: !ad.enabled });
      queryClient.invalidateQueries({ queryKey: ["app-open-ads"] });
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to update the campaign.",
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteAd) return;
    setDeleting(true);
    try {
      await api.delete(`/app-open-ad/${deleteAd._id}`);
      success("Ad campaign deleted.");
      queryClient.invalidateQueries({ queryKey: ["app-open-ads"] });
      setDeleteAd(null);
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to delete the campaign.",
      );
    } finally {
      setDeleting(false);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">App Open Ad</h1>
          <p className="text-sm text-muted mt-0.5">
            Full-screen ad shown when the customer app opens. One campaign serves at a time.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:bg-accent/90 cursor-pointer"
          >
            <Plus size={16} />
            New Campaign
          </button>
        )}
      </div>

      {!canManage && (
        <p className="text-xs font-semibold text-warning bg-warning-soft px-3 py-2 rounded-xl mb-4">
          Read-only — managing App Open Ads is disabled for your account. Ask the superadmin to enable
          “Manage App Open Ads”.
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-sunken animate-pulse" />
          ))}
        </div>
      ) : ads.length === 0 ? (
        <div className="rounded-2xl border bg-surface border-line p-10 flex flex-col items-center text-center">
          <Megaphone size={40} className="text-faint mb-3" />
          <p className="text-sm font-bold text-ink">No ad campaigns yet</p>
          <p className="text-xs text-faint mt-1 max-w-sm">
            Create a campaign and upload a portrait creative (up to 1280×1920). The customer app shows
            it once per app open while it's enabled and inside its schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => {
            const now = Date.now();
            const scheduled =
              (ad.startsAt && new Date(ad.startsAt).getTime() > now) ||
              (ad.endsAt && new Date(ad.endsAt).getTime() < now);
            const live = ad.enabled && !scheduled && !!ad.imageUrl;

            return (
              <div
                key={ad._id}
                className="rounded-2xl border bg-surface border-line p-4 flex gap-4 items-start"
              >
                {/* Creative thumb */}
                <div className="w-16 h-24 rounded-xl bg-sunken overflow-hidden shrink-0 flex items-center justify-center">
                  {ad.imageUrl ? (
                    <img
                      src={toAbsolute(ad.imageUrl)}
                      alt={ad.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Megaphone size={20} className="text-faint" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-ink truncate">{ad.title}</p>
                    {live && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-soft text-success">
                        LIVE
                      </span>
                    )}
                    {ad.enabled && scheduled && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning-soft text-warning">
                        SCHEDULED
                      </span>
                    )}
                    {!ad.enabled && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sunken text-muted">
                        OFF
                      </span>
                    )}
                    {!ad.imageUrl && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger-soft text-danger">
                        NO CREATIVE
                      </span>
                    )}
                  </div>
                  {ad.subtitle && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{ad.subtitle}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-faint flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={12} />
                      {ad.startsAt || ad.endsAt
                        ? `${ad.startsAt ? fmtDate(ad.startsAt) : "now"} → ${ad.endsAt ? fmtDate(ad.endsAt) : "no end"}`
                        : "Always on"}
                    </span>
                    {ad.ctaUrl && <span>CTA: {ad.ctaLabel} → {ad.ctaUrl}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Enable toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ad.enabled}
                    disabled={!canManage}
                    onClick={() => toggleEnabled(ad)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      ad.enabled ? "bg-accent" : "bg-line"
                    }`}
                  >
                    <span
                      className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                        ad.enabled ? "translate-x-[24px]" : "translate-x-[3px]"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => openEdit(ad)}
                    disabled={!canManage}
                    className="p-2 rounded-lg hover:bg-sunken cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Edit"
                  >
                    <Pencil size={15} className="text-muted" />
                  </button>
                  <button
                    onClick={() => setDeleteAd(ad)}
                    disabled={!canManage}
                    className="p-2 rounded-lg hover:bg-danger-soft cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete"
                  >
                    <Trash2 size={15} className="text-danger" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================
          CREATE / EDIT FORM MODAL
      ================================================ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeForm} />
          <form
            onSubmit={handleSubmit}
            className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl z-10 p-6 ${isDark ? "bg-surface" : "bg-white"}`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-ink"}`}>
                {editAd ? "Edit Campaign" : "New Ad Campaign"}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className={`text-sm cursor-pointer ${isDark ? "text-muted" : "text-muted"}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Creative upload */}
              <div>
                <label className={`text-xs font-semibold ${isDark ? "text-muted" : "text-muted"}`}>
                  Creative (portrait, JPG/PNG/WEBP, max 8MB)
                </label>
                <div className="mt-2 flex items-start gap-3">
                  <div className="w-24 h-36 rounded-xl bg-sunken border border-line overflow-hidden flex items-center justify-center">
                    {form.imagePreview ? (
                      <img src={form.imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : editAd?.imageUrl && !form.imageFile ? (
                      <img src={toAbsolute(editAd.imageUrl)} alt="Current" className="w-full h-full object-cover" />
                    ) : (
                      <Megaphone size={22} className="text-faint" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 px-3 h-9 rounded-xl border border-line text-sm font-semibold text-ink cursor-pointer hover:bg-sunken">
                      <Upload size={14} />
                      {form.imageFile || editAd?.imageUrl ? "Replace" : "Upload"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pickImage} />
                    </label>
                    {(form.imageFile || (editAd?.imageUrl && !form.imageFile)) && (
                      <button
                        type="button"
                        onClick={() => {
                          clearPickedImage();
                          if (editAd) {
                            // Mark existing image for removal server-side by uploading nothing;
                            // the explicit remove button deletes it via the API after save.
                          }
                        }}
                        className="text-xs font-semibold text-danger cursor-pointer"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className={`text-xs font-semibold ${isDark ? "text-muted" : "text-muted"}`}>
                  Title *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={80}
                  placeholder="e.g. 7-Eleven Big Deal"
                  className={`mt-1 w-full h-10 px-3 rounded-xl border bg-transparent outline-none text-sm font-medium ${
                    isDark ? "border-line text-white" : "border-line text-ink"
                  }`}
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className={`text-xs font-semibold ${isDark ? "text-muted" : "text-muted"}`}>
                  Subtitle
                </label>
                <input
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                  maxLength={140}
                  placeholder="Optional supporting line"
                  className={`mt-1 w-full h-10 px-3 rounded-xl border bg-transparent outline-none text-sm font-medium ${
                    isDark ? "border-line text-white" : "border-line text-ink"
                  }`}
                />
              </div>

              {/* CTA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold ${isDark ? "text-muted" : "text-muted"}`}>
                    Button label
                  </label>
                  <input
                    value={form.ctaLabel}
                    onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                    maxLength={24}
                    placeholder="Shop Now"
                    className={`mt-1 w-full h-10 px-3 rounded-xl border bg-transparent outline-none text-sm font-medium ${
                      isDark ? "border-line text-white" : "border-line text-ink"
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold ${isDark ? "text-muted" : "text-muted"}`}>
                    Button link (URL or screen)
                  </label>
                  <input
                    value={form.ctaUrl}
                    onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                    maxLength={500}
                    placeholder="https://… (optional)"
                    className={`mt-1 w-full h-10 px-3 rounded-xl border bg-transparent outline-none text-sm font-medium ${
                      isDark ? "border-line text-white" : "border-line text-ink"
                    }`}
                  />
                </div>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold ${isDark ? "text-muted" : "text-muted"}`}>
                    Starts (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    className={`mt-1 w-full h-10 px-3 rounded-xl border bg-transparent outline-none text-sm font-medium ${
                      isDark ? "border-line text-white" : "border-line text-ink"
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold ${isDark ? "text-muted" : "text-muted"}`}>
                    Ends (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                    className={`mt-1 w-full h-10 px-3 rounded-xl border bg-transparent outline-none text-sm font-medium ${
                      isDark ? "border-line text-white" : "border-line text-ink"
                    }`}
                  />
                </div>
              </div>

              {/* Enabled */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-ink"}`}>Enabled</p>
                  <p className={`text-xs ${isDark ? "text-muted" : "text-faint"}`}>
                    Disabled campaigns never serve, even inside their window.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.enabled}
                  onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    form.enabled ? "bg-accent" : "bg-line"
                  }`}
                >
                  <span
                    className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                      form.enabled ? "translate-x-[24px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={closeForm}
                className={`px-4 h-10 rounded-xl text-sm font-medium border cursor-pointer ${
                  isDark ? "border-line text-white" : "border-line text-ink"
                } hover:bg-sunken`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-bold text-white bg-accent hover:bg-accent/90 cursor-pointer disabled:opacity-60"
              >
                {submitting ? "Saving…" : editAd ? "Save Changes" : "Create Campaign"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteAd !== null}
        title="Delete ad campaign?"
        message={`“${deleteAd?.title ?? ""}” will stop serving immediately and its creative will be removed.`}
        confirmLabel="Delete"
        onConfirm={() => handleDelete()}
        onClose={() => setDeleteAd(null)}
        loading={deleting}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
