"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { createPortal } from "react-dom";
import Shell from "@/components/Shell";
import { api } from "@/api/client";
import { fecha } from "@/lib/format";
import { comprimirImagen } from "@/lib/images";

type Config = {
  id: string;
  nombre: string;
  rubro: string;
  nit: string | null;
  contacto: string | null;
  logo: string | null;
  membresia: string;
  membresiaHasta: string | null;
  membresiaVencida: boolean;
  config: {
    horaApertura: string | null;
    horaCierre: string | null;
  } | null;
};

const PLAN_NOMBRE: Record<string, string> = {
  MENSUAL: "Mensual",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
  SUSPENDIDO: "Suspendido",
};

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [nit, setNit] = useState("");
  const [contacto, setContacto] = useState("");
  const [horaApertura, setHoraApertura] = useState("");
  const [horaCierre, setHoraCierre] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [guardandoLogo, setGuardandoLogo] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: string } | null>(null);

  const load = () => {
    api<Config>("/config")
      .then((c) => {
        setConfig(c);
        setNit(c.nit ?? "");
        setContacto(c.contacto ?? "");
        setHoraApertura(c.config?.horaApertura ?? "");
        setHoraCierre(c.config?.horaCierre ?? "");
        setLogo(c.logo ?? null);
      })
      .catch((e) => setToast({ msg: e.message, tipo: "error" }));
  };

  useEffect(load, []);

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await comprimirImagen(file, 300, 150);
      setLogo(base64);
    } catch (err: any) {
      setToast({ msg: "Error al procesar la imagen: " + err.message, tipo: "error" });
    }
  };

  const guardarLogo = async (e: FormEvent) => {
    e.preventDefault();
    setGuardandoLogo(true);
    try {
      await api("/config", {
        method: "PUT",
        body: JSON.stringify({ logo }),
      });
      setToast({ msg: "Logo del comercio actualizado con éxito. Recarga la página para ver el cambio en el panel.", tipo: "success" });
      load();
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      setToast({ msg: err.message, tipo: "error" });
    } finally {
      setGuardandoLogo(false);
    }
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/config", {
        method: "PUT",
        body: JSON.stringify({ nit, contacto, horaApertura, horaCierre }),
      });
      setToast({ msg: "Configuración guardada exitosamente.", tipo: "success" });
      load();
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setToast({ msg: (err as Error).message, tipo: "error" });
    }
  };

  const membresiaBadge = (m: string) =>
    m === "ANUAL" ? { t: "Anual", cls: "badge-success" }
      : m === "SEMESTRAL" ? { t: "Semestral", cls: "badge-warn" }
      : m === "MENSUAL" ? { t: "Mensual", cls: "badge-warn" }
      : { t: "Suspendido", cls: "badge-danger" };

  return (
    <Shell>
      <h1 style={{ fontSize: 30 }}>Configuración</h1>
      <p className="muted" style={{ margin: "4px 0 22px" }}>
        Tus datos aparecen en el ticket impreso (facturación con NIT).
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

      {config && (
        <>
          <div className="grid grid-stats" style={{ marginBottom: 22 }}>
            <div className="card stat">
              <div className="label">Comercio</div>
              <div className="value" style={{ fontSize: 22 }}>{config.nombre}</div>
              <div className="hint">{config.rubro}</div>
            </div>
            <div className="card stat">
              <div className="label">Plan / Membresía</div>
              <div style={{ marginTop: 8 }}>
                <span className={`badge ${membresiaBadge(config.membresia).cls}`}>
                  {PLAN_NOMBRE[config.membresia] ?? config.membresia}
                </span>
              </div>
              <div className="hint" style={{ marginTop: 8 }}>
                {config.membresiaHasta ? `Vence: ${fecha(config.membresiaHasta)}` : "Sin fecha de vencimiento"}
                {config.membresiaVencida && <span style={{ color: "var(--red)", fontWeight: 800 }}> · VENCIDA</span>}
              </div>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 840, alignItems: "start" }}>
            <div className="card">
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>Datos para el ticket</h2>
              <form onSubmit={guardar}>
                <div className="field">
                  <label>NIT (opcional)</label>
                  <input
                    className="input"
                    value={nit}
                    onChange={(e) => setNit(e.target.value)}
                    placeholder="Ej: 1025487021"
                  />
                </div>
                <div className="field">
                  <label>Contacto / teléfono</label>
                  <input
                    className="input"
                    value={contacto}
                    onChange={(e) => setContacto(e.target.value)}
                    placeholder="+591 …"
                  />
                </div>
                <button className="btn btn-primary">Guardar Datos</button>
              </form>
            </div>

            <div className="card">
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>Horarios y Cierre Automático</h2>
              <form onSubmit={guardar}>
                <div className="field">
                  <label>Hora de apertura del negocio</label>
                  <input
                    className="input"
                    type="time"
                    value={horaApertura}
                    onChange={(e) => setHoraApertura(e.target.value)}
                  />
                  <small style={{ color: "var(--ink-soft)", fontSize: 12, marginTop: 4, display: "block" }}>
                    Hora en la que habitualmente abres para control referencial.
                  </small>
                </div>
                <div className="field">
                  <label>Hora de cierre automático de caja</label>
                  <input
                    className="input"
                    type="time"
                    value={horaCierre}
                    onChange={(e) => setHoraCierre(e.target.value)}
                  />
                  <small style={{ color: "var(--ink-soft)", fontSize: 12, marginTop: 4, display: "block" }}>
                    Si hay una caja abierta pasada esta hora, el sistema la cerrará automáticamente al día siguiente.
                  </small>
                </div>
                <button className="btn btn-primary">Guardar Horarios</button>
              </form>
            </div>
          </div>

          <div className="card" style={{ marginTop: 20, maxWidth: 840 }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Identidad de Marca (Logo del Comercio)</h2>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Sube el logo de tu restaurante o local. Este se mostrará en la barra lateral. Se recomienda una imagen horizontal o cuadrada (máx. 300x150px).
            </p>
            <form onSubmit={guardarLogo} style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <div style={{ 
                width: 150, 
                height: 80, 
                border: "2px dashed var(--line)", 
                borderRadius: 8, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                background: "var(--surface-2)",
                overflow: "hidden"
              }}>
                {logo ? (
                  <img src={logo} alt="Logo Comercio" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Sin Logo</span>
                )}
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label className="btn btn-ghost" style={{ cursor: "pointer", display: "inline-flex" }}>
                  Seleccionar Imagen
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoChange} />
                </label>
                {logo && (
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    style={{ color: "var(--red)" }} 
                    onClick={() => setLogo(null)}
                  >
                    Eliminar logo
                  </button>
                )}
              </div>

              <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" disabled={guardandoLogo}>
                  {guardandoLogo ? "Guardando..." : "Guardar Logo"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </Shell>
  );
}
