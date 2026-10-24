import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Navbar } from "./components/layout/Navbar";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { JudgeLoginPage } from "./pages/auth/JudgeLoginPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { StudentLoginPage } from "./pages/auth/StudentLoginPage";
import { JudgePortalPage } from "./pages/judge/JudgePortalPage";
import { LeaderboardPage } from "./pages/leaderboard/LeaderboardPage";
import { ParticipantPortalPage } from "./pages/participant/ParticipantPortalPage";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/student/login" element={<StudentLoginPage />} />
              <Route path="/judge/login" element={<JudgeLoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />

              {/* Protected Participant Portal (Participant + Admin) */}
              <Route
                path="/participant"
                element={
                  <ProtectedRoute allowedRoles={["participant", "admin"]}>
                    <ParticipantPortalPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Judge Dashboard (Judge Only) */}
              <Route
                path="/judge"
                element={
                  <ProtectedRoute allowedRoles={["judge"]} loginPath="/judge/login">
                    <JudgePortalPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Dashboard (Admin Only) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback to Leaderboard */}
              <Route path="/" element={<Navigate to="/leaderboard" replace />} />
              <Route path="*" element={<Navigate to="/leaderboard" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
