import { FormEvent, useState } from "react";
import ZigbeeWizard from "./ZigbeeWizard";
import AlarmoPanel from "./AlarmoPanel";

const inviteCode = new URLSearchParams(window.location.search).get("invite");

function useApi() {
  return async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`api/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
    return data;
  };
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const call = useApi();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await call("/login", { username, password });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: 320 }}>
      <h1>Connexion</h1>
      <input placeholder="Nom d'utilisateur" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input placeholder="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit">Se connecter</button>
    </form>
  );
}

function RegisterForm({ invite, onSuccess }: { invite: string; onSuccess: () => void }) {
  const call = useApi();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await call("/register", { inviteCode: invite, name, username, password });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: 320 }}>
      <h1>Créer votre compte</h1>
      <input placeholder="Votre nom" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Nom d'utilisateur" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input placeholder="Mot de passe (8 caractères min.)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit">Créer mon compte</button>
    </form>
  );
}

function Dashboard() {
  return (
    <div style={{ display: "grid", gap: "2rem" }}>
      <h1>Arxdomotica</h1>
      <ZigbeeWizard />
      <AlarmoPanel />
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);

  if (authenticated) return <Dashboard />;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      {inviteCode ? (
        <RegisterForm invite={inviteCode} onSuccess={() => setAuthenticated(true)} />
      ) : (
        <LoginForm onSuccess={() => setAuthenticated(true)} />
      )}
    </div>
  );
}
