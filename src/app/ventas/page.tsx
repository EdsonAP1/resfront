"use client";

import { useEffect, useState, DragEvent } from "react";
import { createPortal } from "react-dom";
import Shell from "@/components/Shell";
import Tilt from "@/components/Tilt";
import { api, apiBlob } from "@/api/client";
import { bs, METODOS_PAGO } from "@/lib/format";

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

type Linea = { producto: Producto; cantidad: number };

type Cliente = { id: string; nombre: string; carnet: string };

export default function VentasPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteCarnet, setClienteCarnet] = useState("");
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [loading, setLoading] = useState(false);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; tipo: string } | null>(null);

  const [draggedProductIndex, setDraggedProductIndex] = useState<number | null>(null);
  const [draggedCartIndex, setDraggedCartIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // State para modal de Ticket PDF
  const [ticketPdfUrl, setTicketPdfUrl] = useState<string | null>(null);
  const [ticketVentaNumero, setTicketVentaNumero] = useState<number | null>(null);
  const [lastVentaTotal, setLastVentaTotal] = useState<number>(0);
  const [lastMetodoPago, setLastMetodoPago] = useState<string>("EFECTIVO");

  const load = () => {
    api<Producto[]>("/productos")
      .then((data) => {
        const orderStr = localStorage.getItem("rs_pos_product_order");
        if (orderStr) {
          try {
            const orderArr = JSON.parse(orderStr) as string[];
            const sorted = [...data].sort((a, b) => {
              const idxA = orderArr.indexOf(a.id);
              const idxB = orderArr.indexOf(b.id);
              if (idxA === -1 && idxB === -1) return 0;
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            });
            setProductos(sorted);
            return;
          } catch (e) {}
        }
        setProductos(data);
      })
      .catch((e) => setToast({ msg: e.message, tipo: "error" }));
    api<Cliente[]>("/clientes")
      .then(setClientes)
      .catch(() => {});
  };

  useEffect(() => {
    setMounted(true);
    load();
  }, []);

  const showToast = (msg: string, tipo = "success") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4200);
  };

  const add = (p: Producto) => {
    setCarrito((c) => {
      const idx = c.findIndex((l) => l.producto.id === p.id);
      if (idx >= 0) {
        const n = [...c];
        n[idx] = { ...n[idx], cantidad: n[idx].cantidad + 1 };
        return n;
      }
      return [...c, { producto: p, cantidad: 1 }];
    });
  };

  const setQty = (id: string, delta: number) => {
    setCarrito((c) =>
      c
        .map((l) =>
          l.producto.id === id
            ? { ...l, cantidad: Math.max(0.01, +(l.cantidad + delta).toFixed(2)) }
            : l
        )
        .filter((l) => l.cantidad >= 0.01)
    );
  };

  const remove = (id: string) => setCarrito((c) => c.filter((l) => l.producto.id !== id));

  // Manejo de Drag & Drop para Productos (Catálogo)
  const handleProductDragStart = (e: DragEvent, index: number) => {
    setDraggedProductIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleProductDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (draggedProductIndex === null || draggedProductIndex === index) return;

    const newProductos = [...productos];
    const draggedItem = newProductos[draggedProductIndex];
    newProductos.splice(draggedProductIndex, 1);
    newProductos.splice(index, 0, draggedItem);

    setDraggedProductIndex(index);
    setProductos(newProductos);
    localStorage.setItem("rs_pos_product_order", JSON.stringify(newProductos.map((p) => p.id)));
  };

  const handleProductDragEnd = () => {
    setDraggedProductIndex(null);
  };

  // Manejo de Drag & Drop para Carrito (Pedido)
  const handleCartDragStart = (e: DragEvent, index: number) => {
    setDraggedCartIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCartDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (draggedCartIndex === null || draggedCartIndex === index) return;

    const newCarrito = [...carrito];
    const draggedItem = newCarrito[draggedCartIndex];
    newCarrito.splice(draggedCartIndex, 1);
    newCarrito.splice(index, 0, draggedItem);

    setDraggedCartIndex(index);
    setCarrito(newCarrito);
  };

  const handleCartDragEnd = () => {
    setDraggedCartIndex(null);
  };

  // Manejo de autocompletado de cliente por Carnet / Selección
  const handleCarnetChange = (val: string) => {
    setClienteCarnet(val);
    const encontrado = clientes.find(
      (c) => c.carnet.toLowerCase() === val.trim().toLowerCase()
    );
    if (encontrado) {
      setClienteId(encontrado.id);
      setClienteNombre(encontrado.nombre);
    } else {
      setClienteId("");
    }
  };

  const handleSelectCliente = (id: string) => {
    setClienteId(id);
    if (!id) {
      setClienteNombre("");
      setClienteCarnet("");
      return;
    }
    const encontrado = clientes.find((c) => c.id === id);
    if (encontrado) {
      setClienteNombre(encontrado.nombre);
      setClienteCarnet(encontrado.carnet);
    }
  };

  const total = carrito.reduce((a, l) => a + l.cantidad * l.producto.precio, 0);

  const cobrar = async () => {
    if (carrito.length === 0) return;
    setLoading(true);
    setAlertas([]);
    try {
      const res = await api<{
        venta: { id: string; numero: number; total: number };
        alertasReabastecimiento: string[];
      }>("/ventas", {
        method: "POST",
        body: JSON.stringify({
          items: carrito.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
          metodoPago,
          clienteId: clienteId || null,
          clienteNombre: clienteNombre.trim() || null,
          clienteCarnet: clienteCarnet.trim() || null,
        }),
      });

      if (res.alertasReabastecimiento.length > 0) setAlertas(res.alertasReabastecimiento);
      showToast(`Venta #${res.venta.numero} cobrada: ${bs(res.venta.total)}`);

      setLastVentaTotal(res.venta.total);
      setLastMetodoPago(metodoPago);

      // Guardar copia local de respaldo
      try {
        const backupStr = localStorage.getItem("rs_sales_backup") || "[]";
        const backup = JSON.parse(backupStr) as any[];
        backup.unshift({
          id: res.venta.id,
          numero: res.venta.numero,
          total: res.venta.total,
          metodoPago,
          cliente: clienteCarnet.trim() ? { nombre: clienteNombre, carnet: clienteCarnet } : null,
          fecha: new Date().toISOString(),
          items: carrito.map((l) => ({ producto: l.producto.nombre, cantidad: l.cantidad, precio: l.producto.precio })),
        });
        if (backup.length > 100) backup.pop();
        localStorage.setItem("rs_sales_backup", JSON.stringify(backup));
      } catch (err) {
        console.error("Fallo al guardar respaldo de venta local:", err);
      }

      // Limpiar carrito y campos cliente
      setCarrito([]);
      setClienteId("");
      setClienteNombre("");
      setClienteCarnet("");
      load();

      // Cargar Ticket PDF para vista previa e impresión
      try {
        const blob = await apiBlob(`/ventas/${res.venta.id}/ticket`);
        const url = URL.createObjectURL(blob);
        setTicketPdfUrl(url);
        setTicketVentaNumero(res.venta.numero);
      } catch (pdfErr) {
        showToast("Venta registrada, pero falló la generación del ticket PDF", "error");
      }
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const cerrarModalTicket = () => {
    if (ticketPdfUrl) URL.revokeObjectURL(ticketPdfUrl);
    setTicketPdfUrl(null);
    setTicketVentaNumero(null);
  };

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 30 }}>Punto de Venta</h1>
        <span className="badge badge-neutral">Mostrador</span>
      </div>
      <p className="muted" style={{ margin: "4px 0 22px" }}>
        Toca un producto para agregarlo · la venta se procesa completa o no se procesa.
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

      <div className="pos-grid">
        <div>
          <div className="grid grid-products">
            {productos.map((p, idx) => (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => handleProductDragStart(e, idx)}
                onDragOver={(e) => handleProductDragOver(e, idx)}
                onDragEnd={handleProductDragEnd}
                style={{ cursor: "grab", opacity: draggedProductIndex === idx ? 0.35 : 1 }}
              >
                <Tilt max={8} onClick={() => add(p)}>
                  <div className="pcard">
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 16, marginTop: 8, textTransform: "uppercase", lineHeight: 1.2 }}>
                      {p.nombre}
                    </div>
                    {p.descripcion && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 4, textTransform: "lowercase", lineHeight: 1.15 }}>
                        {p.descripcion}
                      </div>
                    )}
                    <div className="tabular" style={{ fontSize: 16, fontWeight: 800, marginTop: 10, color: "var(--neon)" }}>
                      {p.precio === 0 ? "Gratis" : bs(p.precio)}
                    </div>
                  </div>
                </Tilt>
              </div>
            ))}
          </div>
        </div>

        <div className="cart">
          <h2 style={{ fontSize: 18, marginBottom: 2 }}>Pedido</h2>
          <div className="muted mono" style={{ fontSize: 11, marginBottom: 10 }}>{carrito.length} líneas</div>

          {carrito.length === 0 && (
            <div className="empty">
              Mostrador vacío.
              <br />
              Toca un producto.
            </div>
          )}

          {carrito.map((l, idx) => (
            <div
              key={l.producto.id}
              className="cart-line"
              draggable
              onDragStart={(e) => handleCartDragStart(e, idx)}
              onDragOver={(e) => handleCartDragOver(e, idx)}
              onDragEnd={handleCartDragEnd}
              style={{ cursor: "grab", opacity: draggedCartIndex === idx ? 0.4 : 1 }}
            >
              <div style={{ display: "flex", alignItems: "center", marginRight: 6, color: "var(--ink-soft)", fontSize: 14, userSelect: "none" }}>
                ⋮⋮
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13, textTransform: "uppercase" }}>{l.producto.nombre}</div>
                <div className="tabular muted" style={{ fontSize: 11.5 }}>
                  {bs(l.producto.precio)} × {l.cantidad}
                </div>
              </div>
              <div className="cart-qty" style={{ cursor: "default" }} onClick={(e) => e.stopPropagation()}>
                <button className="qty-btn" onClick={() => setQty(l.producto.id, l.producto.permiteFracciones ? -0.5 : -1)}>−</button>
                <span className="tabular" style={{ minWidth: 34, textAlign: "center", fontWeight: 700 }}>{l.cantidad}</span>
                <button className="qty-btn" onClick={() => setQty(l.producto.id, l.producto.permiteFracciones ? 0.5 : 1)}>+</button>
              </div>
              <button className="qty-btn danger" style={{ cursor: "default" }} onClick={(e) => { e.stopPropagation(); remove(l.producto.id); }} title="Quitar">×</button>
            </div>
          ))}

          {carrito.length > 0 && (
            <>
              {/* Panel de Datos del Cliente (Autocompletado + Registro Automático) */}
              <div className="field" style={{ marginTop: 14, background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ margin: 0, fontWeight: 700 }}>Cliente / Comprador</label>
                  {clientes.length > 0 && (
                    <select
                      className="select"
                      style={{ fontSize: 12, padding: "2px 8px", width: "auto" }}
                      value={clienteId}
                      onChange={(e) => handleSelectCliente(e.target.value)}
                    >
                      <option value="">Buscar de la lista...</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.carnet} - {c.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <span className="muted" style={{ fontSize: 11 }}>Carnet / NIT</span>
                    <input
                      className="input"
                      placeholder="Ej: 1234567 LP"
                      value={clienteCarnet}
                      onChange={(e) => handleCarnetChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="muted" style={{ fontSize: 11 }}>Nombre completo</span>
                    <input
                      className="input"
                      placeholder="Nombre del comprador"
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                    />
                  </div>
                  {clienteCarnet.trim() && !clienteId && (
                    <div className="hint" style={{ fontSize: 11, color: "var(--neon)" }}>
                      ✓ Cliente nuevo: se registrará automáticamente en la base de datos
                    </div>
                  )}
                  {clienteId && (
                    <div className="hint" style={{ fontSize: 11, color: "var(--neon-green, #4ade80)" }}>
                      ✓ Cliente registrado autocompletado
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", margin: "16px 0 12px", fontFamily: "var(--font-display)", fontSize: 24, textTransform: "uppercase" }}>
                <span>Total</span>
                <span className="tabular" style={{ color: "var(--neon)" }}>{bs(total)}</span>
              </div>
              <div className="field">
                <label>Método de pago</label>
                <select className="select" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                  {Object.entries(METODOS_PAGO).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={cobrar} disabled={loading}>
                {loading ? "Procesando…" : `Cobrar ${bs(total)}`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal Visor de Ticket PDF */}
      {ticketPdfUrl && mounted && typeof window !== "undefined" && createPortal(
        <div
          className="modal-backdrop"
          onClick={cerrarModalTicket}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            className="modal animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 400,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              padding: "30px 24px",
              textAlign: "center",
              backgroundColor: "var(--bg-card, #111)",
            }}
          >
            {/* Ícono animado de éxito */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(74, 222, 128, 0.1)",
                border: "2px solid #4ade80",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#4ade80",
                fontSize: 32,
                boxShadow: "0 0 16px rgba(74, 222, 128, 0.2)",
              }}
            >
              ✓
            </div>

            <div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>¡Venta Completada!</h3>
              <p style={{ color: "var(--ink-soft)", fontSize: 13.5, margin: "6px 0 0" }}>
                El recibo de la venta se generó correctamente.
              </p>
            </div>

            {/* Metadatos de la venta */}
            <div
              style={{
                width: "100%",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                textAlign: "left",
                fontSize: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Ticket N°:</span>
                <span className="mono" style={{ fontWeight: 700 }}>#{ticketVentaNumero}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Total Cobrado:</span>
                <span className="tabular" style={{ fontWeight: 800, color: "var(--neon)" }}>{bs(lastVentaTotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Método de Pago:</span>
                <span>{METODOS_PAGO[lastMetodoPago] ?? lastMetodoPago}</span>
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 8 }}>
              <button
                className="btn btn-primary"
                style={{ width: "100%", padding: "12px", justifyContent: "center" }}
                onClick={() => window.open(ticketPdfUrl, "_blank")}
              >
                Imprimir Ticket (Nueva pestaña)
              </button>
              <a
                href={ticketPdfUrl}
                download={`ticket-${ticketVentaNumero}.pdf`}
                className="btn btn-secondary"
                style={{ width: "100%", padding: "12px", justifyContent: "center", textDecoration: "none", boxSizing: "border-box", textAlign: "center" }}
              >
                Descargar PDF
              </a>
              <button
                className="btn btn-ghost"
                style={{ width: "100%", padding: "10px", justifyContent: "center" }}
                onClick={cerrarModalTicket}
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </Shell>
  );
}
