import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { KARVAANLogo } from "../../components/common/KARVAANLogo";
import { useAuth } from "../../context/AuthContext";

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === "admin") {
        navigate("/admin", { replace: true });
      } else if (user.role === "judge") {
        navigate("/judge", { replace: true });
      } else if (user.role === "participant") {
        navigate("/participant", { replace: true });
      } else {
        navigate("/leaderboard", { replace: true });
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
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
          boxShadow: "var(--shadow-md)",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: "28px" }}>
          <KARVAANLogo
            size="lg"
            showText={true}
            showTagline={true}
            variant="dark"
            className="logo-centered"
          />
        </div>

        <div
          style={{
            height: "1px",
            background: "var(--color-border)",
            margin: "0 auto 28px",
            width: "80%",
          }}
        />

        <h2
          style={{
            fontSize: "20px",
            marginBottom: "8px",
            color: "var(--color-navy)",
          }}
        >
          Portal Authentication
        </h2>
        <p style={{ color: "var(--color-slate)", fontSize: "13px", marginBottom: "24px" }}>
          Enter authorized administrative or judge credentials
        </p>

        {error && (
          <div
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

        <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
          <div style={{ marginBottom: "18px" }}>
            <label
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@karvaan.org"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-gold"
            disabled={submitting}
            style={{ width: "100%", padding: "12px", fontSize: "15px" }}
          >
            {submitting ? "Signing in..." : "Sign In to Portal"}
          </button>
        </form>

        <div
          style={{
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid var(--color-border-subtle)",
            fontSize: "12px",
            color: "var(--color-slate)",
          }}
        >
          Account access is restricted and provisioned by administrators.
        </div>
      </div>
    </div>
  );
};
