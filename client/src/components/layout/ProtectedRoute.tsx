import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types/api";

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
  loginPath?: string;
}

const HOME_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin",
  judge: "/judge",
  participant: "/participant",
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  loginPath = "/login",
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
          fontFamily: "var(--font-heading)",
          color: "var(--color-navy)",
          fontSize: "18px",
        }}
      >
        Loading Venture Craft System...
      </div>
    );
  }

  if (!user) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role] ?? "/leaderboard"} replace />;
  }

  return children;
};
