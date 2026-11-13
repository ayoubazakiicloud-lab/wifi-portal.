"use client";
import { FormEvent, useEffect, useRef, useState } from "react";

const MESSAGES: Record<string, string> = {
  invalid_format: "Le code contient 6 à 12 lettres ou chiffres. Vérifie ton ticket.",
  not_found: "Ce code n’existe pas. Vérifie-le sur ton ticket.",
  expired: "Ce ticket a expiré. Demande un nouveau ticket au vendeur.",
  disabled: "Ce ticket est désactivé. Contacte le vendeur.",
  not_configured: "Le portail n’est pas configuré. Contacte l’administrateur.",
  server: "Service indisponible. Réessaie dans un instant.",
};

type State = "idle" | "loading" | "success";

export default function Portal() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [creds, setCreds] = useState({ username: "", password: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const name = process.env.NEXT_PUBLIC_PORTAL_NAME ?? "Wifi Zone";
  const gateway = process.env.NEXT_PUBLIC_GATEWAY_LOGIN_URL;

  useEffect(() => {
    const p = Object.fromEntries(new URLSearchParams(window.location.search).entries());
    setParams(p);
    if (process.env.NODE_ENV !== "production") console.info("Paramètres Ruijie reçus :", p);
  }, []);

  // Soumet le formulaire caché vers le contrôleur dès que les identifiants sont dans le DOM.
  useEffect(() => {
    if (state === "success" && creds.username) formRef.current?.submit();
  }, [state, creds]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (state !== "idle") return;
    if (!gateway) return setError(MESSAGES.not_configured);
    setError(null);
    setState("loading");
    try {
      const res = await fetch("/api/voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(MESSAGES[data.error] ?? MESSAGES.server);
        return setState("idle");
      }
      setCreds({ username: data.username, password: data.password });
      setState("success");
    } catch {
      setError(MESSAGES.server);
      setState("idle");
    }
  }

  return (
    <main className="shell">
      <div className="brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0" />
        </svg>
        {name}
      </div>

      <section>
        <h1>Connecte-toi au WiFi</h1>
        <p className="lead">Entre le code imprimé sur ton ticket pour accéder à internet.</p>
      </section>

      <form className="ticket" onSubmit={onSubmit} noValidate>
        <div className="ticket-main">
          <label htmlFor="code">Code du ticket</label>
          <input
            id="code" type="text" inputMode="text" autoComplete="off" autoCapitalize="characters"
            spellCheck={false} maxLength={14} placeholder="A1B2C3D4" value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={!!error} aria-describedby={error ? "code-error" : "code-hint"}
            disabled={state !== "idle"}
          />
          <p id="code-hint" className="hint">Majuscules ou minuscules, avec ou sans tiret.</p>
          <div aria-live="polite">
            {error && <p id="code-error" className="error" role="alert">{error}</p>}
          </div>
        </div>
        <div className="ticket-stub">
          <button type="submit" disabled={state !== "idle" || code.trim().length < 6}>
            {state === "loading" && (<><span className="spinner" aria-hidden="true" />Vérification…</>)}
            {state === "success" && "Connexion en cours…"}
            {state === "idle" && "Se connecter"}
          </button>
        </div>
      </form>

      <p className="foot">Pas de ticket ? Demande-en un au vendeur du point WiFi.</p>

      {/* Envoi des identifiants au contrôleur Ruijie, avec les paramètres d’origine. */}
      <form ref={formRef} method="POST" action={gateway} hidden>
        <input type="hidden" name="username" value={creds.username} readOnly />
        <input type="hidden" name="password" value={creds.password} readOnly />
        {Object.entries(params).map(([k, v]) => (<input key={k} type="hidden" name={k} value={v} readOnly />))}
      </form>
    </main>
  );
}
