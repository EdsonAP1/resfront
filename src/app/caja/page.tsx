"use client";

import { useEffect, useState, useMemo, FormEvent } from "react";
import { createPortal } from "react-dom";
import Shell from "@/components/Shell";
import { api, apiBlob } from "@/api/client";
import { bs } from "@/lib/format";

type Movimiento = { id: string; tipo: string; concepto: string; monto: number; usuario: string; fecha: string };
type CajaActual = {
  id: string;
  montoInicial: number;
  montoEsperadoActual: number;
  abiertaAt: string;
  aperturaPor: string;
  movimientos: Movimiento[];
};
type Cierre = {
  id: string;
  montoEsperado: number;
  montoContado: number;
  diferencia: number;
  resultado: string;
  cerradoPor: string;
  cerradoAt: string;
};

export default function CajaPage() {
  const [caja, setCaja] = useState<CajaActual | null>(null);
  const [historial, setHistorial] = useState<Cierre[]>([]);
  const [montoInicial, setMontoInicial] = useState("");
  const [concepto, setConcepto] = useState("");
  const [montoSalida, setMontoSalida] = useState("");
  const [montoContado, setMontoContado] = useState("");
  const [detalle, setDetalle] = useState("");
  const [toast, setToast] = useState<{ msg: string; tipo: string } | null>(null);

  // Estados para reporte PDF
  const [desdePdf, setDesdePdf] = useState("");
  const [hastaPdf, setHastaPdf] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // Estado para Heatmap de ganancias
  const [heatmapData, setHeatmapData] = useState<{ fecha: string; monto: number }[]>([]);

  const showToast = (msg: string, tipo = "success") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  const load = () => {
    api<CajaActual | null>("/cajas/actual").then(setCaja).catch((e) => showToast(e.message, "error"));
    api<Cierre[]>("/cajas/historial").then(setHistorial).catch(() => {});
    api<{ fecha: string; monto: number }[]>("/reportes/actividad-anual").then(setHeatmapData).catch(() => {});
  };

  useEffect(load, []);

  // Procesamiento de datos para el Heatmap (Últimos 365 días)
  const heatmapDays = useMemo(() => {
    const arr = [];
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
    
    // Alinear al inicio de la semana (Domingo)
    const startDay = inicio.getDay();
    const dateCursor = new Date(inicio);
    dateCursor.setDate(dateCursor.getDate() - startDay);

    const maxMonto = Math.max(...heatmapData.map((d) => d.monto), 1);

    while (dateCursor <= hoy) {
      const offset = dateCursor.getTimezoneOffset();
      const localDate = new Date(dateCursor.getTime() - offset * 60 * 1000);
      const key = localDate.toISOString().slice(0, 10);
      
      const registro = heatmapData.find((d) => d.fecha === key);
      const monto = registro ? registro.monto : 0;

      let color = "rgba(30, 41, 59, 0.4)"; // Sin ganancias / cerrado
      if (monto > 0) {
        const prop = monto / maxMonto;
        if (prop <= 0.25) color = "rgba(74, 222, 128, 0.2)";
        else if (prop <= 0.5) color = "rgba(74, 222, 128, 0.45)";
        else if (prop <= 0.75) color = "rgba(74, 222, 128, 0.7)";
        else color = "rgba(74, 222, 128, 1)";
      }

      arr.push({
        fecha: new Date(dateCursor),
        key,
        monto,
        color,
      });

      dateCursor.setDate(dateCursor.getDate() + 1);
    }
    return arr;
  }, [heatmapData]);

  const abrir = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/cajas/abrir", { method: "POST", body: JSON.stringify({ montoInicial: Number(montoInicial) }) });
      showToast("Caja abierta. Buen turno.");
      setMontoInicial("");
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const salida = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/cajas/salida", { method: "POST", body: JSON.stringify({ concepto, monto: Number(montoSalida) }) });
      showToast(`Salida registrada: ${concepto}`);
      setConcepto("");
      setMontoSalida("");
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const cerrar = async (e: FormEvent) => {
    e.preventDefault();
    if (!confirm("¿Cerrar la caja? El cierre quedará registrado de forma inalterable.")) return;
    try {
      const res = await api<{ resultado: string; diferencia: number }>("/cajas/cerrar", {
        method: "POST",
        body: JSON.stringify({ montoContado: Number(montoContado), detalle }),
      });
      const msg =
        res.resultado === "CUADRADA"
          ? "Caja cuadrada. Perfecto."
          : res.resultado === "SOBRANTE"
            ? `Caja cerrada con SOBRANTE de ${bs(res.diferencia)}`
            : `Caja cerrada con FALTANTE de ${bs(res.diferencia)}`;
      showToast(msg, res.resultado === "CUADRADA" ? "success" : "error");
      setMontoContado("");
      setDetalle("");
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const exportarPdf = async (e: FormEvent) => {
    e.preventDefault();
    setGenerandoPdf(true);
    try {
      const query = new URLSearchParams();
      if (desdePdf) query.append("desde", desdePdf);
      if (hastaPdf) query.append("hasta", hastaPdf);

      const blob = await apiBlob(`/cajas/reporte-pdf?${query.toString()}`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast("Reporte PDF generado exitosamente.");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setGenerandoPdf(false);
    }
  };

  const resultadoLabel = (r: string) =>
    r === "CUADRADA" ? { t: "Cuadrada", cls: "badge-success" } : r === "SOBRANTE" ? { t: "Sobrante", cls: "badge-warn" } : { t: "Faltante", cls: "badge-danger" };

  return (
    <Shell>
      <h1 style={{ fontSize: 32 }}>Caja y Arqueo</h1>
      <p style={{ color: "var(--ink-soft)", margin: "4px 0 22px" }}>
        Apertura con fondo inicial, movimientos del turno y cierre con conteo físico.
      </p>
      {toast && createPortal(
        <div className={`toast ${toast.tipo}`} style={{ zIndex: 100000 }}>
          {toast.tipo === "success" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--neon)", flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--red)", flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span>{toast.msg}</span>
        </div>,
        document.body
      )}

      {/* ---------- Mapa de Calor de Ganancias (Heatmap) ---------- */}
      <div className="card" style={{ marginBottom: 26, padding: "18px 22px" }}>
        <h3 style={{ fontSize: 16, marginBottom: 4, fontWeight: 700 }}>Actividad de Ganancias Diarias</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
          Distribución de recaudación neta en los últimos 365 días del negocio (Bs).
        </p>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
          <div 
            style={{ 
              display: "grid", 
              gridTemplateRows: "repeat(7, 12px)", 
              gridAutoFlow: "column", 
              gridAutoColumns: "12px", 
              gap: 3,
              width: "max-content"
            }}
          >
            {heatmapDays.map((d) => (
              <div
                key={d.key}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: d.color,
                  cursor: "pointer",
                  transition: "transform 0.1s ease"
                }}
                title={`${d.fecha.toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" })}: Bs ${d.monto.toFixed(2)}`}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.2)";
                  e.currentTarget.style.boxShadow = "0 0 5px var(--neon)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--ink-soft)", marginTop: 6, width: "100%", maxWidth: 640 }}>
            <span>Menos</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "rgba(30, 41, 59, 0.4)" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "rgba(74, 222, 128, 0.2)" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "rgba(74, 222, 128, 0.45)" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "rgba(74, 222, 128, 0.7)" }} />
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "rgba(74, 222, 128, 1)" }} />
            </div>
            <span>Más ventas</span>
          </div>
        </div>
      </div>

      {!caja && (
        <div className="card" style={{ maxWidth: 420 }}>
          <h2 style={{ fontSize: 20, marginBottom: 6 }}>Abrir caja</h2>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>Registra el monto inicial en efectivo para iniciar la jornada.</p>
          <form onSubmit={abrir}>
            <div className="field">
              <label>Monto inicial (Bs)</label>
              <input className="input" type="number" step="0.01" min="0" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} required />
            </div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>Abrir caja</button>
          </form>
        </div>
      )}

      {caja && (
        <>
          <div className="grid grid-stats">
            <div className="card stat">
              <div className="label">Fondo inicial</div>
              <div className="value tabular">{bs(caja.montoInicial)}</div>
              <div className="hint">Abierta por {caja.aperturaPor}</div>
            </div>
            <div className="card stat">
              <div className="label">Monto esperado ahora</div>
              <div className="value tabular" style={{ color: "var(--neon)" }}>{bs(caja.montoEsperadoActual)}</div>
              <div className="hint">Inicial + ventas − anulaciones − salidas</div>
            </div>
            <div className="card stat">
              <div className="label">Estado</div>
              <div className="value" style={{ fontSize: 24 }}>Abierta</div>
              <div className="hint">Movimientos: {caja.movimientos.length}</div>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", marginTop: 22 }}>
            <div className="card">
              <h2 style={{ fontSize: 20, marginBottom: 12 }}>Movimientos del turno</h2>
              {caja.movimientos.length === 0 ? (
                <div className="empty" style={{ padding: 30 }}>Sin movimientos todavía.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Concepto</th><th>Tipo</th><th style={{ textAlign: "right" }}>Monto</th><th>Usuario</th></tr>
                  </thead>
                  <tbody>
                    {caja.movimientos.map((m) => (
                      <tr key={m.id}>
                        <td>{m.concepto}</td>
                        <td>
                          <span className={`badge ${m.monto > 0 ? "badge-success" : "badge-danger"}`}>
                            {m.tipo === "VENTA" ? "Venta" : m.tipo === "ANULACION" ? "Anulación" : "Salida"}
                          </span>
                        </td>
                        <td className="tabular" style={{ textAlign: "right", fontWeight: 700 }}>
                          {m.monto > 0 ? "+" : "−"} {bs(Math.abs(m.monto))}
                        </td>
                        <td style={{ fontSize: 13, color: "var(--ink-soft)" }}>{m.usuario}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <form onSubmit={salida} style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 130px auto", gap: 10, alignItems: "end" }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Salida manual (proveedor, gasto)</label>
                  <input className="input" placeholder="Concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Monto</label>
                  <input className="input" type="number" step="0.01" min="0.01" placeholder="0.00" value={montoSalida} onChange={(e) => setMontoSalida(e.target.value)} required />
                </div>
                <button className="btn btn-olive">Registrar</button>
              </form>
            </div>

            <div className="card">
              <h2 style={{ fontSize: 20, marginBottom: 6 }}>Cerrar caja (arqueo)</h2>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
                Cuenta el dinero físico real e ingresa el total contado.
              </p>
              <form onSubmit={cerrar}>
                <div className="field">
                  <label>Monto esperado (calculado)</label>
                  <input className="input tabular" value={bs(caja.montoEsperadoActual)} disabled />
                </div>
                <div className="field">
                  <label>Dinero físico contado (Bs)</label>
                  <input className="input tabular" type="number" step="0.01" min="0" value={montoContado} onChange={(e) => setMontoContado(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Detalle (opcional)</label>
                  <input className="input" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
                </div>
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>Cerrar y registrar arqueo</button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* ---------- Reporte de Cajas PDF ---------- */}
      <div className="card" style={{ marginTop: 26, padding: "18px 22px" }}>
        <h3 style={{ fontSize: 17, marginBottom: 6, fontWeight: 700 }}>Exportar Reporte de Arqueos</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
          Genera un documento PDF detallado y consolidado de todos los arqueos de caja en un rango de fechas.
        </p>
        <form onSubmit={exportarPdf} style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
          <div className="field" style={{ margin: 0, minWidth: 160 }}>
            <label>Fecha Inicio</label>
            <input className="input" type="date" value={desdePdf} onChange={(e) => setDesdePdf(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0, minWidth: 160 }}>
            <label>Fecha Fin</label>
            <input className="input" type="date" value={hastaPdf} onChange={(e) => setHastaPdf(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={generandoPdf}>
            {generandoPdf ? "Generando..." : "🧾 Exportar Reporte PDF"}
          </button>
        </form>
      </div>

      {/* Agrupador del historial de cierres por mes y año */}
      {(() => {
        const groupedHistorial = (() => {
          const groups: Record<string, Cierre[]> = {};
          historial.forEach((c) => {
            const date = new Date(c.cerradoAt);
            const mesName = date.toLocaleDateString("es-BO", { month: "long", year: "numeric" });
            const mesFormateado = mesName.charAt(0).toUpperCase() + mesName.slice(1);
            if (!groups[mesFormateado]) {
              groups[mesFormateado] = [];
            }
            groups[mesFormateado].push(c);
          });
          return Object.entries(groups).map(([mes, cierres]) => ({ mes, cierres }));
        })();

        return (
          <div style={{ marginTop: 26 }}>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>Historial de cierres</h2>
            {groupedHistorial.length === 0 ? (
              <div className="empty" style={{ padding: 30 }}>Aún no hay cierres registrados.</div>
            ) : (
              groupedHistorial.map((g) => (
                <div key={g.mes} style={{ marginBottom: 26 }}>
                  <h3 style={{ fontSize: 16, color: "var(--neon)", margin: "14px 0 8px", fontWeight: 700 }}>
                    {g.mes}
                  </h3>
                  <div className="card" style={{ padding: 8 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Fecha</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Resultado</th><th>Cerrado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.cierres.map((c) => {
                          const r = resultadoLabel(c.resultado);
                          return (
                            <tr key={c.id}>
                              <td className="tabular">{new Date(c.cerradoAt).toLocaleString("es-BO")}</td>
                              <td className="tabular">{bs(c.montoEsperado)}</td>
                              <td className="tabular">{bs(c.montoContado)}</td>
                              <td className="tabular">{bs(c.diferencia)}</td>
                              <td><span className={`badge ${r.cls}`}>{r.t}</span></td>
                              <td style={{ fontSize: 13 }}>{c.cerradoPor}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })()}
    </Shell>
  );
}
