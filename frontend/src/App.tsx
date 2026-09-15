import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { CreateTicketPage } from "./pages/CreateTicketPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TicketDetailPage } from "./pages/TicketDetailPage";
import { UsersPage } from "./pages/UsersPage";

export default function App() {
  return (
    <AuthProvider><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}><Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tickets/new" element={<CreateTicketPage />} />
        <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
        <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Route></Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></AuthProvider>
  );
}
