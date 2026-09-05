import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export default function Login() {
  const { user, loading, login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user !== null) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

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
      <div className="min-h-screen flex items-center justify-center bg-[#F8F5F2] dark:bg-[#121212]">
        <div className="w-8 h-8 border-4 border-[#007A53] dark:border-[#078080] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8F5F2] dark:bg-[#121212]">
      <div className="w-full max-w-md">
        {/* Green header banner */}
        <div className="rounded-t-3xl px-6 pt-10 pb-8 text-center" style={{ backgroundColor: isDark ? "#078080" : "#007A53" }}>
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <div className="w-10 h-1.5 rounded-full bg-[#FF6720]" />
            <div className="w-6 h-1.5 rounded-full bg-[#DA291C]" />
          </div>
          <div className="w-14 h-14 mx-auto flex items-center justify-center bg-white rounded-2xl mb-4 overflow-hidden">
            <span className="text-[#007A53] text-xl font-bold">711</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Welcome Back</h1>
          <p className="text-sm text-white/80 mt-1.5">Login to admin panel</p>
        </div>

        {/* Form Card */}
        <div className={`rounded-b-3xl shadow-lg px-7 py-7 ${isDark ? "bg-[#1E1E1E]" : "bg-white"}`}>
          <form onSubmit={handleSubmit} noValidate>
            <h2 className={`text-xl font-extrabold mb-1 ${isDark ? "text-white" : "text-[#232323]"}`}>Sign in</h2>
            <p className={`text-sm mb-6 ${isDark ? "text-[#A0A0A0]" : "text-[#777]"}`}>Enter your admin credentials</p>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-[#FFF0F0] dark:bg-[#3D1515] border border-[#DA291C]/30">
                <p className="text-sm text-[#DA291C]">{error}</p>
              </div>
            )}

            <div className="mb-4">
              <label className={`text-sm font-semibold mb-1.5 block ${isDark ? "text-white" : "text-[#232323]"}`}>Email</label>
              <div className={`flex items-center h-12 px-3 rounded-xl border gap-2 focus-within:border-[#007A53] dark:focus-within:border-[#078080] focus-within:ring-2 focus-within:ring-[#007A53]/20 ${isDark ? "bg-[#121212] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
                <Mail size={18} className={isDark ? "text-[#A0A0A0]" : "text-[#777]"} />
                <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-[#555]" : "text-[#232323] placeholder:text-[#aaa]"}`} disabled={submitting} />
              </div>
            </div>

            <div className="mb-2">
              <label className={`text-sm font-semibold mb-1.5 block ${isDark ? "text-white" : "text-[#232323]"}`}>Password</label>
              <div className={`flex items-center h-12 px-3 rounded-xl border gap-2 focus-within:border-[#007A53] dark:focus-within:border-[#078080] focus-within:ring-2 focus-within:ring-[#007A53]/20 ${isDark ? "bg-[#121212] border-[#2E2E2E]" : "bg-white border-[#E5E2DE]"}`}>
                <Lock size={18} className={isDark ? "text-[#A0A0A0]" : "text-[#777]"} />
                <input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className={`flex-1 h-full outline-none bg-transparent text-sm ${isDark ? "text-white placeholder:text-[#555]" : "text-[#232323] placeholder:text-[#aaa]"}`} disabled={submitting} />
                <button type="button" onClick={() => setShowPassword((p) => !p)} className="cursor-pointer" tabIndex={-1}>
                  {showPassword ? <EyeOff size={18} className={isDark ? "text-[#A0A0A0]" : "text-[#777]"} /> : <Eye size={18} className={isDark ? "text-[#A0A0A0]" : "text-[#777]"} />}
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
            <div className="w-8 h-1 rounded-full bg-[#007A53] dark:bg-[#078080]" />
            <div className="w-8 h-1 rounded-full bg-[#FF6720]" />
            <div className="w-8 h-1 rounded-full bg-[#DA291C]" />
          </div>
        </div>

        <p className={`text-center text-xs mt-5 ${isDark ? "text-[#A0A0A0]" : "text-[#777]"}`}>
          © 2026 Admin Portal. All rights reserved.
        </p>
      </div>
    </div>
  );
}
