"use client";

import { useEffect, useState, FormEvent } from "react";
import { createPortal } from "react-dom";
import Shell from "@/components/Shell";
import { api } from "@/api/client";
import { fechaCorta } from "@/lib/format";

type Cliente = {
  id: string;
  nombre: string;
  carnet: string;
  telefono: string | null;
  createdAt: string;
  ventas: number;
};

const VACIO = { nombre: "", carnet: "", telefono: "" };

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(VACIO);
  const [toast, setToast] = useState<{ msg: string; tipo: string } | null>(null);

  const showToast = (msg: string, tipo = "success") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const load = () => {
    api<Cliente[]>(`/clientes${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      .then(setClientes)
      .catch((e) => showToast(e.message, "error"));
  };

  useEffect(load, [q]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(VACIO);
    setModal(true);
  };

  const abrirEditar = (c: Cliente) => {
    setEditando(c);
    setForm({ nombre: c.nombre, carnet: c.carnet, telefono: c.telefono ?? "" });
    setModal(true);
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editando) {
        await api(`/clientes/${editando.id}`, { method: "PUT", body: JSON.stringify(form) });
        showToast(`Cliente actualizado: ${form.nombre}`);
      } else {
        await api("/clientes", { method: "POST", body: JSON.stringify(form) });
        showToast(`Cliente registrado: ${form.nombre}`);
      }
      setModal(false);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const eliminar = async (c: Cliente) => {
    if (!confirm(`¿Eliminar a "${c.nombre}"? Sus ventas históricas se conservan.`)) return;
    try {
      await api(`/clientes/${c.id}`, { method: "DELETE" });
      showToast(`Cliente eliminado: ${c.nombre}`);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 30 }}>Clientes</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Registra a tus clientes con nombre y carnet para la facturación del ticket.
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo cliente</button>
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

      <div style={{ marginTop: 20 }}>
        <div className="field" style={{ maxWidth: 380 }}>
          <label>Buscar por nombre o carnet</label>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej: María o 5834123" />
        </div>

        {clientes.length === 0 ? (
          <div className="empty">No hay clientes {q ? "con esa búsqueda" : "registrados"}.</div>
        ) : (
          <div className="card" style={{ padding: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Carnet</th>
                  <th>Teléfono</th>
                  <th>Registrado</th>
                  <th style={{ textAlign: "right" }}>Ventas</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.nombre}</td>
                    <td className="tabular">{c.carnet}</td>
                    <td className="muted" style={{ fontSize: 13 }}>{c.telefono || "—"}</td>
                    <td className="tabular muted" style={{ fontSize: 13 }}>{fechaCorta(c.createdAt)}</td>
                    <td className="tabular" style={{ textAlign: "right" }}>{c.ventas}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12, marginRight: 6 }} onClick={() => abrirEditar(c)}>
                        Editar
                      </button>
                      <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => eliminar(c)}>
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

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 22, marginBottom: 18 }}>{editando ? "Editar cliente" : "Registrar cliente"}</h2>
            <form onSubmit={guardar}>
              <div className="field">
                <label>Nombre completo</label>
                <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </div>
              <div className="field">
                <label>Carnet de identidad</label>
                <input className="input" value={form.carnet} onChange={(e) => setForm({ ...form, carnet: e.target.value })} placeholder="Ej: 5834123" required />
              </div>
              <div className="field">
                <label>Teléfono (opcional)</label>
                <input className="input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="+591 …" />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editando ? "Guardar cambios" : "Registrar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}
