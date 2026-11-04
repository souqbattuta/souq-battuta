import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SHOPS } from "@/lib/data";
import { shopMuted } from "@/lib/shelves";
import { useSession } from "@/lib/session";
import { copy } from "@/lib/i18n";
import { Shell } from "@/components/site-header";

export const Route = createFileRoute("/inbox")({ component: InboxPage });

function InboxPage() {
  const lang = useSession((s) => s.lang);
  const t = copy[lang];
  const user = useSession((s) => s.user);
  const notes = useSession((s) => s.notes);
  const orders = useSession((s) => s.orders);
  const mutedWords = useSession((s) => s.mutedWords ?? []);
  const mutedStalls = useSession((s) => s.mutedStalls ?? []);
  const alertWords = useSession((s) => s.alertWords);
  const addReview = useSession((s) => s.addReview);

  if (!user) {
    return (
      <Shell>
        <main className="px-6 py-16">
          <h1 className="font-display text-2xl">{t.inbox}</h1>
          <Link to="/sign-in" search={{ next: "/inbox" }} className="mt-4 inline-flex h-12 items-center rounded-md bg-ink px-5 text-cream">
            {t.signIn}
          </Link>
        </main>
      </Shell>
    );
  }

  const alerts = SHOPS.filter((shop) => {
    const blob = [shop.name, shop.nameAr, ...(shop.keywords ?? []), ...shop.products.flatMap((product) => [product.name, product.nameAr])]
      .join(" ")
      .toLowerCase();
    return alertWords.some((word) => blob.includes(word)) && !shopMuted(shop, mutedWords, mutedStalls);
  });

  return (
    <Shell>
      <main className="mx-auto w-full max-w-lg px-4 py-10">
        <Link to="/account" search={{ tab: "", note: "" }} className="text-sm font-semibold text-ink underline">
          {t.back}
        </Link>
        <h1 className="mt-3 font-display text-3xl">{t.inbox}</h1>

        <section className="mt-6">
          <h2 className="font-display text-xl">{t.alertWords}</h2>
          {alerts.length === 0 ? (
            <p className="mt-2 text-sm text-mute">{t.noSaves}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {alerts.map((shop) => (
                <li key={shop.slug}>
                  <Link to="/shop/$slug" params={{ slug: shop.slug }} className="underline">
                    {lang === "ar" ? shop.nameAr : shop.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl">{t.reviews}</h2>
          <ul className="mt-2 space-y-4">
            {orders.map((order) => (
              <li key={order.id} className="rounded-md border border-line bg-white p-3">
                <p className="text-sm font-semibold">{order.shopName}</p>
                <p className="text-sm text-mute">{order.productName}</p>
                {order.reviewed ? (
                  <p className="mt-2 text-xs text-mute">{t.saved}</p>
                ) : (
                  <ReviewBox orderId={order.id} shopSlug={order.shopSlug} onSave={addReview} />
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl">{t.inbox}</h2>
          <ul className="mt-2 divide-y divide-line">
            {notes.map((note) => (
              <li key={note.id} className="py-3">
                <p className="text-sm font-semibold">{note.title}</p>
                <p className="text-sm text-mute">{note.body}</p>
                {note.href?.startsWith("/shop/") && (
                  <Link to="/shop/$slug" params={{ slug: note.href.split("/")[2] ?? "" }} className="text-sm underline">
                    {t.open}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </Shell>
  );
}

function ReviewBox({
  orderId,
  shopSlug,
  onSave,
}: {
  orderId: string;
  shopSlug: string;
  onSave: (review: { shopSlug: string; score: number; comment: string; orderId?: string }) => void;
}) {
  const t = copy[useSession((s) => s.lang)];
  const [score, setScore] = useState(5);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const comment = String(new FormData(e.currentTarget).get("comment") ?? "");
    onSave({ shopSlug, score, comment, orderId });
  }

  return (
    <form className="mt-2 space-y-2" onSubmit={onSubmit}>
      <select className="h-10 rounded-md border border-line bg-white px-2 text-sm" value={score} onChange={(e) => setScore(Number(e.target.value))}>
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <textarea name="comment" required rows={2} className="w-full rounded-md border border-line px-3 py-2 text-sm" />
      <button type="submit" className="h-10 rounded-md bg-ink px-3 text-sm font-semibold text-cream">
        {t.reviews}
      </button>
    </form>
  );
}
