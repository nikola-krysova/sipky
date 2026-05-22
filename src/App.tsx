import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import HomePage from "./pages/index";
import ReservacePage from "./pages/rezervace/Token";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminLogin from "./pages/admin/login";
import AdminDashboard from "./pages/admin/index";
import AdminReservations from "./pages/admin/rezervace";
import AdminSettings from "./pages/admin/nastaveni";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/rezervace/:token" element={<ReservacePage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="rezervace" element={<AdminReservations />} />
          <Route path="nastaveni" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
