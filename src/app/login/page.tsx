import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import LiquidBg from "@/components/LiquidBg";
import { api, setToken, setSession } from "@/api/client";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<{ token: string; usuario: { rol: string; nombre: string; comercioId: string | null } }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
      );
      setToken(res.token);
      setSession(res.usuario.rol);
      localStorage.setItem("rs_nombre", res.usuario.nombre);
      if (res.usuario.comercioId) localStorage.setItem("rs_comercio", res.usuario.comercioId);
      navigate(res.usuario.rol === "SUPER_ADMIN" ? "/dashboard" : "/ventas");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <LiquidBg />

      <div className="login-panel">
        <div className="login-side">
          <div className="kick">Gastronomía · Bolivia</div>
          <h1>
            Tu negocio de comida,<br />
            <span style={{ color: "var(--neon)" }}>al frente.</span>
          </h1>
          <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
            Inventario fino, ventas atómicas, arqueo diario y reportes con precios
            congelados — cada comercio en su propia burbuja, sin excepciones.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <span className="badge badge-success">Stock fino / infinito</span>
            <span className="badge badge-warn">Arqueo diario</span>
            <span className="badge badge-success">QR Simple</span>
          </div>
        </div>

        <form className="login-form" onSubmit={submit}>
          <h2 style={{ fontSize: 26, marginBottom: 4 }}>Ingreso</h2>
          <p className="muted" style={{ margin: "0 0 24px", fontSize: 13.5 }}>
            Accede a tu entorno comercial.
          </p>

          <div className="field">
            <label>Correo</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@negocio.bo"
              required
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="alert-strip" style={{ marginBottom: 14, fontSize: 12.5 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
