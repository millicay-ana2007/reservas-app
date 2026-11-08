import { useState } from "react";
import { reservasApi } from "../api/endpoints";
import Field from "../components/Field";
import { MEDIOS_PAGO, formatMoneda, rules, validate } from "../utils/validators";

const ESQUEMA = {
  monto: [rules.required("Ingresá el monto cobrado"), rules.monto()],
  medio_pago: [rules.required("Elegí el medio de pago")],
};

// Registra el cobro de una reserva en curso: guarda el pago y libera la mesa
export default function CobroForm({ reserva, onSaved, onCancel }) {
  const [values, setValues] = useState({
    monto: reserva.total_pedido > 0 ? String(reserva.total_pedido) : "",
    medio_pago: "efectivo",
  });
  const [errors, setErrors] = useState({});
  const [errorServidor, setErrorServidor] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cambiar = (e) => setValues({ ...values, [e.target.name]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErrorServidor("");
    const errs = validate(values, ESQUEMA);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setEnviando(true);
    try {
      await reservasApi.cobrar(reserva.id, {
        monto: Number(String(values.monto).trim().replace(",", ".")),
        medio_pago: values.medio_pago,
      });
      onSaved();
    } catch (err) {
      setErrorServidor(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="form">
      <p className="field-hint">
        {reserva.cliente}, Mesa {reserva.mesa_numero}
        {reserva.restaurante ? ` de ${reserva.restaurante}` : ""}. Al registrar el cobro la mesa queda libre.
      </p>

      {reserva.total_pedido > 0 && (
        <div className="exito-total">
          <span>Total del pedido de comida</span>
          <strong>{formatMoneda(reserva.total_pedido)}</strong>
        </div>
      )}

      <div className="form-row">
        <Field label="Monto cobrado ($)" error={errors.monto}>
          <input type="text" inputMode="decimal" name="monto" placeholder="Ej: 18500" value={values.monto} onChange={cambiar} autoFocus />
        </Field>
        <Field label="Medio de pago" error={errors.medio_pago}>
          <select name="medio_pago" value={values.medio_pago} onChange={cambiar}>
            {Object.entries(MEDIOS_PAGO).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </Field>
      </div>

      {errorServidor && <div className="alert alert-error" role="alert">{errorServidor}</div>}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost-dark" onClick={onCancel}>Volver</button>
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar cobro y liberar mesa"}
        </button>
      </div>
    </form>
  );
}
