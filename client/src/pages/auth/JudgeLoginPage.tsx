import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export const JudgeLoginPage: React.FC = () => {
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
    requestedPath && requestedPath.startsWith("/judge") && requestedPath !== "/judge/login"
      ? requestedPath
      : "/judge";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Please enter your judge email address.");
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

      if (user.role !== "judge") {
        logout();
        setError(
          "This account does not have judge access. Please use the general sign-in page for administrator or participant accounts.",
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
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "var(--color-navy)",
              lineHeight: 1.1,
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
              marginTop: "6px",
              textTransform: "uppercase",
            }}
          >
            Present &bull; Connect &bull; Lead
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
          Judge Access
        </span>

        <h2
          style={{
            fontSize: "22px",
            marginBottom: "8px",
            color: "var(--color-navy)",
          }}
        >
          Judge Sign In
        </h2>
        <p
          style={{
            color: "var(--color-slate)",
            fontSize: "13px",
            marginBottom: "24px",
          }}
        >
          Access your assigned evaluation panels and scoring workspace.
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
              htmlFor="judge-email"
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
              id="judge-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="judge@venturecraft.org"
              autoComplete="email"
              required
              autoFocus
              disabled={submitting}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              htmlFor="judge-password"
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
                id="judge-password"
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
            {submitting ? (
              <>
                <span className="loading-spinner" aria-hidden="true" />
                Signing in...
              </>
            ) : (
              "Sign In as Judge"
            )}
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
            Administrator or participant?{" "}
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
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-slate)" }}>
            Judge accounts are provisioned by the Venture Craft event committee.
          </div>
        </div>
      </div>
    </div>
  );
};
