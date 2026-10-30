import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { VentureCraftLogo } from "../common/VentureCraftLogo";

export const Navbar: React.FC = () => {
  const { user, logout, isAdmin, isJudge, isParticipant } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname.startsWith(path);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <nav
      className="no-print"
      style={{
        background: "var(--color-navy)",
        borderBottom: "2px solid var(--color-gold)",
        color: "#FFFFFF",
        padding: "0 16px",
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
      {/* Brand Logo & Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <Link
          to="/"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
          onClick={closeMenu}
        >
          {/* Official Venture Craft Logo */}
          <VentureCraftLogo variant="responsive" height={44} />
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#FFFFFF",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
          >
            Venture Craft
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div
          className="navbar-desktop-nav"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Link
            to="/leaderboard"
            style={{
              padding: "7px 12px",
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: 600,
              color: isActive("/leaderboard") ? "var(--color-gold)" : "#E0E5EC",
              background: isActive("/leaderboard")
                ? "rgba(181, 154, 101, 0.15)"
                : "transparent",
              transition: "all 0.15s",
            }}
          >
            Live Leaderboard
          </Link>

          {(isParticipant || isAdmin) && (
            <Link
              to="/participant"
              style={{
                padding: "7px 12px",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 600,
                color: isActive("/participant") ? "var(--color-gold)" : "#E0E5EC",
                background: isActive("/participant")
                  ? "rgba(181, 154, 101, 0.15)"
                  : "transparent",
                transition: "all 0.15s",
              }}
            >
              Participant Portal
            </Link>
          )}

          {isJudge && (
            <Link
              to="/judge"
              style={{
                padding: "7px 12px",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 600,
                color: isActive("/judge") ? "var(--color-gold)" : "#E0E5EC",
                background: isActive("/judge")
                  ? "rgba(181, 154, 101, 0.15)"
                  : "transparent",
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
                padding: "7px 12px",
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 600,
                color: isActive("/admin") ? "var(--color-gold)" : "#E0E5EC",
                background: isActive("/admin")
                  ? "rgba(181, 154, 101, 0.15)"
                  : "transparent",
                transition: "all 0.15s",
              }}
            >
              Admin Dashboard
            </Link>
          )}
        </div>
      </div>

      {/* Desktop User Actions */}
      <div
        className="navbar-desktop-nav"
        style={{ display: "flex", alignItems: "center", gap: "12px" }}
      >
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  maxWidth: "160px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "nowrap",
            }}
          >
            <Link
              to="/student/login"
              style={{
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#E0E5EC",
                border: "1px solid rgba(228, 218, 201, 0.3)",
                borderRadius: "4px",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              Student Login
            </Link>
            <Link
              to="/judge/login"
              style={{
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#E0E5EC",
                border: "1px solid rgba(228, 218, 201, 0.3)",
                borderRadius: "4px",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              Judge Login
            </Link>
            <Link
              to="/register"
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-gold)",
                border: "1px solid rgba(181, 154, 101, 0.5)",
                borderRadius: "4px",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              Register
            </Link>
            <Link
              to="/login"
              className="btn btn-gold"
              style={{ padding: "6px 14px", fontSize: "12px", whiteSpace: "nowrap" }}
            >
              Sign In
            </Link>
          </div>
        )}
      </div>

      {/* Mobile Hamburger Button */}
      <button
        type="button"
        className="navbar-mobile-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle navigation menu"
        style={{
          display: "none",
          background: "transparent",
          border: "1px solid rgba(181, 154, 101, 0.4)",
          borderRadius: "4px",
          color: "var(--color-gold)",
          padding: "6px 10px",
          cursor: "pointer",
          fontSize: "18px",
        }}
      >
        {mobileMenuOpen ? "✕" : "☰"}
      </button>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "absolute",
            top: "68px",
            left: 0,
            right: 0,
            background: "var(--color-navy-dark)",
            borderBottom: "3px solid var(--color-gold)",
            boxShadow: "var(--shadow-lg)",
            padding: "16px 20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            zIndex: 99,
          }}
        >
          {user && (
            <div
              style={{
                paddingBottom: "12px",
                borderBottom: "1px solid rgba(228, 218, 201, 0.15)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#FFFFFF" }}>
                  {user.name}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--color-gold)",
                    textTransform: "uppercase",
                  }}
                >
                  {user.role}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                style={{
                  background: "transparent",
                  color: "#E0E5EC",
                  borderColor: "rgba(228, 218, 201, 0.3)",
                }}
              >
                Logout
              </button>
            </div>
          )}

          <Link
            to="/leaderboard"
            onClick={closeMenu}
            style={{
              padding: "10px 12px",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: 600,
              color: isActive("/leaderboard") ? "var(--color-gold)" : "#E0E5EC",
              background: isActive("/leaderboard")
                ? "rgba(181, 154, 101, 0.15)"
                : "transparent",
            }}
          >
            Live Leaderboard
          </Link>

          {(isParticipant || isAdmin) && (
            <Link
              to="/participant"
              onClick={closeMenu}
              style={{
                padding: "10px 12px",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: 600,
                color: isActive("/participant") ? "var(--color-gold)" : "#E0E5EC",
                background: isActive("/participant")
                  ? "rgba(181, 154, 101, 0.15)"
                  : "transparent",
              }}
            >
              Participant Portal
            </Link>
          )}

          {isJudge && (
            <Link
              to="/judge"
              onClick={closeMenu}
              style={{
                padding: "10px 12px",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: 600,
                color: isActive("/judge") ? "var(--color-gold)" : "#E0E5EC",
                background: isActive("/judge")
                  ? "rgba(181, 154, 101, 0.15)"
                  : "transparent",
              }}
            >
              Judge Portal
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              onClick={closeMenu}
              style={{
                padding: "10px 12px",
                borderRadius: "4px",
                fontSize: "14px",
                fontWeight: 600,
                color: isActive("/admin") ? "var(--color-gold)" : "#E0E5EC",
                background: isActive("/admin")
                  ? "rgba(181, 154, 101, 0.15)"
                  : "transparent",
              }}
            >
              Admin Dashboard
            </Link>
          )}

          {!user && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                paddingTop: "12px",
                borderTop: "1px solid rgba(228, 218, 201, 0.15)",
              }}
            >
              <Link
                to="/student/login"
                onClick={closeMenu}
                className="btn btn-secondary btn-sm"
                style={{
                  textAlign: "center",
                  background: "transparent",
                  color: "#E0E5EC",
                  borderColor: "rgba(228, 218, 201, 0.3)",
                }}
              >
                Student Login
              </Link>
              <Link
                to="/judge/login"
                onClick={closeMenu}
                className="btn btn-secondary btn-sm"
                style={{
                  textAlign: "center",
                  background: "transparent",
                  color: "#E0E5EC",
                  borderColor: "rgba(228, 218, 201, 0.3)",
                }}
              >
                Judge Login
              </Link>
              <Link
                to="/register"
                onClick={closeMenu}
                className="btn btn-secondary btn-sm"
                style={{
                  textAlign: "center",
                  borderColor: "var(--color-gold)",
                  color: "var(--color-gold)",
                }}
              >
                Register
              </Link>
              <Link
                to="/login"
                onClick={closeMenu}
                className="btn btn-gold btn-sm"
                style={{ textAlign: "center" }}
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};
