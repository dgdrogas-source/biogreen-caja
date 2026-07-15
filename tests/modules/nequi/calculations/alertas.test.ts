import { describe, expect, it } from "vitest";
import { detectarAlertasCierre } from "@/modules/nequi/calculations/alertas";

const base = { descuadreEfectivo: 0, utilidadDia: 100000, consignar: 0, consignado: false };

describe("detectarAlertasCierre", () => {
  it("todo en orden → sin alertas", () => {
    expect(detectarAlertasCierre(base)).toEqual([]);
  });

  it("descuadreEfectivo null (aún no se contó) → sin alerta de descuadre", () => {
    const r = detectarAlertasCierre({ ...base, descuadreEfectivo: null });
    expect(r.some((a) => a.tipo === "DESCUADRE_EFECTIVO")).toBe(false);
  });

  it("descuadre positivo (sobra) genera alerta", () => {
    const r = detectarAlertasCierre({ ...base, descuadreEfectivo: 2000 });
    expect(r).toEqual([{ tipo: "DESCUADRE_EFECTIVO", mensaje: "Sobran $2.000 en efectivo" }]);
  });

  it("descuadre negativo (falta) genera alerta", () => {
    const r = detectarAlertasCierre({ ...base, descuadreEfectivo: -1500 });
    expect(r).toEqual([{ tipo: "DESCUADRE_EFECTIVO", mensaje: "Faltan $1.500 en efectivo" }]);
  });

  it("utilidadDia negativa (gastos superan el sobre) genera alerta", () => {
    const r = detectarAlertasCierre({ ...base, utilidadDia: -20000 });
    expect(r.some((a) => a.tipo === "GASTOS_SUPERAN_SOBRE")).toBe(true);
  });

  it("consignar > 0 y no consignado → alerta pendiente", () => {
    const r = detectarAlertasCierre({ ...base, consignar: 50000, consignado: false });
    expect(r.some((a) => a.tipo === "PENDIENTE_CONSIGNAR")).toBe(true);
  });

  it("consignar > 0 pero ya marcado consignado → sin alerta", () => {
    const r = detectarAlertasCierre({ ...base, consignar: 50000, consignado: true });
    expect(r.some((a) => a.tipo === "PENDIENTE_CONSIGNAR")).toBe(false);
  });

  it("consignar <= 0 nunca genera la alerta aunque consignado sea false", () => {
    const r1 = detectarAlertasCierre({ ...base, consignar: 0, consignado: false });
    const r2 = detectarAlertasCierre({ ...base, consignar: -5000, consignado: false });
    expect(r1.some((a) => a.tipo === "PENDIENTE_CONSIGNAR")).toBe(false);
    expect(r2.some((a) => a.tipo === "PENDIENTE_CONSIGNAR")).toBe(false);
  });

  it("las 3 alertas pueden aparecer juntas", () => {
    const r = detectarAlertasCierre({
      descuadreEfectivo: -1000,
      utilidadDia: -5000,
      consignar: 10000,
      consignado: false,
    });
    expect(r).toHaveLength(3);
  });
});
