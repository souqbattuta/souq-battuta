import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { AnimalRule } from "@/components/animal-rule";
import { Shell } from "@/components/site-header";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  const lang = useSession((s) => s.lang);
  const ar = lang === "ar";
  const sections = ar
    ? [
        ["كيف منراسلك", "سوق بطوطة ما بتراسلك على واتساب أو أي تطبيق رسائل ثاني، وما بتطلب معلوماتك الخاصة من هناك. التواصل بس من الموقع، من الوارد."],
        ["الحساب", "الحساب برقم أردني. رقم واحد لحساب واحد. لازم يكون عمرك ١٨ أو أكثر. رمز الدعوة اختياري، وإذا كان غلط الحساب بينفتح بدون الختم."],
        ["الطلبات", "الاستفسار والطلب بيطلعوا من الموقع لواتساب البائع. منخزّن إن الرقم المسجّل سأل عن صنف، مرة باليوم. ما منقرأ المحادثة."],
        ["التقييمات", "اللي كتب التقييم هو الوحيد اللي بقدر يحذفه. إذا انبلّغ التقييم وطلع فيه كلام بذيء، سوق بطوطة بتشيله. البلاغ بدون بذاءة ما بحذف التقييم."],
        ["العنوان", "العنوان المحفوظ بينبعت بس إذا اخترت تضيفه وأنت بتأكد الطلب. ما بنطلب عنوانك أو كلمة سرك برسالة خارج الموقع."],
        ["البائعون", "سوق بطوطة ما بتضمن البائع. المشتري مسؤول يتأكد قبل ما يشتري."],
      ]
    : [
        ["How we contact you", "Souq Battuta will never contact you on WhatsApp or any other messaging app and ask for your private information. We only contact you on this site, in your inbox."],
        ["Your account", "An account uses one Jordanian mobile number. You must be 18 or older. A referral code is optional. A wrong code still opens the account, without the stamp."],
        ["Orders", "An inquiry or order leaves this site for the seller’s WhatsApp. We store that a logged-in number asked about an item, once a day. We do not read that chat."],
        ["Reviews", "Only the person who wrote a review can delete it. If a review is reported and the words are profane, Souq Battuta may take it down. A report without profanity does not delete it."],
        ["Addresses", "A saved address is sent only if you choose to add it when you confirm an order. We will not ask for your address or password in a message outside this site."],
        ["Sellers", "Souq Battuta does not vouch for a seller. The buyer checks before they buy."],
      ];
  return (
    <Shell>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/" className="text-sm">{ar ? "رجوع" : "Back"}</Link>
        <h1 className="mt-4 font-display text-4xl">{ar ? "الخصوصية" : "Privacy"}</h1>
        <div className="mt-6"><AnimalRule ar={ar} /></div>
        <div className="mt-6 space-y-4">
          {sections.map(([title, body]) => (
            <section key={title} className="rounded-xl border border-line bg-cream p-4">
              <h2 className="font-display text-2xl">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed">{body}</p>
            </section>
          ))}
        </div>
      </main>
    </Shell>
  );
}
