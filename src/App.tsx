import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { TicketProvider } from "./context/TicketContext";
import ProtectedRoute, { RoleRedirect } from "./components/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import CustomerDashboard from "./screens/CustomerDashboard";
import AgentQueue from "./screens/AgentQueue";
import AdminDashboard from "./screens/AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TicketProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<RoleRedirect />} />

            <Route
              path="/customer/*"
              element={
                <ProtectedRoute roles={["CUSTOMER"]}>
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/agent/*"
              element={
                <ProtectedRoute roles={["SUPPORT_AGENT"]}>
                  <AgentQueue />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/*"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TicketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
