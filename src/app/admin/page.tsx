"use client";

import { useEffect, useState, FormEvent } from "react";
import { createPortal } from "react-dom";
import Shell from "@/components/Shell";
import { api } from "@/api/client";
import { fechaCorta, bs } from "@/lib/format";
import { comprimirImagen } from "@/lib/images";

type Comercio = {
  id: string;
  nombre: string;
  rubro: string;
  contacto: string | null;
  nit: string | null;
  membresia: string;
  membresiaHasta: string | null;
  membresiaVencida: boolean;
  activo: boolean;
  fechaAlta: string;
  usuarios: number;
  productos: number;
  ventas: number;
};

type Plan = {
  clave: string;
  nombre: string;
  meses: number;
  dias: number;
  precioMensual: number;
  descuento: number;
  total: number;
  precioEquivalenteMes: number;
};

type SystemConfig = {
  precioMensual: number;
  precioSemestral: number;
  precioAnual: number;
  qrMensual: string;
  qrSemestral: string;
  qrAnual: string;
};

type Solicitud = {
  id: string;
  comercioId: string;
  comercioNombre: string;
  plan: string;
  monto: number;
  comprobante?: string | null;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  fecha: string;
};

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
};

const VACIO = { nombre: "", rubro: "", contacto: "", plan: "MENSUAL", usuarioNombre: "", usuarioEmail: "", usuarioPassword: "" };
const USER_VACIO = { nombre: "", email: "", password: "", rol: "COMERCIO", activo: true };

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function AdminPage() {
  const [tab, setTab] = useState<"comercios" | "solicitudes" | "configuracion">("comercios");
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [verComprobante, setVerComprobante] = useState<string | null>(null);
  const [sysConfig, setSysConfig] = useState<SystemConfig>({
    precioMensual: 100,
    precioSemestral: 540,
    precioAnual: 960,
    qrMensual: "",
    qrSemestral: "",
    qrAnual: "",
  });

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [pagoModal, setPagoModal] = useState<{ comercio: Comercio; plan: string } | null>(null);
  const [fechaModal, setFechaModal] = useState<{ comercio: Comercio; fecha: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: string } | null>(null);

  // Estados para administración de usuarios de comercios
  const [selectedComercioForUsers, setSelectedComercioForUsers] = useState<Comercio | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState<any>(USER_VACIO);

  const showToast = (msg: string, tipo = "success") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  const load = () => {
    api<Comercio[]>("/admin/comercios").then(setComercios).catch((e) => showToast(e.message, "error"));
    api<Plan[]>("/planes").then(setPlanes).catch(() => {});
    api<SystemConfig>("/admin/config").then(setSysConfig).catch(() => {});
    api<Solicitud[]>("/admin/solicitudes").then(setSolicitudes).catch(() => {});
  };

  useEffect(load, []);

  const planInfo = (clave: string) => planes.find((p) => p.clave === clave);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api<{ nombre: string; comercioId: string; membresia: string }>("/admin/comercios", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const p = planInfo(res.membresia);
      showToast(`Comercio creado: ${res.nombre} — plan ${p?.nombre ?? res.membresia}, vence +${p?.dias ?? 30} días.`);
      setModal(false);
      setForm(VACIO);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const registrarPago = async (e: FormEvent) => {
    e.preventDefault();
    if (!pagoModal) return;
    try {
      const p = planInfo(pagoModal.plan);
      await api(`/admin/comercios/${pagoModal.comercio.id}`, {
        method: "PATCH",
        body: JSON.stringify({ plan: pagoModal.plan }),
      });
      showToast(`Pago registrado: ${pagoModal.comercio.nombre} → plan ${p?.nombre ?? ""} (+${p?.dias ?? 0} días).`);
      setPagoModal(null);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const suspender = async (c: Comercio, suspendido: boolean) => {
    try {
      await api(`/admin/comercios/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ membresia: suspendido ? "SUSPENDIDO" : "MENSUAL" }),
      });
      showToast(`${c.nombre} → ${suspendido ? "suspendido" : "reactivado"}`);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const ajustarFecha = async (e: FormEvent) => {
    e.preventDefault();
    if (!fechaModal) return;
    try {
      await api(`/admin/comercios/${fechaModal.comercio.id}`, {
        method: "PATCH",
        body: JSON.stringify({ membresiaHasta: fechaModal.fecha || null }),
      });
      showToast(`${fechaModal.comercio.nombre}: fecha de membresía ajustada.`);
      setFechaModal(null);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const procesarSolicitud = async (id: string, accion: "APROBAR" | "RECHAZAR") => {
    try {
      await api<{ status: string; solicitud: Solicitud }>(`/admin/solicitudes/${id}/procesar`, {
        method: "POST",
        body: JSON.stringify({ accion }),
      });
      showToast(`Solicitud ${accion === "APROBAR" ? "aprobada" : "rechazada"} exitosamente.`);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const guardarSystemConfig = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/admin/config", {
        method: "PUT",
        body: JSON.stringify(sysConfig),
      });
      showToast("Configuración y precios del sistema actualizados.");
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  // Métodos de ABM de Usuarios del Comercio
  const verUsuarios = (comercio: Comercio) => {
    setSelectedComercioForUsers(comercio);
    setLoadingUsers(true);
    api<Usuario[]>(`/admin/comercios/${comercio.id}/usuarios`)
      .then(setUsuarios)
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoadingUsers(false));
  };

  const guardarUsuario = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedComercioForUsers) return;
    try {
      const isNew = !userForm.id;
      const url = isNew
        ? `/admin/comercios/${selectedComercioForUsers.id}/usuarios`
        : `/admin/comercios/${selectedComercioForUsers.id}/usuarios/${userForm.id}`;
      const method = isNew ? "POST" : "PATCH";

      await api(url, {
        method,
        body: JSON.stringify({
          nombre: userForm.nombre,
          email: userForm.email,
          rol: userForm.rol,
          activo: userForm.activo,
          ...(userForm.password ? { password: userForm.password } : {}),
        }),
      });

      showToast(isNew ? "Usuario creado correctamente" : "Usuario modificado correctamente");
      setUserModal(false);
      setUserForm(USER_VACIO);
      verUsuarios(selectedComercioForUsers);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const eliminarUsuario = async (userId: string) => {
    if (!selectedComercioForUsers) return;
    if (!confirm("¿Estás seguro de que deseas eliminar este usuario?")) return;
    try {
      await api(`/admin/comercios/${selectedComercioForUsers.id}/usuarios/${userId}`, {
        method: "DELETE",
      });
      showToast("Usuario eliminado");
      verUsuarios(selectedComercioForUsers);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const planBadge = (c: Comercio) => {
    if (c.membresiaVencida) return { t: "Vencida", cls: "badge-danger" };
    if (c.membresia === "SUSPENDIDO") return { t: "Suspendido", cls: "badge-danger" };
    const p = planInfo(c.membresia);
    return { t: p?.nombre ?? c.membresia, cls: c.membresia === "ANUAL" ? "badge-success" : "badge-warn" };
  };

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 30 }}>Control Central</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Gobierno del SaaS: control de comercios, activación manual de pagos y gestión de cuentas.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar comercio</button>
      </div>

      <div className="tabs" style={{ display: "flex", gap: 10, borderBottom: "1px solid var(--line)", marginBottom: 20 }}>
        <button
          className={`btn ${tab === "comercios" ? "btn-primary" : "btn-ghost"}`}
          style={{ padding: "8px 16px", borderRadius: "8px 8px 0 0" }}
          onClick={() => setTab("comercios")}
        >
          Comercios
        </button>
        <button
          className={`btn ${tab === "solicitudes" ? "btn-primary" : "btn-ghost"}`}
          style={{ padding: "8px 16px", borderRadius: "8px 8px 0 0" }}
          onClick={() => setTab("solicitudes")}
        >
          Solicitudes de Pago ({solicitudes.filter((s) => s.estado === "PENDIENTE").length})
        </button>
        <button
          className={`btn ${tab === "configuracion" ? "btn-primary" : "btn-ghost"}`}
          style={{ padding: "8px 16px", borderRadius: "8px 8px 0 0" }}
          onClick={() => setTab("configuracion")}
        >
          Precios y Códigos QR
        </button>
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

      {/* VISTA 1: COMERCIOS */}
      {tab === "comercios" && (
        <div style={{ marginTop: 12 }}>
          {comercios.length === 0 ? (
            <div className="empty">Aún no hay comercios registrados.</div>
          ) : (
            <div className="card" style={{ padding: 8 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Comercio</th>
                    <th>Contacto</th>
                    <th>Plan</th>
                    <th>Vence</th>
                    <th>Actividad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {comercios.map((c) => {
                    const b = planBadge(c);
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                            {c.rubro}
                            {c.nit ? ` · NIT ${c.nit}` : ""}
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{c.contacto || "—"}</td>
                        <td><span className={`badge ${b.cls}`}>{b.t}</span></td>
                        <td className="tabular" style={{ fontSize: 13 }}>
                          {c.membresiaHasta ? fechaCorta(c.membresiaHasta) : "—"}
                        </td>
                        <td style={{ fontSize: 13 }}>{c.usuarios} usu. · {c.productos} prod. · {c.ventas} ventas</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: "5px 9px", fontSize: 11, marginRight: 5, background: "var(--neon)", color: "#000" }}
                            onClick={() => verUsuarios(c)}
                          >
                            👥 Usuarios
                          </button>
                          <button className="btn btn-ghost" style={{ padding: "5px 9px", fontSize: 11, marginRight: 5 }} onClick={() => setPagoModal({ comercio: c, plan: c.membresia === "SUSPENDIDO" ? "MENSUAL" : c.membresia })}>
                            Registrar pago
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "5px 9px", fontSize: 11, marginRight: 5 }}
                            onClick={() => setFechaModal({ comercio: c, fecha: c.membresiaHasta ? new Date(c.membresiaHasta).toISOString().slice(0, 16) : "" })}
                          >
                            Ajustar fecha
                          </button>
                          {c.membresia !== "SUSPENDIDO" ? (
                            <button className="btn btn-danger" style={{ padding: "5px 9px", fontSize: 11 }} onClick={() => suspender(c, true)}>
                              Suspender
                            </button>
                          ) : (
                            <button className="btn btn-olive" style={{ padding: "5px 9px", fontSize: 11 }} onClick={() => suspender(c, false)}>
                              Reactivar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: SOLICITUDES DE PAGO */}
      {tab === "solicitudes" && (
        <div style={{ marginTop: 12 }}>
          {solicitudes.length === 0 ? (
            <div className="empty">No hay solicitudes de renovación registradas.</div>
          ) : (
            <div className="card" style={{ padding: 8 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Comercio</th>
                    <th>Plan</th>
                    <th>Monto</th>
                    <th>Comprobante</th>
                    <th>Fecha Solicitud</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map((s) => (
                    <tr key={s.id}>
                      <td><span style={{ fontWeight: 700 }}>{s.comercioNombre}</span></td>
                      <td><b>{s.plan === "MENSUAL" ? "Mensual" : s.plan === "SEMESTRAL" ? "Semestral" : "Anual"}</b></td>
                      <td className="tabular">{bs(s.monto)}</td>
                      <td>
                        {s.comprobante ? (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "4px 8px", fontSize: 11, border: "1px dashed var(--neon)", color: "var(--neon)" }}
                            onClick={() => setVerComprobante(s.comprobante || null)}
                          >
                            👁 Ver Comprobante
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>Sin comprobante</span>
                        )}
                      </td>
                      <td className="tabular" style={{ fontSize: 13 }}>{new Date(s.fecha).toLocaleString("es-BO")}</td>
                      <td>
                        <span className={`badge ${s.estado === "APROBADA" ? "badge-success" : s.estado === "RECHAZADA" ? "badge-danger" : "badge-warn"}`}>
                          {s.estado}
                        </span>
                      </td>
                      <td>
                        {s.estado === "PENDIENTE" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn btn-olive"
                              style={{ padding: "5px 10px", fontSize: 11 }}
                              onClick={() => procesarSolicitud(s.id, "APROBAR")}
                            >
                              ✓ Aprobar
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: "5px 10px", fontSize: 11 }}
                              onClick={() => procesarSolicitud(s.id, "RECHAZAR")}
                            >
                              ✗ Rechazar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VISTA 3: PRECIOS Y CÓDIGOS QR */}
      {tab === "configuracion" && (
        <div style={{ marginTop: 12, maxWidth: 760 }}>
          <div className="card">
            <h2 style={{ fontSize: 20, marginBottom: 20 }}>Precios y Códigos QR del Sistema</h2>
            <form onSubmit={guardarSystemConfig}>
              {([
                { key: "Mensual" as const, precio: sysConfig.precioMensual, qr: sysConfig.qrMensual },
                { key: "Semestral" as const, precio: sysConfig.precioSemestral, qr: sysConfig.qrSemestral },
                { key: "Anual" as const, precio: sysConfig.precioAnual, qr: sysConfig.qrAnual },
              ]).map((plan) => (
                <div
                  key={plan.key}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                    background: "var(--surface-2)",
                  }}
                >
                  <h3 style={{ fontSize: 15, marginBottom: 14 }}>Plan {plan.key}</h3>
                  <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {/* Preview del QR */}
                    <div
                      style={{
                        width: 140,
                        height: 140,
                        borderRadius: 10,
                        background: "#fff",
                        border: "2px dashed var(--line)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {plan.qr ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={plan.qr}
                          alt={`QR ${plan.key}`}
                          style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: "#999", textAlign: "center", padding: 10 }}>
                          Sin imagen QR
                        </span>
                      )}
                    </div>

                    {/* Controles */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div className="field" style={{ marginBottom: 10 }}>
                        <label>Precio del Plan (Bs)</label>
                        <input
                          type="number"
                          className="input tabular"
                          value={plan.precio}
                          onChange={(e) => {
                            const k = `precio${plan.key}` as keyof SystemConfig;
                            setSysConfig({ ...sysConfig, [k]: Number(e.target.value) });
                          }}
                          required
                        />
                      </div>

                      <div className="field" style={{ marginBottom: 10 }}>
                        <label>Imagen QR de pago</label>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <label
                            className="btn btn-ghost"
                            style={{
                              padding: "7px 14px",
                              fontSize: 12,
                              cursor: "pointer",
                              border: "1px dashed var(--neon)",
                              color: "var(--neon)",
                            }}
                          >
                            📷 {plan.qr ? "Cambiar imagen" : "Subir imagen"}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const b64 = await comprimirImagen(file, 400, 400);
                                  const k = `qr${plan.key}` as keyof SystemConfig;
                                  setSysConfig({ ...sysConfig, [k]: b64 });
                                } catch (err: any) {
                                  showToast("Error al procesar la imagen: " + err.message, "error");
                                }
                              }}
                            />
                          </label>
                          {plan.qr && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ padding: "7px 14px", fontSize: 12 }}
                              onClick={() => {
                                const k = `qr${plan.key}` as keyof SystemConfig;
                                setSysConfig({ ...sysConfig, [k]: "" });
                              }}
                            >
                              ✕ Quitar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button className="btn btn-primary" type="submit" style={{ marginTop: 4 }}>
                Guardar Configuración Global
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTRAR COMERCIO */}
      {modal && createPortal(
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <h2 style={{ fontSize: 22, marginBottom: 4 }}>Registrar nuevo comercio</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
              El sistema generará su entorno limpio e independiente + cuenta del usuario del comercio.
            </p>
            <form onSubmit={crear}>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>Nombre del comercio</label>
                  <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>Rubro</label>
                  <input className="input" value={form.rubro} onChange={(e) => setForm({ ...form, rubro: e.target.value })} required />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Contacto</label>
                <input className="input" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Plan pagado</label>
                <select className="select" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                  {planes.map((p) => (
                    <option key={p.clave} value={p.clave}>
                      {p.nombre} — Bs {p.total} ({p.meses} {p.meses === 1 ? "mes" : "meses"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>Usuario — nombre</label>
                  <input className="input" value={form.usuarioNombre} onChange={(e) => setForm({ ...form, usuarioNombre: e.target.value })} required />
                </div>
                <div className="field" style={{ marginBottom: 8 }}>
                  <label>Usuario — email</label>
                  <input className="input" type="email" value={form.usuarioEmail} onChange={(e) => setForm({ ...form, usuarioEmail: e.target.value })} required />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Usuario — contraseña inicial</label>
                <input className="input" type="text" value={form.usuarioPassword} onChange={(e) => setForm({ ...form, usuarioPassword: e.target.value })} required />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear comercio</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: REGISTRAR PAGO DIRECTO */}
      {pagoModal && createPortal(
        <div className="modal-backdrop" onClick={() => setPagoModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Registrar pago de membresía</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
              {pagoModal.comercio.nombre} — el pago suma los días del plan elegido al vencimiento vigente.
            </p>
            <form onSubmit={registrarPago}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Plan pagado</label>
                <select className="select" value={pagoModal.plan} onChange={(e) => setPagoModal({ ...pagoModal, plan: e.target.value })}>
                  {planes.map((p) => (
                    <option key={p.clave} value={p.clave}>
                      {p.nombre} — Bs {p.total} (+{p.dias} días)
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setPagoModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar pago</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: AJUSTAR FECHA */}
      {fechaModal && createPortal(
        <div className="modal-backdrop" onClick={() => setFechaModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Ajustar membresía</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
              {fechaModal.comercio.nombre} — modifica la fecha y hora de vencimiento a tu libertad.
            </p>
            <form onSubmit={ajustarFecha}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Vence el (fecha y hora)</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={fechaModal.fecha}
                  onChange={(e) => setFechaModal({ ...fechaModal, fecha: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setFechaModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar fecha</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 4: GESTIÓN DE USUARIOS DE UN COMERCIO */}
      {selectedComercioForUsers && createPortal(
        <div className="modal-backdrop" onClick={() => setSelectedComercioForUsers(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: "95vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 20 }}>Usuarios — {selectedComercioForUsers.nombre}</h2>
              <button
                className="btn btn-primary"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => {
                  setUserForm(USER_VACIO);
                  setUserModal(true);
                }}
              >
                + Nuevo Usuario
              </button>
            </div>

            {loadingUsers ? (
              <div className="empty" style={{ padding: 40 }}>Cargando usuarios...</div>
            ) : usuarios.length === 0 ? (
              <div className="empty" style={{ padding: 40 }}>Este comercio no tiene usuarios registrados.</div>
            ) : (
              <div style={{ overflowX: "auto", marginBottom: 14, WebkitOverflowScrolling: "touch" }}>
                {usuarios.map((u) => (
                  <div
                    key={u.id}
                    className="card"
                    style={{
                      marginBottom: 10,
                      padding: "12px 16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{u.nombre}</div>
                        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 4 }}>{u.email}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className="badge badge-success" style={{ fontSize: 11 }}>{u.rol}</span>
                        <span className={`badge ${u.activo ? "badge-success" : "badge-danger"}`} style={{ fontSize: 11 }}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: 11 }}
                          onClick={() => {
                            setUserForm({
                              id: u.id,
                              nombre: u.nombre,
                              email: u.email,
                              password: "",
                              rol: u.rol,
                              activo: u.activo,
                            });
                            setUserModal(true);
                          }}
                        >
                          ✎ Editar
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: "4px 10px", fontSize: 11 }}
                          onClick={() => eliminarUsuario(u.id)}
                          disabled={usuarios.length <= 1}
                        >
                          ✕ Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setSelectedComercioForUsers(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 5: CREAR / EDITAR USUARIO INDIVIDUAL */}
      {userModal && createPortal(
        <div className="modal-backdrop" onClick={() => setUserModal(false)} style={{ zIndex: 100000 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>
              {userForm.id ? "Modificar Usuario" : "Crear Nuevo Usuario"}
            </h2>
            <form onSubmit={guardarUsuario}>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Nombre Completo</label>
                <input
                  className="input"
                  value={userForm.nombre}
                  onChange={(e) => setUserForm({ ...userForm, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Correo Electrónico (Login)</label>
                <input
                  className="input"
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>
                  Contraseña {userForm.id ? "(dejar en blanco para no modificar)" : ""}
                </label>
                <input
                  className="input"
                  type="text"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  required={!userForm.id}
                  placeholder={userForm.id ? "Ej: nuevaClave123" : "Ej: ClaveSegura987"}
                />
              </div>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div className="field">
                  <label>Rol</label>
                  <select
                    className="select"
                    value={userForm.rol}
                    onChange={(e) => setUserForm({ ...userForm, rol: e.target.value })}
                  >
                    <option value="COMERCIO">COMERCIO</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
                <div className="field">
                  <label>Estado</label>
                  <select
                    className="select"
                    value={userForm.activo ? "true" : "false"}
                    onChange={(e) => setUserForm({ ...userForm, activo: e.target.value === "true" })}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setUserModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {userForm.id ? "Guardar Cambios" : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal para visualizar comprobante de pago */}
      {verComprobante && createPortal(
        <div className="modal-backdrop" onClick={() => setVerComprobante(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, textAlign: "center" }}>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>Comprobante de Pago</h2>
            <div style={{ background: "#fff", padding: 8, borderRadius: 10, marginBottom: 16 }}>
              <img 
                src={verComprobante} 
                alt="Comprobante" 
                style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }} 
              />
            </div>
            <button className="btn btn-primary" onClick={() => setVerComprobante(null)}>
              Cerrar
            </button>
          </div>
        </div>,
        document.body
      )}
    </Shell>
  );
}
