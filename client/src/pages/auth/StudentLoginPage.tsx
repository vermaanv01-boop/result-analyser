import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { VentureCraftLogo } from "../../components/common/VentureCraftLogo";

export const StudentLoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const requestedPath = (location.state as { from?: { pathname?: string } } | null)
    ?.from?.pathname;
  const redirectTo =
    requestedPath && requestedPath.startsWith("/participant") && requestedPath !== "/student/login"
      ? requestedPath
      : "/participant";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Please enter your student email address.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setSubmitting(true);

    try {
      const user = await login(normalizedEmail, password);

      if (user.role !== "participant") {
        logout();
        setError(
          "This account does not have participant access. Please use the appropriate login page for your role.",
        );
        return;
      }

      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please verify your credentials.";

      if (
        message.toLowerCase().includes("failed to fetch") ||
        message.toLowerCase().includes("network")
      ) {
        setError(
          "Unable to reach the Venture Craft server. Please check your connection and try again.",
        );
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 68px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "440px",
          padding: "40px 36px",
          background: "#FFFFFF",
          borderColor: "var(--color-border)",
          borderTop: "4px solid var(--color-gold)",
          boxShadow: "var(--shadow-md)",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <VentureCraftLogo variant="full" height={76} style={{ marginBottom: "10px" } as any} />
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "26px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--color-navy)",
              lineHeight: 1.1,
              marginTop: "8px",
            }}
          >
            Venture Craft
          </div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "12px",
              letterSpacing: "0.15em",
              color: "var(--color-gold)",
              marginTop: "4px",
              textTransform: "uppercase",
            }}
          >
            Think &bull; Adapt &bull; Innovate
          </div>
        </div>

        <span
          className="badge"
          style={{
            display: "inline-flex",
            marginBottom: "16px",
            background: "var(--color-gold-light)",
            color: "var(--color-navy)",
            border: "1px solid var(--color-gold)",
            letterSpacing: "0.1em",
          }}
        >
          Student Access
        </span>

        <h2
          style={{
            fontSize: "22px",
            marginBottom: "8px",
            color: "var(--color-navy)",
          }}
        >
          Student Sign In
        </h2>
        <p
          style={{
            color: "var(--color-slate)",
            fontSize: "13px",
            marginBottom: "24px",
          }}
        >
          Sign in with your registered participant account to access the Participant Portal.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              padding: "12px 14px",
              background: "var(--color-danger-bg)",
              color: "var(--color-danger)",
              border: "1px solid rgba(142, 46, 46, 0.2)",
              borderRadius: "4px",
              fontSize: "13px",
              textAlign: "left",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: "left" }} noValidate>
          <div style={{ marginBottom: "18px" }}>
            <label
              htmlFor="student-email"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--color-navy)",
                marginBottom: "6px",
              }}
            >
              Email Address
            </label>
            <input
              id="student-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              autoComplete="email"
              required
              autoFocus
              disabled={submitting}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              htmlFor="student-password"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--color-navy)",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="student-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                disabled={submitting}
                style={{ paddingRight: "68px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={submitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  top: "50%",
                  right: "8px",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--color-navy)",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "4px 8px",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-gold"
            disabled={submitting}
            aria-busy={submitting}
            style={{ width: "100%", padding: "12px", fontSize: "15px" }}
          >
            {submitting ? "Signing in..." : "Sign In as Student"}
          </button>
        </form>

        <div
          style={{
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid var(--color-border-subtle)",
            fontSize: "13px",
            color: "var(--color-navy)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div>
            Not registered yet?{" "}
            <Link
              to="/register"
              style={{
                color: "var(--color-navy)",
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              Register here
            </Link>
          </div>
          <div>
            Administrator or judge?{" "}
            <Link
              to="/login"
              style={{
                color: "var(--color-navy)",
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              Use general sign in
            </Link>
            {" / "}
            <Link
              to="/judge/login"
              style={{
                color: "var(--color-navy)",
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              Judge Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginPage;
