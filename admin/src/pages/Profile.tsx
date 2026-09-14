import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Mail, Lock, Save } from "lucide-react";
import api from "@/api/axios";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";

type ProfileData = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormData = {
  firstname: string;
  lastname: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const formatDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

export default function Profile() {
  const { user } = useAuth();
  const { toasts, removeToast, success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const isSuperadmin = user?.role === "superadmin";
  const profileBase = isSuperadmin ? "/superadmin/profile" : "/admin/profile";

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    firstname: "",
    lastname: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["profile", profileBase],
    queryFn: () => api.get<{ data: ProfileData }>(`${profileBase}/me`).then((r) => r.data.data),
  });

  useEffect(() => {
    if (error) toastError("Failed to load profile.");
  }, [error, toastError]);

  useEffect(() => {
    if (data) {
      setForm((prev) => ({
        ...prev,
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
      }));
    }
  }, [data]);

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!form.firstname.trim()) errs.firstname = "First name is required.";
    if (!form.lastname.trim()) errs.lastname = "Last name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";

    // Only validate password fields when changing the password
    if (form.newPassword || form.currentPassword) {
      if (!form.currentPassword) errs.currentPassword = "Current password is required.";
      if (!form.newPassword) errs.newPassword = "New password is required.";
      if (form.newPassword && form.newPassword.length < 8) {
        errs.newPassword = "Password must be at least 8 characters.";
      }
      if (form.newPassword !== form.confirmPassword) {
        errs.confirmPassword = "Passwords do not match.";
      }
    }
    return errs;
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        firstname: form.firstname.trim(),
        lastname: form.lastname.trim(),
        email: form.email.trim(),
      };
      if (form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      const res = await api.patch<{ data: Partial<ProfileData> }>(`${profileBase}/me`, payload);
      const updated = res.data?.data;
      if (updated) {
        queryClient.setQueryData<ProfileData>(["profile", profileBase], (old) =>
          old ? { ...old, ...updated } : old,
        );
      }

      // Clear password fields after a successful save
      setForm((prev) => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
      setErrors({});
      success("Profile updated successfully.");
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to update profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Profile &amp; Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your account information and password</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Account info card */}
        <div className="rounded-2xl border border-line bg-white dark:bg-surface p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center text-xl font-bold text-accent">
              {data ? `${data.firstname.charAt(0)}${data.lastname.charAt(0)}`.toUpperCase() : "—"}
            </div>
            <div>
              <p className="text-lg font-bold text-ink">
                {data?.firstname} {data?.lastname}
              </p>
              <p className="text-sm text-muted break-all">{data?.email}</p>
            </div>
          </div>

          <div className="space-y-3 border-t border-line pt-5">
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-info" />
              <div>
                <p className="text-xs text-muted">Role</p>
                <Badge variant={isSuperadmin ? "blue" : "green"}>{data?.role ?? "—"}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-muted" />
              <div>
                <p className="text-xs text-muted">Email</p>
                <p className="text-sm font-medium text-ink break-all">{data?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-muted" />
              <div>
                <p className="text-xs text-muted">Password</p>
                <p className="text-sm font-medium text-ink">••••••••</p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-line space-y-2">
            <div className="flex justify-between text-xs text-muted">
              <span>Account created</span>
              <span>{formatDate(data?.createdAt ?? "")}</span>
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span>Last updated</span>
              <span>{formatDate(data?.updatedAt ?? "")}</span>
            </div>
          </div>
        </div>

        {/* Right: Edit form */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-line bg-white dark:bg-surface p-6">
            <h2 className="text-lg font-bold text-ink mb-5">Edit Profile</h2>

            <form onSubmit={handleSave} noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <Input
                  label="First Name *"
                  placeholder="Enter first name"
                  value={form.firstname}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, firstname: e.target.value }));
                    setErrors((p) => ({ ...p, firstname: undefined }));
                  }}
                  error={errors.firstname}
                  disabled={saving}
                />
                <Input
                  label="Last Name *"
                  placeholder="Enter last name"
                  value={form.lastname}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, lastname: e.target.value }));
                    setErrors((p) => ({ ...p, lastname: undefined }));
                  }}
                  error={errors.lastname}
                  disabled={saving}
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Email *"
                    type="email"
                    placeholder="Enter email"
                    value={form.email}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, email: e.target.value }));
                      setErrors((p) => ({ ...p, email: undefined }));
                    }}
                    error={errors.email}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="border-t border-line pt-5 mb-6">
                <h3 className="text-sm font-bold text-ink mb-1">Change Password</h3>
                <p className="text-xs text-muted mb-4">Leave blank to keep your current password.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Input
                      label="Current Password"
                      type="password"
                      placeholder="Enter current password"
                      value={form.currentPassword}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, currentPassword: e.target.value }));
                        setErrors((p) => ({ ...p, currentPassword: undefined }));
                      }}
                      error={errors.currentPassword}
                      disabled={saving}
                    />
                  </div>
                  <Input
                    label="New Password"
                    type="password"
                    placeholder="Enter new password"
                    value={form.newPassword}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, newPassword: e.target.value }));
                      setErrors((p) => ({ ...p, newPassword: undefined }));
                    }}
                    error={errors.newPassword}
                    disabled={saving}
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    placeholder="Confirm new password"
                    value={form.confirmPassword}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, confirmPassword: e.target.value }));
                      setErrors((p) => ({ ...p, confirmPassword: undefined }));
                    }}
                    error={errors.confirmPassword}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" icon={<Save size={16} />} loading={saving}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
