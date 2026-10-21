import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { KARVAANLogo } from "../common/KARVAANLogo";

export const Navbar: React.FC = () => {
  const { user, logout, isAdmin, isJudge } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav
      className="no-print"
      style={{
        background: "var(--color-navy)",
        borderBottom: "2px solid var(--color-gold)",
        color: "#FFFFFF",
        padding: "0 24px",
        height: "68px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "var(--shadow-md)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "36px" }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <KARVAANLogo size="sm" variant="light" showTagline={false} />
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link
            to="/leaderboard"
            style={{
              padding: "8px 14px",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: 600,
              color: isActive("/leaderboard") ? "var(--color-gold)" : "#E0E5EC",
              background: isActive("/leaderboard") ? "rgba(181, 154, 101, 0.15)" : "transparent",
              transition: "all 0.15s",
            }}
          >
            Live Leaderboard
          </Link>

          {(isJudge || isAdmin) && (
            <Link
              to="/judge"
              style={{
                padding: "8px 14px",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: 600,
                color: isActive("/judge") ? "var(--color-gold)" : "#E0E5EC",
                background: isActive("/judge") ? "rgba(181, 154, 101, 0.15)" : "transparent",
                transition: "all 0.15s",
              }}
            >
              Judge Portal
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              style={{
                padding: "8px 14px",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: 600,
                color: isActive("/admin") ? "var(--color-gold)" : "#E0E5EC",
                background: isActive("/admin") ? "rgba(181, 154, 101, 0.15)" : "transparent",
                transition: "all 0.15s",
              }}
            >
              Admin Dashboard
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}>
                {user.name}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-gold)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {user.role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                background: "transparent",
                color: "#E0E5EC",
                borderColor: "rgba(228, 218, 201, 0.3)",
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn btn-gold" style={{ padding: "7px 16px" }}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
};
