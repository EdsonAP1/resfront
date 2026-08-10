import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./app/page";
import LoginPage from "./app/login/page";
import DashboardPage from "./app/dashboard/page";
import VentasPage from "./app/ventas/page";
import InventarioPage from "./app/inventario/page";
import ClientesPage from "./app/clientes/page";
import CajaPage from "./app/caja/page";
import ReportesPage from "./app/reportes/page";
import ConfiguracionPage from "./app/configuracion/page";
import AdminPage from "./app/admin/page";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas Privadas (cada página internamente incluye su propio Shell) */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/ventas" element={<VentasPage />} />
        <Route path="/inventario" element={<InventarioPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/caja" element={<CajaPage />} />
        <Route path="/reportes" element={<ReportesPage />} />
        <Route path="/configuracion" element={<ConfiguracionPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
}
