"use client";

import { useActionState } from "react";
import { SignIn, WarningCircle } from "@phosphor-icons/react/ssr";
import { login, type LoginState } from "@/app/actions/auth";

export function LoginForm({ target }: { target: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form className="login-form" action={action}>
      <input type="hidden" name="weiter" value={target} />
      {state.error && (
        <div className="notice critical" role="alert">
          <WarningCircle />
          <p style={{ margin: 0 }}>{state.error}</p>
        </div>
      )}
      <div className="field">
        <label htmlFor="username">Benutzername</label>
        <input
          className="input"
          id="username"
          name="username"
          autoComplete="username"
          defaultValue={state.username}
          required
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="password">Passwort</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button className="primary-button" type="submit" disabled={pending}>
        <SignIn /> {pending ? "Anmelden …" : "Anmelden"}
      </button>
    </form>
  );
}
