"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Tilt from "@/components/Tilt";
import { api, getRol } from "@/api/client";
import { bs, fechaCorta } from "@/lib/format";

type Diario = {
  fecha: string;
  ventasBrutas: number;
  anulaciones: number;
  ventasNetas: number;
  porMetodoPago: Record<string, number>;
  totalVentas: number;
  totalAnuladas: number;
  productosBajoMinimo: { id: string; nombre: string; stock: number; limiteMinimo: number }[];
};

type AdminStats = {
  totalComercios: number;
  comerciosActivos: number;
  comerciosVencidos: number;
  solicitudesPendientes: number;
};

export default function DashboardPage() {
  const [d, setD] = useState<Diario | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const rol = getRol();
    const admin = rol === "SUPER_ADMIN";
    setIsAdmin(admin);

    if (admin) {
      // Super Admin: cargar estadísticas propias del SaaS
      Promise.all([
        api<any[]>("/admin/comercios"),
        api<any[]>("/admin/solicitudes"),
      ])
        .then(([comercios, solicitudes]) => {
          setAdminStats({
            totalComercios: comercios.length,
            comerciosActivos: comercios.filter((c) => !c.membresiaVencida && c.membresia !== "SUSPENDIDO").length,
            comerciosVencidos: comercios.filter((c) => c.membresiaVencida || c.membresia === "SUSPENDIDO").length,
            solicitudesPendientes: solicitudes.filter((s) => s.estado === "PENDIENTE").length,
          });
        })
        .catch((e) => setError(e.message));
    } else {
      // Comercio: cargar reporte diario
      api<Diario>("/reportes/diario")
        .then(setD)
        .catch((e) => setError(e.message));
    }
  }, []);

  return (
    <Shell>
      {isAdmin ? (
        <>
          <h1 style={{ fontSize: 30 }}>Panel de Administración</h1>
          <p className="muted" style={{ margin: "4px 0 22px" }}>
            Resumen general del SaaS RestoStock
          </p>

          {error && <div className="alert-strip">{error}</div>}

          {adminStats && (
            <div className="grid grid-stats">
              <Tilt>
                <div className="card stat glow">
                  <div className="label">Total Comercios</div>
                  <div className="value tabular" style={{ color: "var(--neon)" }}>{adminStats.totalComercios}</div>
                  <div className="hint">Registrados en la plataforma</div>
                </div>
              </Tilt>
              <Tilt>
                <div className="card stat">
                  <div className="label">Comercios Activos</div>
                  <div className="value tabular" style={{ color: "#4ade80" }}>{adminStats.comerciosActivos}</div>
                  <div className="hint">Con membresía vigente</div>
                </div>
              </Tilt>
              <Tilt>
                <div className="card stat">
                  <div className="label">Vencidos / Suspendidos</div>
                  <div className="value tabular" style={{ color: "var(--red)" }}>{adminStats.comerciosVencidos}</div>
                  <div className="hint">Requieren atención</div>
                </div>
              </Tilt>
              <Tilt>
                <div className="card stat">
                  <div className="label">Solicitudes Pendientes</div>
                  <div className="value tabular" style={{ color: "#38bdf8" }}>{adminStats.solicitudesPendientes}</div>
                  <div className="hint">Pagos por aprobar</div>
                </div>
              </Tilt>
            </div>
          )}

          <div style={{ marginTop: 28 }}>
            <div className="card" style={{ textAlign: "center", padding: "32px 20px", color: "var(--ink-soft)" }}>
              <p style={{ fontSize: 15, marginBottom: 6 }}>
                Para gestionar comercios, solicitudes de pago y configuración del sistema
              </p>
              <a href="/admin" className="btn btn-primary" style={{ display: "inline-flex", marginTop: 8 }}>
                Ir a Control Central →
              </a>
            </div>
          </div>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 30 }}>Panel del día</h1>
          <p className="muted" style={{ margin: "4px 0 22px" }}>
            {d ? `Resumen de ${fechaCorta(d.fecha)}` : "Cargando…"}
          </p>

          {error && <div className="alert-strip">{error}</div>}

          {d && (
            <>
              <div className="grid grid-stats">
                <Tilt>
                  <div className="card stat glow">
                    <div className="label">Ventas del día</div>
                    <div className="value tabular" style={{ color: "var(--neon)" }}>{bs(d.ventasNetas)}</div>
                    <div className="hint">{d.totalVentas} ventas consolidadas</div>
                  </div>
                </Tilt>
                <Tilt>
                  <div className="card stat">
                    <div className="label">Cobros por Efectivo</div>
                    <div className="value tabular">{bs(d.porMetodoPago.EFECTIVO ?? 0)}</div>
                    <div className="hint">Monto cobrado en efectivo</div>
                  </div>
                </Tilt>
                <Tilt>
                  <div className="card stat">
                    <div className="label">Cobros por QR</div>
                    <div className="value tabular" style={{ color: "#38bdf8" }}>{bs(d.porMetodoPago.QR ?? 0)}</div>
                    <div className="hint">Monto cobrado con QR Simple</div>
                  </div>
                </Tilt>
              </div>

              <div style={{ marginTop: 22 }}>
                <h2 style={{ fontSize: 20, marginBottom: 12 }}>Reabastecimiento urgente</h2>
                {d.productosBajoMinimo.length === 0 ? (
                  <div className="card" style={{ color: "var(--ink-soft)", textAlign: "center" }}>
                    Todo tu inventario está por encima del límite mínimo.
                  </div>
                ) : (
                  <div className="grid grid-products">
                    {d.productosBajoMinimo.map((p) => (
                      <div key={p.id} className="card glow-red" style={{ borderColor: "var(--red)" }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 15, textTransform: "uppercase" }}>{p.nombre}</div>
                        <div className="tabular" style={{ fontSize: 13, color: "var(--red)", marginTop: 6 }}>
                          {p.stock} / mínimo {p.limiteMinimo}
                        </div>
                        <span className="badge badge-danger" style={{ marginTop: 8 }}>Reponer</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </Shell>
  );
}
