import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

export default function Login() {
  const { user, loading, login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // One-shot session-expired notice set by the axios 401 interceptor.
  // Read during first render (pure), then the flag is cleared in an effect.
  const [error, setError] = useState(() => sessionStorage.getItem("auth_notice") ?? "");

  useEffect(() => {
    if (!loading && user !== null) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    sessionStorage.removeItem("auth_notice");
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sunken dark:bg-surface">
        <div className="w-8 h-8 border-4 border-accent dark:border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-sunken dark:bg-surface">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="rounded-t-3xl px-6 pt-10 pb-8 text-center relative overflow-hidden" style={{ background: isDark ? "linear-gradient(135deg, #065f46 0%, #047857 100%)" : "linear-gradient(135deg, #059669 0%, #047857 100%)" }}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-1.5 mb-4">
              <div className="w-10 h-1.5 rounded-full bg-amber-400" />
              <div className="w-6 h-1.5 rounded-full bg-red-400" />
            </div>
            <div className="w-16 h-16 mx-auto flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-2xl mb-4 overflow-hidden shadow-xl ring-1 ring-white/20">
              <span className="text-accent text-xl font-bold">711</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">7/11 Online Ordering</h1>
            <p className="text-sm text-white/80 mt-1.5">Sign in to your admin dashboard</p>
          </div>
        </div>

        {/* Form Card */}
        <div className={`rounded-b-3xl shadow-lg px-7 py-7 ${isDark ? "bg-surface" : "bg-white"}`}>
          <form onSubmit={handleSubmit} noValidate>
            <h2 className={`text-xl font-extrabold mb-1 ${isDark ? "text-white" : "text-ink"}`}>Sign in</h2>
            <p className={`text-sm mb-6 text-muted`}>Enter your admin credentials</p>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-danger-soft border border-danger/30">
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <div className="mb-4">
              <label className={`text-sm font-semibold mb-1.5 block ${isDark ? "text-white" : "text-ink"}`}>Email</label>
              <div className={`flex items-center h-12 px-3 rounded-xl border gap-2 focus-within:border-accent dark:focus-within:border-accent focus-within:ring-2 focus-within:ring-[#007A53]/20 ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
                <Mail size={18} className={"text-muted"} />
                <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-faint" : "text-ink placeholder:text-faint"}`} disabled={submitting} />
              </div>
            </div>

            <div className="mb-2">
              <label className={`text-sm font-semibold mb-1.5 block ${isDark ? "text-white" : "text-ink"}`}>Password</label>
              <div className={`flex items-center h-12 px-3 rounded-xl border gap-2 focus-within:border-accent dark:focus-within:border-accent focus-within:ring-2 focus-within:ring-[#007A53]/20 ${isDark ? "bg-surface border-line" : "bg-white border-line"}`}>
                <Lock size={18} className={"text-muted"} />
                <input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-faint" : "text-ink placeholder:text-faint"}`} disabled={submitting} />
                <button type="button" onClick={() => setShowPassword((p) => !p)} className="cursor-pointer" tabIndex={-1}>
                  {showPassword ? <EyeOff size={18} className={"text-muted"} /> : <Eye size={18} className={"text-muted"} />}
                </button>
              </div>
            </div>

            <div className="mt-6">
              <button type="submit" disabled={submitting} className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-white font-bold text-sm transition-colors cursor-pointer ${submitting ? "opacity-70" : ""}`} style={{ backgroundColor: isDark ? "#078080" : "#007A53" }}>
                {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Login"}
              </button>
            </div>
          </form>

          <div className="flex items-center justify-center gap-1.5 mt-7">
            <div className="w-8 h-1 rounded-full bg-accent" />
            <div className="w-8 h-1 rounded-full bg-warning" />
            <div className="w-8 h-1 rounded-full bg-danger" />
          </div>
        </div>

        <p className={`text-center text-xs mt-5 text-muted`}>
          © 2026 Admin Portal. All rights reserved.
        </p>
      </div>
    </div>
  );
}
