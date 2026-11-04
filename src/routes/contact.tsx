import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { Shell } from "@/components/site-header";

export const Route = createFileRoute("/contact")({ component: ContactPage });

function ContactPage() {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const user = useSession((s) => s.user);
  const messageSouq = useSession((s) => s.messageSouq);
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get("body") ?? "");
    if (!messageSouq(body).ok) return;
    event.currentTarget.reset();
    setSent(true);
  }

  return (
    <Shell>
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-mute">{ar ? "سوق بطوطة" : "Souq Battuta"}</p>
        <h1 className="mt-2 font-display text-4xl">{ar ? "تواصل" : "Contact"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          {ar
            ? "اكتب لنا من هون. منرد بس من الموقع. ما منراسلك على واتساب أو أي تطبيق ثاني، وما منطلب معلوماتك الخاصة من هناك."
            : "Write to us here. We only reply on this site. We never contact you on WhatsApp or any other app, and we never ask for your private information there."}
        </p>
        {!user ? (
          <p className="mt-6 text-sm">
            <Link to="/sign-in" search={{ next: "/contact" }} className="font-semibold underline">{ar ? "ادخل أول" : "Log in first"}</Link>
          </p>
        ) : (
          <form className="mt-6 rounded-xl border border-line bg-cream p-4" onSubmit={onSubmit}>
            <textarea name="body" required rows={5} className="w-full rounded-md border border-line bg-white px-3 py-2" placeholder={ar ? "اكتب رسالتك" : "Write your message"} />
            <button type="submit" className="mt-3 h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream">{ar ? "تواصل" : "Contact"}</button>
            {sent && <p className="mt-3 text-sm">{ar ? "وصلت. بتلاقي الرد في الوارد." : "Sent. The reply lands in your inbox."}</p>}
          </form>
        )}
      </main>
    </Shell>
  );
}
