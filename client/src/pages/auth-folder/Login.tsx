import { useState } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { LightTheme } from "../../theme/theme";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);

  const { colors, spacing, radius } = LightTheme;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundColor: colors.background,
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 mx-auto flex items-center justify-center shadow-md"
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
            }}
          >
            <span className="text-white text-2xl font-bold">711</span>
          </div>

          <h1
            className="text-3xl font-bold mt-5"
            style={{ color: colors.headline }}
          >
            Welcome Back
          </h1>

          <p className="mt-2" style={{ color: colors.muted }}>
            Sign in to your customer account
          </p>
        </div>

        {/* Login Card */}
        <div
          className="shadow-lg p-8"
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            border: `1px solid ${colors.border}`,
          }}
        >
          <form>
            {/* Email */}
            <div style={{ marginBottom: spacing.lg }}>
              <label
                htmlFor="email"
                className="block font-semibold mb-2"
                style={{ color: colors.headline }}
              >
                Email Address
              </label>

              <div
                className="flex items-center px-4 h-14"
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                }}
              >
                <Mail size={20} color={colors.muted} />

                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="w-full h-full px-3 outline-none bg-transparent"
                  style={{
                    color: colors.paragraph,
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: spacing.sm }}>
              <label
                htmlFor="password"
                className="block font-semibold mb-2"
                style={{ color: colors.headline }}
              >
                Password
              </label>

              <div
                className="flex items-center px-4 h-14"
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                }}
              >
                <Lock size={20} color={colors.muted} />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="w-full h-full px-3 outline-none bg-transparent"
                  style={{
                    color: colors.paragraph,
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center justify-center"
                >
                  {showPassword ? (
                    <EyeOff size={20} color={colors.muted} />
                  ) : (
                    <Eye size={20} color={colors.muted} />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end mb-7">
              <a
                href="/forgot-password"
                className="text-sm font-semibold"
                style={{ color: colors.primary }}
              >
                Forgot Password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full h-14 text-white font-bold transition-all"
              style={{
                backgroundColor: colors.primary,
                borderRadius: radius.md,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.primaryDark;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.primary;
              }}
            >
              Sign In
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-7">
            <div
              className="h-px flex-1"
              style={{ backgroundColor: colors.border }}
            />

            <span className="text-sm" style={{ color: colors.muted }}>
              OR
            </span>

            <div
              className="h-px flex-1"
              style={{ backgroundColor: colors.border }}
            />
          </div>

          {/* Register */}
          <p className="text-center text-sm" style={{ color: colors.muted }}>
            Don't have an account?{" "}
            <a
              href="/register"
              className="font-bold"
              style={{ color: colors.primary }}
            >
              Create an account
            </a>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: colors.muted }}>
          © 2026 Customer Portal. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
