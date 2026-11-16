"use client";

import { useActionState, useEffect, useState } from "react";
import { collectBrowserDeviceSignals } from "@/lib/device-signals-client";
import { courierLoginAction, type CourierLoginState } from "./actions";

export function CourierLoginForm() {
  const [state, action, pending] = useActionState<CourierLoginState, FormData>(courierLoginAction, {});
  const [deviceSignals, setDeviceSignals] = useState("");

  useEffect(() => {
    setDeviceSignals(collectBrowserDeviceSignals());
  }, []);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="deviceSignals" value={deviceSignals} />
      <label className="field-label">
        Numéro de téléphone
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="07 07 07 07 07"
          defaultValue={state.phone}
          className="input h-12 text-lg"
        />
      </label>
      <label className="field-label">
        Code PIN
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="\d{6}"
          maxLength={6}
          required
          className="input h-14 text-center font-mono text-2xl tracking-[0.4em]"
        />
      </label>

      {state.error && (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary h-12 text-base">
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
