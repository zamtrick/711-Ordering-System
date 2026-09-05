import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { User, Mail, Lock, Save, Shield } from "lucide-react";
import api from "@/api/axios";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ToastContainer from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileData = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
  isActive: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function is401(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 401;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Profile() {
  const navigate = useNavigate();
  const { toasts, removeToast, success, error: toastError } = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
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

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get("/superadmin/profile/me");
      const data = res.data?.data;
      if (data) {
        setProfile(data);
        setForm({
          firstname: data.firstname,
          lastname: data.lastname,
          email: data.email,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      toastError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!form.firstname.trim()) errs.firstname = "First name is required.";
    if (!form.lastname.trim()) errs.lastname = "Last name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";

    // Only validate password fields if user is trying to change password
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
  }

  // ── Save ───────────────────────────────────────────────────────────────────

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

      const res = await api.patch("/superadmin/profile/me", payload);
      const data = res.data?.data;

      if (data) {
        setProfile((prev) => (prev ? { ...prev, ...data } : prev));
      }

      // Clear password fields
      setForm((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setErrors({});

      success("Profile updated successfully.");
    } catch (err: unknown) {
      if (is401(err)) {
        navigate("/login");
        return;
      }
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update profile.";
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-[#007A53] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#232323] dark:text-white">Profile & Settings</h1>
        <p className="text-sm text-[#777] dark:text-[#A0A0A0] mt-0.5">
          Manage your account information and password
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Account Info Card */}
        <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-[#E8F5EF] flex items-center justify-center">
              <User size={28} className="text-[#007A53]" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#232323] dark:text-white">
                {profile?.firstname} {profile?.lastname}
              </p>
              <p className="text-sm text-[#777] dark:text-[#A0A0A0]">{profile?.email}</p>
            </div>
          </div>

          <div className="space-y-3 border-t border-[#E5E2DE] dark:border-[#2E2E2E] pt-5">
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-[#4F46E5]" />
              <div>
                <p className="text-xs text-[#777] dark:text-[#A0A0A0]">Role</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white capitalize">
                  {profile?.role}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-[#777] dark:text-[#A0A0A0]" />
              <div>
                <p className="text-xs text-[#777] dark:text-[#A0A0A0]">Email</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">
                  {profile?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-[#777] dark:text-[#A0A0A0]" />
              <div>
                <p className="text-xs text-[#777] dark:text-[#A0A0A0]">Password</p>
                <p className="text-sm font-medium text-[#232323] dark:text-white">••••••••</p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[#E5E2DE] dark:border-[#2E2E2E] space-y-2">
            <div className="flex justify-between text-xs text-[#777] dark:text-[#A0A0A0]">
              <span>Account created</span>
              <span>{formatDate(profile?.createdAt ?? "")}</span>
            </div>
            <div className="flex justify-between text-xs text-[#777] dark:text-[#A0A0A0]">
              <span>Last updated</span>
              <span>{formatDate(profile?.updatedAt ?? "")}</span>
            </div>
          </div>
        </div>

        {/* Right: Edit Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E5E2DE] dark:border-[#2E2E2E] p-6">
            <h2 className="text-lg font-bold text-[#232323] dark:text-white mb-5">
              Edit Profile
            </h2>

            <form onSubmit={handleSave} noValidate>
              {/* Personal Info */}
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

              {/* Password Section */}
              <div className="border-t border-[#E5E2DE] dark:border-[#2E2E2E] pt-5 mb-6">
                <h3 className="text-sm font-bold text-[#232323] dark:text-white mb-4">
                  Change Password
                </h3>
                <p className="text-xs text-[#777] dark:text-[#A0A0A0] mb-4">
                  Leave blank to keep your current password.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Input
                      label="Current Password"
                      type="password"
                      placeholder="Enter current password"
                      value={form.currentPassword}
                      onChange={(e) => {
                        setForm((p) => ({
                          ...p,
                          currentPassword: e.target.value,
                        }));
                        setErrors((p) => ({
                          ...p,
                          currentPassword: undefined,
                        }));
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
                      setForm((p) => ({
                        ...p,
                        confirmPassword: e.target.value,
                      }));
                      setErrors((p) => ({
                        ...p,
                        confirmPassword: undefined,
                      }));
                    }}
                    error={errors.confirmPassword}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  icon={<Save size={16} />}
                  loading={saving}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
