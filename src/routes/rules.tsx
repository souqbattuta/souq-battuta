import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { Shell } from "@/components/site-header";

export const Route = createFileRoute("/rules")({ component: RulesPage });

function RulesPage() {
  const ar = useSession((s) => s.lang) === "ar";
  return (
    <Shell>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/" className="text-sm">{ar ? "رجوع" : "Back"}</Link>
        <h1 className="mt-4 font-display text-4xl">{ar ? "القواعد" : "Rules"}</h1>
        <section className="mt-6 rounded-xl border border-line bg-cream p-4">
          <h2 className="font-display text-2xl">{ar ? "بيع الحيوانات" : "Animal sales"}</h2>
          <div className="mt-2 space-y-3 text-sm leading-relaxed">
            <p>
              Selling animals is prohibited on Souq Battuta. Any post or listing offering animals for sale will be removed, regardless of subscription tier. Adopt, don’t shop. Pet accessories like food, toys, beds, and leashes are welcome.
            </p>
            <p dir="rtl" lang="ar">
              بيع الحيوانات ممنوع على سوق بطوطة. أي منشور أو منتج يعرض حيواناً للبيع يُحذف، مهما كانت الخطة. تبنَّ، لا تشترِ. مستلزمات الحيوانات مثل الأكل والألعاب والأسرّة والطوق مسموحة.
            </p>
            <p>Hand-reared birds may be sold. Sale of other animals is not.</p>
            <p dir="rtl" lang="ar">يُستثنى من هذا المنع بيع الطيور المرباة باليد، وهو مسموح. بيع غيرها من الحيوانات غير مسموح.</p>
          </div>
        </section>
      </main>
    </Shell>
  );
}
