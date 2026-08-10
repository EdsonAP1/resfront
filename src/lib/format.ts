export const bs = (n: number): string =>
  "Bs " + n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fecha = (iso: string | Date): string =>
  new Date(iso).toLocaleString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const fechaCorta = (iso: string | Date): string =>
  new Date(iso).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" });

export const METODOS_PAGO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  QR: "QR Simple",
  TRANSFERENCIA: "Transferencia",
  OTRO: "Otro",
};
