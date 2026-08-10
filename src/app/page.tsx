import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LiquidBg from "@/components/LiquidBg";
import Tilt from "@/components/Tilt";
import { api } from "@/api/client";

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

const FEATURES = [
  {
    ico: "☰",
    title: "Inventario fino e infinito",
    desc: "Control estricto de existencias para productos, y stock sin límite para salsas, servicios y extras gratis.",
  },
  {
    ico: "▥",
    title: "Venta atómica",
    desc: "Tu pedido se procesa completo o no se procesa: si un artículo no alcanza, nada se cobra ni se descuenta.",
  },
  {
    ico: "◉",
    title: "Arqueo diario",
    desc: "Abre caja, registra salidas y cierra comparando el dinero físico con el esperado: cuadrada, faltante o sobrante.",
  },
  {
    ico: "≡",
    title: "Precios congelados",
    desc: "Lo cobrado en cada venta queda sellado en el historial. Cambiar tu catálogo jamás altera los reportes.",
  },
];

const STEPS = [
  { n: "01", title: "El Super Admin te registra", desc: "Tu comercio nace con un entorno limpio e independiente, con su usuario de acceso." },
  { n: "02", title: "Recibes tu usuario", desc: "Un solo rol, sin complicaciones: tú manejas todo tu negocio con tu cuenta." },
  { n: "03", title: "Opera tu negocio", desc: "Vende en el mostrador, controla stock, arquea la caja y revisa reportes con precios fieles." },
];

export default function LandingPage() {
  const [planes, setPlanes] = useState<Plan[]>([]);

  useEffect(() => {
    api<Plan[]>("/planes")
      .then(setPlanes)
      .catch(() => {});
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <LiquidBg />

      {/* ---------- Navbar ---------- */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(14px)",
          background: "color-mix(in srgb, var(--bg) 78%, transparent)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--neon)", color: "#04140a", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, boxShadow: "0 0 20px var(--neon-glow)" }}>
            R
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            RestoStock
          </div>
          <div style={{ flex: 1 }} />
          <Link to="/login" className="btn btn-primary" style={{ padding: "10px 18px" }}>
            Ingresar
          </Link>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "90px 24px 60px", textAlign: "center" }}>
        <div className="badge badge-success" style={{ marginBottom: 18 }}>SaaS gastronómico · Bolivia</div>
        <h1 style={{ fontSize: "clamp(38px, 6vw, 64px)", lineHeight: 1.05 }}>
          Tu negocio<br />
          <span style={{ color: "var(--neon)" }}>al frente.</span>
        </h1>
        <p className="muted" style={{ maxWidth: 620, margin: "20px auto 30px", fontSize: 16 }}>
          Inventario fino e infinito, ventas atómicas, arqueo diario y reportes con precios
          congelados — cada comercio en su propia burbuja aislada.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/login" className="btn btn-primary" style={{ padding: "14px 28px", fontSize: 14 }}>
            Entrar a mi negocio
          </Link>
          <a href="#planes" className="btn btn-ghost" style={{ padding: "14px 28px", fontSize: 14 }}>
            Ver planes
          </a>
        </div>
      </section>

      {/* ---------- Características ---------- */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "50px 24px" }}>
        <h2 style={{ fontSize: 26, textAlign: "center", marginBottom: 8 }}>Hecho para el mostrador</h2>
        <p className="muted" style={{ textAlign: "center", marginBottom: 32, fontSize: 14 }}>
          Cuatro reglas que cuidan tu negocio todos los días.
        </p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
          {FEATURES.map((f) => (
            <Tilt key={f.title}>
              <div className="card">
                <div style={{ fontSize: 24, color: "var(--neon)", marginBottom: 10 }}>{f.ico}</div>
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>{f.title}</h3>
                <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>{f.desc}</p>
              </div>
            </Tilt>
          ))}
        </div>
      </section>

      {/* ---------- Franja multi-tenant ---------- */}
      <section style={{ maxWidth: 1080, margin: "30px auto 0", padding: "0 24px" }}>
        <div className="card glow" style={{ textAlign: "center", padding: "34px 26px" }}>
          <div className="badge badge-warn" style={{ marginBottom: 14 }}>Aislamiento total</div>
          <h2 style={{ fontSize: 22, maxWidth: 640, margin: "0 auto" }}>
            Cada negocio vive en su propia burbuja de información
          </h2>
          <p className="muted" style={{ maxWidth: 640, margin: "14px auto 0", fontSize: 14 }}>
            Lo que pasa en tu comercio jamás se mezcla con el de otro: ni productos, ni ventas,
            ni cajas, ni reportes. Dos negocios pueden vender el mismo plato y el sistema los
            trata como mundos separados.
          </p>
        </div>
      </section>

      {/* ---------- Cómo funciona ---------- */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 24px" }}>
        <h2 style={{ fontSize: 26, textAlign: "center", marginBottom: 32 }}>Así de simple</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {STEPS.map((s) => (
            <div key={s.n} className="card">
              <div className="mono" style={{ fontSize: 26, color: "var(--neon)", fontWeight: 700 }}>{s.n}</div>
              <h3 style={{ fontSize: 15, margin: "8px 0" }}>{s.title}</h3>
              <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Planes ---------- */}
      <section id="planes" style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 56px" }}>
        <h2 style={{ fontSize: 26, textAlign: "center", marginBottom: 8 }}>Planes</h2>
        <p className="muted" style={{ textAlign: "center", marginBottom: 30, fontSize: 14, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
          Membresías pagadas por comercio. Registra a tus clientes con nombre y carnet para facturar,
          cobra en efectivo o QR con un clic, imprime tu ticket PDF y recibe alerta cuando tu plan venza.
        </p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {planes.map((p) => (
            <Tilt key={p.clave}>
              <div className={`card ${p.descuento > 0 ? "glow" : ""}`} style={p.descuento > 0 ? { borderColor: "var(--neon)" } : {}}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: 17 }}>{p.nombre}</h3>
                  {p.descuento > 0 && <span className="badge badge-success">{Math.round(p.descuento * 100)}% desc.</span>}
                </div>
                <div className="tabular" style={{ fontSize: 24, fontWeight: 700, color: "var(--neon)", margin: "10px 0 2px" }}>
                  Bs {p.total}
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
                  {p.meses === 1 ? "por 1 mes" : `por ${p.meses} meses`} · equivalente a Bs {p.precioEquivalenteMes}/mes
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, color: "var(--ink-soft)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <li>Entorno aislado completo</li>
                  <li>POS + inventario + caja + clientes</li>
                  <li>Ticket PDF para imprimir</li>
                  <li>Alerta y pausa al vencer</li>
                </ul>
              </div>
            </Tilt>
          ))}
        </div>
        {planes.length === 0 && (
          <p className="muted" style={{ textAlign: "center" }}>Cargando planes…</p>
        )}
      </section>

      {/* ---------- Contacto ---------- */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "10px 24px 60px", textAlign: "center" }}>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>Registra tu comercio hoy</h2>
        <p className="muted" style={{ fontSize: 14, margin: "0 0 22px" }}>
          Contáctanos y activamos tu entorno de inventario y ventas en minutos.
        </p>
        <a href="https://wa.me/59173084452" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ padding: "14px 28px" }}>
          info@restostock.bo
        </a>
      </section>

      {/* ---------- Footer ---------- */}
      <footer style={{ borderTop: "1px solid var(--line)", padding: "26px 24px", textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          RestoStock · edbkl 🇧🇴 · 2026
        </div>
      </footer>
    </div>
  );
}
