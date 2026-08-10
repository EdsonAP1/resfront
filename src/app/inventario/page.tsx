"use client";

import { useEffect, useState, FormEvent } from "react";
import { createPortal } from "react-dom";
import Shell from "@/components/Shell";
import { api } from "@/api/client";
import { bs } from "@/lib/format";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  tipoStock: "FINITO" | "INFINITO";
  stock: number | null;
  permiteFracciones: boolean;
  limiteMinimo: number | null;
  bajoMinimo: boolean;
};

type FormProducto = {
  nombre: string;
  descripcion: string;
  precio: string;
  tipoStock: "FINITO" | "INFINITO";
  stock: string;
  permiteFracciones: boolean;
  limiteMinimo: string;
};

const VACIO: FormProducto = {
  nombre: "",
  descripcion: "",
  precio: "",
  tipoStock: "FINITO",
  stock: "",
  permiteFracciones: false,
  limiteMinimo: "",
};

export default function InventarioPage() {
  const [items, setItems] = useState<Producto[]>([]);
  const [mounted, setMounted] = useState(false);
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [form, setForm] = useState(VACIO);
  const [toast, setToast] = useState<{ msg: string; tipo: string } | null>(null);

  const showToast = (msg: string, tipo = "success") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const load = () => {
    api<Producto[]>(`/productos${soloAlertas ? "?alertas=true" : ""}`)
      .then(setItems)
      .catch((e) => showToast(e.message, "error"));
  };

  useEffect(() => {
    setMounted(true);
    load();
  }, [soloAlertas]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(VACIO);
    setModal(true);
  };

  const abrirEditar = (p: Producto) => {
    setEditando(p);
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion ?? "",
      precio: String(p.precio),
      tipoStock: p.tipoStock,
      stock: p.stock === null ? "" : String(p.stock),
      permiteFracciones: p.permiteFracciones,
      limiteMinimo: p.limiteMinimo === null ? "" : String(p.limiteMinimo),
    });
    setModal(true);
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio: Number(form.precio),
      tipoStock: "INFINITO",
      permiteFracciones: false,
      limiteMinimo: null,
      stock: null,
    };
    try {
      if (editando) {
        await api(`/productos/${editando.id}`, { method: "PUT", body: JSON.stringify(body) });
        showToast(`Producto actualizado: ${form.nombre}`);
      } else {
        await api("/productos", { method: "POST", body: JSON.stringify(body) });
        showToast(`Producto creado: ${form.nombre}`);
      }
      setModal(false);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const eliminar = async (p: Producto) => {
    if (!confirm(`¿Desactivar "${p.nombre}"? No se borra del historial.`)) return;
    try {
      await api(`/productos/${p.id}`, { method: "DELETE" });
      showToast(`Producto desactivado: ${p.nombre}`);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32 }}>Inventario</h1>
          <p style={{ color: "var(--ink-soft)", margin: "4px 0 0" }}>Catálogo de productos y precios.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo producto</button>
        </div>
      </div>

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

      <div style={{ marginTop: 22 }}>
        {items.length === 0 ? (
          <div className="empty">No hay productos {soloAlertas ? "en alerta" : ""}.</div>
        ) : (
          <div className="card" style={{ padding: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ textAlign: "right" }}>Precio</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                      {p.descripcion && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{p.descripcion}</div>}
                    </td>
                    <td className="tabular" style={{ textAlign: "right", fontWeight: 700 }}>
                      {p.precio === 0 ? "Gratis" : bs(p.precio)}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12, marginRight: 6 }} onClick={() => abrirEditar(p)}>
                        Editar
                      </button>
                      <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => eliminar(p)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && mounted && typeof window !== "undefined" && createPortal(
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 24, marginBottom: 18 }}>{editando ? "Editar producto" : "Nuevo producto"}</h2>
            <form onSubmit={guardar}>
              <div className="field">
                <label>Nombre</label>
                <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </div>
              <div className="field">
                <label>Descripción</label>
                <input className="input" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </div>
              <div className="field">
                <label>Precio (Bs)</label>
                <input className="input" type="number" step="0.01" min="0" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editando ? "Guardar cambios" : "Crear producto"}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </Shell>
  );
}
