import { useEffect, useState, ReactNode, FormEvent, ChangeEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { getToken, getRol, logout, api } from "@/api/client";
import { comprimirImagen } from "@/lib/images";

const NAV_COMERCIO = [
  { href: "/dashboard", label: "Panel", ico: "◈" },
  { href: "/ventas", label: "Punto de Venta", ico: "▥" },
  { href: "/inventario", label: "Inventario", ico: "☰" },
  { href: "/clientes", label: "Clientes", ico: "♟" },
  { href: "/caja", label: "Caja y Arqueo", ico: "◉" },
  { href: "/reportes", label: "Reportes", ico: "≡" },
  { href: "/configuracion", label: "Configuración", ico: "⚙" },
];

const NAV_ADMIN = [
  { href: "/dashboard", label: "Panel", ico: "◈" },
  { href: "/admin", label: "Comercios", ico: "⌂" },
];

type Config = {
  membresiaVencida: boolean;
  membresiaHasta: string | null;
  membresia: string;
};

type Plan = {
  clave: string;
  nombre: string;
  meses: number;
  dias: number;
  total: number;
  qrCode: string;
};

function obtenerIniciales(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

export default function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<string | null>(null);
  const [vencida, setVencida] = useState(false);
  const [vencioEl, setVencioEl] = useState("");

  // Estados de logo corporativo y avatar de usuario
  const [avatar, setAvatar] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);

  // Estados para modal de edición de perfil
  const [abrirPerfil, setAbrirPerfil] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [email, setEmail] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Estados para renovaciones y pagos
  const [abrirPago, setAbrirPago] = useState(false);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [planSeleccionado, setPlanSeleccionado] = useState<Plan | null>(null);
  const [solicitudPendiente, setSolicitudPendiente] = useState<any>(null);
  const [loadingPlanes, setLoadingPlanes] = useState(false);

  // Estados para comprobante de pago
  const [comprobante, setComprobante] = useState<string | null>(null);
  const [procesandoComprobante, setProcesandoComprobante] = useState(false);

  // Estado para notificaciones Toast
  const [toast, setToast] = useState<{ msg: string; tipo: "success" | "error" } | null>(null);
  const showToast = (msg: string, tipo: "success" | "error" = "success") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSolicitudActual = () => {
    if (getRol() !== "SUPER_ADMIN") {
      api<any>("/planes/solicitud-actual")
        .then((sol) => setSolicitudPendiente(sol))
        .catch(() => {});
    }
  };

  useEffect(() => {
    setMounted(true);
    if (!getToken()) {
      navigate("/login", { replace: true });
      return;
    }
    setRol(getRol());
    
    // Obtener datos del perfil actualizados
    api<any>("/auth/me")
      .then((data) => {
        setNombre(data.nombre);
        setAvatar(data.avatar);
        setEmail(data.email || "");
        if (data.comercio?.logo) {
          setLogo(data.comercio.logo);
        }
        localStorage.setItem("rs_nombre", data.nombre);
      })
      .catch((e) => console.error("Error al cargar perfil", e));

    if (getRol() !== "SUPER_ADMIN") {
      api<Config>("/config")
        .then((c) => {
          setVencida(c.membresiaVencida);
          if (c.membresiaHasta) {
            setVencioEl(
              new Date(c.membresiaHasta).toLocaleDateString("es-BO", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            );
          }
        })
        .catch(() => {});

      fetchSolicitudActual();
    }
  }, [navigate]);

  const handleOpenPago = () => {
    setLoadingPlanes(true);
    api<Plan[]>("/planes")
      .then((data) => {
        setPlanes(data);
        if (data.length > 0) {
          // Mantener la selección previa si existe
          setPlanSeleccionado(data[0]);
        }
        setAbrirPago(true);
      })
      .catch((e) => showToast(e.message, "error"))
      .finally(() => setLoadingPlanes(false));
  };

  const handleComprobanteChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcesandoComprobante(true);
    try {
      const base64 = await comprimirImagen(file, 600, 600);
      setComprobante(base64);
    } catch (err: any) {
      showToast("Error al procesar el comprobante: " + err.message, "error");
    } finally {
      setProcesandoComprobante(false);
    }
  };

  const handlePagar = async () => {
    if (!planSeleccionado) return;
    if (!comprobante) {
      showToast("Debes subir tu comprobante de pago antes de enviar la solicitud.", "error");
      return;
    }
    try {
      const res = await api<{ status: string; message: string; solicitud: any }>("/planes/pagar", {
        method: "POST",
        body: JSON.stringify({ plan: planSeleccionado.clave, comprobante }),
      });
      setSolicitudPendiente(res.solicitud);
      setAbrirPago(false);
      setComprobante(null); // Resetear
      showToast(res.message, "success");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await comprimirImagen(file, 150, 150);
      setEditAvatar(base64);
    } catch (err: any) {
      showToast("Error al procesar la imagen: " + err.message, "error");
    }
  };

  const handleGuardarPerfil = async (e: FormEvent) => {
    e.preventDefault();
    if (!editNombre.trim()) {
      showToast("El nombre de usuario no puede estar vacío", "error");
      return;
    }
    if (!editEmail.trim() || !editEmail.includes("@")) {
      showToast("El correo electrónico no es válido", "error");
      return;
    }
    setGuardandoPerfil(true);
    try {
      const res = await api<any>("/auth/perfil", {
        method: "PUT",
        body: JSON.stringify({
          nombre: editNombre,
          email: editEmail,
          avatar: editAvatar,
          password: editPassword || undefined,
        }),
      });
      setNombre(res.nombre);
      setEmail(res.email);
      setAvatar(res.avatar);
      localStorage.setItem("rs_nombre", res.nombre);
      setAbrirPerfil(false);
      showToast("Perfil actualizado exitosamente", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setGuardandoPerfil(false);
    }
  };

  if (!mounted || !getToken()) return null;

  const isAdmin = rol === "SUPER_ADMIN";
  const nav = isAdmin ? NAV_ADMIN : NAV_COMERCIO;

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          {logo ? (
            <div className="logo-comercio-container">
              <img src={logo} alt="Logo" className="logo-comercio" />
            </div>
          ) : (
            <div className="logo">R</div>
          )}
          <div>
            <div className="brand-name">RestoStock</div>
            <div className="brand-sub">La Paz · Bolivia</div>
          </div>
        </div>

        <nav className="nav" style={{ flex: 1, marginTop: 24 }}>
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                to={n.href}
                className={`nav-item ${active ? "active" : ""}`}
              >
                <span className="ico" style={{ marginRight: 10 }}>{n.ico}</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div 
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            onClick={() => {
              setEditNombre(nombre);
              setEditEmail(email);
              setEditPassword("");
              setEditAvatar(avatar);
              setAbrirPerfil(true);
            }}
            title="Editar Perfil"
            className="profile-trigger"
          >
            {avatar ? (
              <img src={avatar} alt="Avatar" className="user-avatar" />
            ) : (
              <div className="user-avatar-initials">
                {obtenerIniciales(nombre)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="uname" style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{nombre}</div>
              <div className="urol">{isAdmin ? "Super Admin" : "Comercio"}</div>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} onClick={logout}>
            Salir
          </button>
        </div>
      </aside>
      <main className="main">
        {solicitudPendiente ? (
          <div className="alert-strip-floating success">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>
              Tu solicitud de renovación (Plan <b>{solicitudPendiente.plan === "MENSUAL" ? "Mensual" : solicitudPendiente.plan === "SEMESTRAL" ? "Semestral" : "Anual"}</b>) con comprobante adjunto está en revisión por el Administrador.
            </span>
          </div>
        ) : (
          vencida && (
            <div className="alert-strip-floating error">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: 10 }}>
                <span>
                  Tu membresía venció el <b>{vencioEl}</b>. Renueva tu plan para seguir operando.
                </span>
                <button
                  className="btn btn-primary"
                  style={{ padding: "6px 14px", fontSize: 12.5, background: "var(--red)", border: "none" }}
                  onClick={handleOpenPago}
                  disabled={loadingPlanes}
                >
                  {loadingPlanes ? "Cargando..." : "Pagar / Renovar Plan"}
                </button>
              </div>
            </div>
          )
        )}
        <div className="liquid">{children}</div>
      </main>

      {/* Modal responsivo de pago de membresía por QR */}
      {abrirPago && createPortal(
        <div className="modal-backdrop" onClick={() => setAbrirPago(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h2 style={{ fontSize: 22, marginBottom: 8 }}>Renovar Plan de Membresía</h2>
            <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 18 }}>
              Elige tu plan y realiza la transferencia mediante el código QR correspondiente.
            </p>

            <div className="field" style={{ marginBottom: 18 }}>
              <label>Selecciona un Plan</label>
              <select
                className="select"
                value={planSeleccionado?.clave || ""}
                onChange={(e) => {
                  const p = planes.find((x) => x.clave === e.target.value);
                  if (p) setPlanSeleccionado(p);
                }}
              >
                {planes.map((p) => (
                  <option key={p.clave} value={p.clave}>
                    {p.nombre} — Bs {p.total} ({p.dias} días)
                  </option>
                ))}
              </select>
            </div>

            {planSeleccionado && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", background: "var(--surface-2)", borderRadius: 12, marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--neon)" }}>
                  Monto a Transferir: Bs {planSeleccionado.total}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={planSeleccionado.qrCode}
                  alt={`QR Pago Plan ${planSeleccionado.nombre}`}
                  style={{ width: 220, height: 220, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 8 }}
                />
              </div>
            )}

            <div className="field" style={{ marginBottom: 18 }}>
              <label>Subir Comprobante de Pago (Transferencia / QR)</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                <label className="btn btn-ghost" style={{ cursor: "pointer", fontSize: 12.5, border: "1px dashed var(--neon)", color: "var(--neon)" }}>
                  📷 Seleccionar Comprobante
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleComprobanteChange} />
                </label>
                {procesandoComprobante && <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Procesando...</span>}
              </div>
              {comprobante && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                  <img 
                    src={comprobante} 
                    alt="Vista previa comprobante" 
                    style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }} 
                  />
                  <span style={{ fontSize: 12, color: "var(--neon)" }}>✓ Comprobante cargado correctamente</span>
                </div>
              )}
            </div>

            <div className="hint" style={{ marginBottom: 20, fontSize: 12, lineHeight: 1.45, color: "var(--ink-soft)" }}>
              ⚠️ Escanea el código QR, realiza la transferencia y sube la captura de tu comprobante. El Administrador verificará los datos para habilitar tu cuenta manualmente.
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => { setAbrirPago(false); setComprobante(null); }}>
                Cerrar
              </button>
              <button className="btn btn-primary" onClick={handlePagar} disabled={!planSeleccionado || !comprobante || procesandoComprobante}>
                Ya realicé el pago
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de perfil de usuario */}
      {abrirPerfil && createPortal(
        <div className="modal-backdrop" onClick={() => setAbrirPerfil(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: 22, marginBottom: 8 }}>Editar Perfil</h2>
            <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 18 }}>
              Actualiza tus datos de acceso y tu foto de perfil.
            </p>

            <form onSubmit={handleGuardarPerfil}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ position: "relative", width: 90, height: 90 }}>
                  {editAvatar ? (
                    <img 
                      src={editAvatar} 
                      alt="Previsualizar Avatar" 
                      style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--neon)" }} 
                    />
                  ) : (
                    <div style={{ 
                      width: "100%", 
                      height: "100%", 
                      borderRadius: "50%", 
                      background: "linear-gradient(135deg, var(--surface-3), var(--surface-2))", 
                      color: "var(--neon)", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      fontSize: 32, 
                      fontWeight: "bold",
                      border: "2px dashed var(--line)"
                    }}>
                      {obtenerIniciales(editNombre)}
                    </div>
                  )}
                  <label 
                    htmlFor="avatar-upload" 
                    style={{ 
                      position: "absolute", 
                      bottom: 0, 
                      right: 0, 
                      background: "var(--neon)", 
                      color: "#000", 
                      borderRadius: "50%", 
                      width: 28, 
                      height: 28, 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: "bold",
                      border: "2px solid var(--surface-1)"
                    }}
                    title="Subir foto"
                  >
                    ✎
                  </label>
                  <input 
                    id="avatar-upload" 
                    type="file" 
                    accept="image/*" 
                    style={{ display: "none" }} 
                    onChange={handleAvatarChange}
                  />
                </div>
                {editAvatar && (
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    style={{ fontSize: 12, padding: "2px 8px", color: "var(--red)" }}
                    onClick={() => setEditAvatar(null)}
                  >
                    Eliminar foto
                  </button>
                )}
              </div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label>Nombre</label>
                <input
                  className="input"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label>Correo Electrónico (Login)</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="correo@ejemplo.bo"
                />
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <label>Nueva contraseña (opcional)</label>
                <input
                  className="input"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Dejar en blanco para mantener actual"
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAbrirPerfil(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardandoPerfil}>
                  {guardandoPerfil ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Notificación Toast Global */}
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
    </>
  );
}
