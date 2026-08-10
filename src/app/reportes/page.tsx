"use client";

import { useEffect, useState, FormEvent } from "react";
import { createPortal } from "react-dom";
import Shell from "@/components/Shell";
import { api, apiBlob } from "@/api/client";
import { bs, fecha, METODOS_PAGO } from "@/lib/format";

type Venta = {
  id: string;
  numero: number;
  estado: string;
  metodoPago: string;
  subtotal: number;
  total: number;
  vendedor: string;
  cliente: string;
  fecha: string;
  anuladoEn: boolean;
  lineas: number;
};

type VentaDetalle = {
  id: string;
  numero: number;
  estado: string;
  metodoPago: string;
  total: number;
  fecha: string;
  vendedor: string;
  cliente: string | null;
  detalles: { productoId: string | null; producto: string; cantidad: number; precioUnitario: number; totalLinea: number }[];
  anulaciones: { id: string; tipo: string; motivo: string; montoDevuelto: number; usuario: string; fecha: string }[];
};

export default function ReportesPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null);
  const [anularId, setAnularId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [destino, setDestino] = useState<"STOCK" | "MERMA">("STOCK");
  const [toast, setToast] = useState<{ msg: string; tipo: string } | null>(null);

  const showToast = (msg: string, tipo = "success") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  const load = () => {
    api<Venta[]>("/ventas").then(setVentas).catch((e) => showToast(e.message, "error"));
  };

  useEffect(load, []);

  const verDetalle = (id: string) => api<VentaDetalle>(`/ventas/${id}`).then(setDetalle).catch((e) => showToast(e.message, "error"));

  const imprimirTicket = async (id: string) => {
    try {
      const blob = await apiBlob(`/ventas/${id}/ticket`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      showToast((e as Error).message, "error");
    }
  };

  const anular = async (e: FormEvent) => {
    e.preventDefault();
    if (!anularId || !motivo.trim()) return;
    try {
      const res = await api<{ tipo: string; montoDevuelto: number; ventaEstado: string }>(`/ventas/${anularId}/anular`, {
        method: "POST",
        body: JSON.stringify({ motivo, destino }),
      });
      showToast(`Anulación ${res.tipo}: ${bs(res.montoDevuelto)} · ${res.ventaEstado}`);
      setAnularId(null);
      setMotivo("");
      setDetalle(null);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  return (
    <Shell>
      <h1 style={{ fontSize: 32 }}>Reportes</h1>
      <p style={{ color: "var(--ink-soft)", margin: "4px 0 22px" }}>
        Historial de ventas con precios congelados. Las anulaciones nunca borran el original.
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

      {ventas.length === 0 ? (
        <div className="empty">Aún no hay ventas registradas.</div>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          <table className="table">
            <thead>
              <tr>
                <th>N°</th><th>Fecha</th><th>Estado</th><th>Pago</th><th style={{ textAlign: "right" }}>Total</th><th>Cliente</th><th>Vendedor</th><th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td className="tabular" style={{ fontWeight: 800 }}>#{v.numero}</td>
                  <td className="tabular" style={{ fontSize: 13 }}>{fecha(v.fecha)}</td>
                  <td>
                    {v.estado === "ANULADA" ? (
                      <span className="badge badge-danger">Anulada</span>
                    ) : v.anuladoEn ? (
                      <span className="badge badge-warn">Parcial</span>
                    ) : (
                      <span className="badge badge-success">Válida</span>
                    )}
                  </td>
                  <td style={{ textTransform: "capitalize", fontSize: 13 }}>{METODOS_PAGO[v.metodoPago] ?? v.metodoPago.toLowerCase()}</td>
                  <td className="tabular" style={{ textAlign: "right", fontWeight: 700 }}>{bs(v.total)}</td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{v.cliente}</td>
                  <td style={{ fontSize: 13, color: "var(--ink-soft)" }}>{v.vendedor}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12, marginRight: 6 }} onClick={() => verDetalle(v.id)}>
                      Ver
                    </button>
                    <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12, marginRight: 6 }} onClick={() => imprimirTicket(v.id)} title="Imprimir ticket PDF">
                      🧾 Ticket
                    </button>
                    {v.estado !== "ANULADA" && (
                      <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setAnularId(v.id)}>
                        Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detalle && (
        <div className="modal-backdrop" onClick={() => setDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22 }}>Venta #{detalle.numero}</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "2px 0 6px" }}>
              {fecha(detalle.fecha)} · {METODOS_PAGO[detalle.metodoPago] ?? detalle.metodoPago.toLowerCase()} · <b className="tabular">{bs(detalle.total)}</b>
            </p>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 14px" }}>
              <b>Cliente:</b> {detalle.cliente ?? "Público General"} · <b>Vendedor:</b> {detalle.vendedor}
            </p>
            <table className="table">
              <thead>
                <tr><th>Producto</th><th style={{ textAlign: "right" }}>Cant.</th><th style={{ textAlign: "right" }}>P.U.</th><th style={{ textAlign: "right" }}>Total</th></tr>
              </thead>
              <tbody>
                {detalle.detalles.map((d, i) => (
                  <tr key={i}>
                    <td>{d.producto}</td>
                    <td className="tabular" style={{ textAlign: "right" }}>{d.cantidad}</td>
                    <td className="tabular" style={{ textAlign: "right" }}>{bs(d.precioUnitario)}</td>
                    <td className="tabular" style={{ textAlign: "right" }}>{bs(d.totalLinea)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detalle.anulaciones.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Anulaciones</h3>
                {detalle.anulaciones.map((a) => (
                  <div key={a.id} className="card" style={{ padding: 12, marginBottom: 8, background: "var(--danger-soft)" }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{a.tipo === "TOTAL" ? "Anulación total" : "Anulación parcial"} · −{bs(a.montoDevuelto)}</div>
                    <div style={{ fontSize: 12.5 }}>{a.motivo} — {a.usuario}, {fecha(a.fecha)}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ textAlign: "right", marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => imprimirTicket(detalle.id)}>🧾 Imprimir ticket</button>
              <button className="btn btn-ghost" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {anularId && (
        <div className="modal-backdrop" onClick={() => setAnularId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, marginBottom: 6 }}>Anular venta</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
              Anulación total (todas las líneas) o parcial. La venta original queda registrada como anulada.
            </p>
            <form onSubmit={anular}>
              <div className="field">
                <label>Motivo</label>
                <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: cliente devolvió el pedido" required />
              </div>
              <div className="field">
                <label>Destino de la mercancía</label>
                <select className="select" value={destino} onChange={(e) => setDestino(e.target.value as "STOCK" | "MERMA")}>
                  <option value="STOCK">Regresa al stock (producto devuelto en buen estado)</option>
                  <option value="MERMA">No regresa (merma / pérdida)</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAnularId(null)}>Cancelar</button>
                <button type="submit" className="btn btn-danger">Confirmar anulación</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
