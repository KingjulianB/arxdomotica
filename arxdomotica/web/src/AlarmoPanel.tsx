import { FormEvent, useEffect, useState } from "react";

interface AlarmoUser {
  user_id?: string;
  name: string;
  code?: string;
}

interface ScheduleEntry {
  automation_id?: string;
  name: string;
  time: string;
  weekdays: string[];
  mode: "arm" | "disarm";
}

const WEEKDAYS: { value: string; label: string }[] = [
  { value: "mon", label: "Lun" },
  { value: "tue", label: "Mar" },
  { value: "wed", label: "Mer" },
  { value: "thu", label: "Jeu" },
  { value: "fri", label: "Ven" },
  { value: "sat", label: "Sam" },
  { value: "sun", label: "Dim" },
];

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`api/alarmo${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error(data.error ?? "Une erreur est survenue.");
  return data;
}

function ArmDisarmControl() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function trigger(action: "arm" | "disarm", mode?: string) {
    setError(null);
    try {
      await api(`/${action}`, { method: "POST", body: JSON.stringify({ mode }) });
      setStatus(action === "arm" ? `Alarme armée (${mode})` : "Alarme désarmée");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h2>Alarme</h2>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button onClick={() => trigger("arm", "away")}>Armer (absent)</button>
        <button onClick={() => trigger("arm", "home")}>Armer (présent)</button>
        <button onClick={() => trigger("disarm")}>Désarmer</button>
      </div>
      {status && <p>{status}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </section>
  );
}

function UserCodeForm({
  user,
  onSaved,
  onCancel,
}: {
  user: AlarmoUser;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user.name ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify({ user_id: user.user_id, name, code: code || undefined }),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.5rem", maxWidth: 320 }}>
      <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        placeholder="Nouveau code (laisser vide pour ne pas changer)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function UsersSection() {
  const [users, setUsers] = useState<AlarmoUser[]>([]);
  const [editing, setEditing] = useState<AlarmoUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api("/users")
      .then(setUsers)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function remove(userId?: string) {
    if (!userId) return;
    try {
      await api(`/users/${userId}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h2>Codes utilisateurs</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <ul>
        {users.map((u) => (
          <li key={u.user_id}>
            {u.name} <button onClick={() => setEditing(u)}>Changer le code</button>{" "}
            <button onClick={() => remove(u.user_id)}>Supprimer</button>
          </li>
        ))}
      </ul>
      {editing ? (
        <UserCodeForm
          user={editing}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button onClick={() => setEditing({ name: "" })}>Ajouter un utilisateur</button>
      )}
    </section>
  );
}

function ScheduleForm({
  entry,
  onSaved,
  onCancel,
}: {
  entry: ScheduleEntry;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(entry.name);
  const [time, setTime] = useState(entry.time || "22:00");
  const [weekdays, setWeekdays] = useState<string[]>(entry.weekdays ?? []);
  const [mode, setMode] = useState<"arm" | "disarm">(entry.mode ?? "arm");
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: string) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/schedule", {
        method: "POST",
        body: JSON.stringify({ automation_id: entry.automation_id, name, time, weekdays, mode }),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.5rem", maxWidth: 320 }}>
      <input placeholder="Nom de l'horaire (ex. Nuit)" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
        {WEEKDAYS.map((d) => (
          <label key={d.value}>
            <input type="checkbox" checked={weekdays.includes(d.value)} onChange={() => toggleDay(d.value)} />
            {d.label}
          </label>
        ))}
      </div>
      <select value={mode} onChange={(e) => setMode(e.target.value as "arm" | "disarm")}>
        <option value="arm">Armer</option>
        <option value="disarm">Désarmer</option>
      </select>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function ScheduleSection() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api("/schedule")
      .then(setEntries)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function remove(id?: string) {
    if (!id) return;
    try {
      await api(`/schedule/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <h2>Horaires d'armement / désarmement</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <ul>
        {entries.map((s) => (
          <li key={s.automation_id}>
            {s.name} — {s.time} ({s.weekdays.join(", ")}) — {s.mode === "arm" ? "Armer" : "Désarmer"}{" "}
            <button onClick={() => setEditing(s)}>Modifier</button>{" "}
            <button onClick={() => remove(s.automation_id)}>Supprimer</button>
          </li>
        ))}
      </ul>
      {editing ? (
        <ScheduleForm
          entry={editing}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button onClick={() => setEditing({ name: "", time: "22:00", weekdays: [], mode: "arm" })}>
          Ajouter un horaire
        </button>
      )}
    </section>
  );
}

export default function AlarmoPanel() {
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <ArmDisarmControl />
      <UsersSection />
      <ScheduleSection />
    </div>
  );
}
