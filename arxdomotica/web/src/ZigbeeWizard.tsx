import { useEffect, useRef, useState } from "react";

interface ZigbeeDevice {
  ieee_address: string;
  friendly_name: string;
  interview_state?: string;
  definition?: { model?: string; vendor?: string; description?: string } | null;
}

type Status = "idle" | "pairing" | "joined" | "error";

export default function ZigbeeWizard() {
  const [status, setStatus] = useState<Status>("idle");
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState("");
  const [newDevice, setNewDevice] = useState<{ ieee: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [devices, setDevices] = useState<ZigbeeDevice[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("api/zigbee/devices", { credentials: "include" })
      .then((r) => r.json())
      .then(setDevices)
      .catch(() => setDevices([]));
    return () => eventSourceRef.current?.close();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function startPairing() {
    setStatus("pairing");
    setMessage("Mettez votre appareil en mode appairage (voir sa notice), il sera détecté automatiquement.");
    setNewDevice(null);

    fetch("api/zigbee/permit-join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ seconds: 120 }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCountdown(data.seconds ?? 120);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message ?? "Impossible de démarrer l'appairage.");
      });

    const es = new EventSource("api/zigbee/events");
    eventSourceRef.current = es;
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "device_interview" && event.data?.status === "started") {
        setMessage("Appareil détecté, configuration en cours...");
      } else if (event.type === "device_joined") {
        setNewDevice({ ieee: event.data.ieee_address, name: event.data.friendly_name });
        setRenameValue(event.data.friendly_name ?? "");
        setStatus("joined");
        setMessage("Appareil ajouté avec succès !");
        es.close();
      }
    };
  }

  function saveRename() {
    if (!newDevice) return;
    fetch(`api/zigbee/devices/${newDevice.ieee}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: renameValue }),
    })
      .then((r) => r.json())
      .then(() => {
        setStatus("idle");
        setNewDevice(null);
        fetch("api/zigbee/devices", { credentials: "include" })
          .then((r) => r.json())
          .then(setDevices);
      });
  }

  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: 420 }}>
      <h2>Ajouter un appareil Zigbee</h2>

      {status === "idle" && <button onClick={startPairing}>Ajouter un appareil</button>}

      {status === "pairing" && (
        <p>
          {message} {countdown > 0 && <>({countdown}s restantes)</>}
        </p>
      )}

      {status === "joined" && newDevice && (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <p>{message}</p>
          <label>
            Donnez-lui un nom facile à reconnaître :
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </label>
          <button onClick={saveRename}>Enregistrer</button>
        </div>
      )}

      {status === "error" && <p style={{ color: "crimson" }}>{message}</p>}

      <h3>Appareils déjà connectés</h3>
      <ul>
        {devices
          .filter((d) => d.friendly_name !== "Coordinator")
          .map((d) => (
            <li key={d.ieee_address}>{d.friendly_name}</li>
          ))}
      </ul>
    </div>
  );
}
