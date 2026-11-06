import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/site-header";
import { AnimalRule } from "@/components/animal-rule";
import { adminModerate, adminReports } from "@/lib/souq-sync";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Report = {
  id: string;
  target_type: string;
  target_id: string;
  reporter_phone: string;
  reason: string;
  status: string;
  note: string;
  created_at: string;
  hello_text?: string | null;
  shop_name?: string | null;
};

function AdminPage() {
  const [rows, setRows] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const res = await adminReports();
    if (!res.ok) {
      setError("This page is for the site owner.");
      return;
    }
    setError("");
    setRows(res.reports as Report[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(row: Report, action: "hide" | "remove" | "keep") {
    const res = await adminModerate({
      data: { targetType: row.target_type === "shop" ? "shop" : "hello", targetId: row.target_id, action, note },
    });
    if (res.ok) void load();
  }

  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-4xl">Admin</h1>
        <p className="mt-2 text-sm text-mute">Reported Hello World posts and shops.</p>
        <div className="mt-4"><AnimalRule ar={false} /></div>
        {error && <p className="mt-4 text-sm text-red">{error}</p>}
        <label className="mt-4 block text-sm font-semibold">
          Moderation note
          <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line px-3" />
        </label>
        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-line bg-cream p-4 text-sm">
              <p className="font-semibold">{row.target_type} · {row.target_id}</p>
              <p>{row.hello_text || row.shop_name || "Content unavailable"}</p>
              <p className="text-mute">{row.reason || "No reason"} · {row.status}</p>
              {row.note && <p>{row.note}</p>}
              <div className="mt-3 flex gap-2">
                <button type="button" className="h-9 rounded-md border border-ink px-3" onClick={() => void act(row, "hide")}>Hide</button>
                <button type="button" className="h-9 rounded-md border border-ink px-3" onClick={() => void act(row, "remove")}>Remove</button>
                <button type="button" className="h-9 rounded-md bg-ink px-3 text-cream" onClick={() => void act(row, "keep")}>Keep</button>
              </div>
            </li>
          ))}
          {rows.length === 0 && !error && <li className="text-sm text-mute">No reports yet.</li>}
        </ul>
      </main>
    </Shell>
  );
}
