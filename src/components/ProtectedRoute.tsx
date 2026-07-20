import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { user, isLoading, isRecoverySession } = useAuth();
  if (isLoading) return null;
  if (isRecoverySession) return <Navigate to="/reset-password" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
