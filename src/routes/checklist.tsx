import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { Shell } from "@/components/site-header";

export const Route = createFileRoute("/checklist")({ component: ChecklistPage });

const EN = [
  ["Join", "One person joins as a buyer. One joins as a seller. Use your real mobile, with the country code. Jordan 07… is fine. Saudi +966 5…, UAE +971 5…, Egypt +20 1… also work. A wrong length should be rejected."],
  ["Log in twice", "Log out and log in again. The stall and the profile should still be there."],
  ["Seller plan", "On the seller page, under the plan name, paste a code and apply it. TEST-BASIC is Basic. TEST-GROW is Grow. TEST-PREMIUM and TEST-PRO are both Premium."],
  ["Add a product", "Add a name in English and Arabic, a price, and photos. Save, then open View profile. The product should be there."],
  ["Find it", "From Home, open Food, or search the stall name. Open the stall."],
  ["Order", "Add something and confirm. The WhatsApp text must be correct. Send it. It should arrive on +962 7 9563 6663, not on the seller’s own number."],
  ["Review and report", "After an order, leave a review. Report one. Only a profane review should come down."],
  ["Contact", "Buyer: press Contact and send a note. Seller: from the inbox, write to Souq Battuta. Every plan can."],
  ["Language and phone", "Switch English and Arabic. Turn the phone sideways. Try to overlap buttons and cut off words."],
  ["Break it", "Empty fields, a very long name, the same username twice, a used code, and a closed stall. Write down the page, the phone, and what you tapped."],
];

const AR = [
  ["التسجيل", "واحد يسجّل مشتري وواحد بائع. استخدم رقمك الحقيقي مع رمز الدولة. 07 الأردني مقبول. السعودية +966، الإمارات +971، ومصر +20 كمان. الرقم الناقص لازم ينرفض."],
  ["دخول مرتين", "اطلع وادخل مرة ثانية. الدكان والملف لازم يضلوا."],
  ["خطة البائع", "بصفحة البائع، تحت اسم الخطة، الصق الرمز. TEST-BASIC أساسي. TEST-GROW نمو. TEST-PREMIUM و TEST-PRO الاتنين مميز."],
  ["أضف منتج", "اسم بالعربي والإنجليزي، وسعر، وصور. احفظ، وبعدين شوف الملف. المنتج لازم يبين."],
  ["لاقيه", "من الرئيسية افتح طعام، أو دوّر على اسم الدكان، وافتحه."],
  ["اطلب", "أضف صنف وأكّد. نص الواتساب لازم يكون صح. أرسله. يوصل على +962 7 9563 6663، مو على رقم البائع."],
  ["تقييم وبلاغ", "بعد الطلب اكتب تقييم. بلّغ عن واحد. بس التقييم البذيء بينشال."],
  ["تواصل", "المشتري يضغط تواصل. البائع يكتب لسوق بطوطة من الوارد. كل الخطط تقدر."],
  ["اللغة والموبايل", "بدّل عربي وإنجليزي. اقلب التلفون. شوف إذا في زر مغطى أو كلمة مقطوعة."],
  ["كسّره", "خانات فاضية، اسم طويل، نفس اسم المستخدم مرتين، رمز مستخدم، ودكان مقفل. اكتب الصفحة والتلفون وإيش ضغطت."],
];

function ChecklistPage() {
  const ar = useSession((s) => s.lang) === "ar";
  const rows = ar ? AR : EN;
  return (
    <Shell>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-mute">{ar ? "للأصدقاء" : "For friends"}</p>
        <h1 className="mt-2 font-display text-4xl">{ar ? "قائمة التجربة" : "Test list"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          {ar
            ? "لا تحط بطاقة حقيقية. الدفع لسا مو شغال. كل طلب واتساب يوصل على رقم التجربة."
            : "Do not enter a real card. Payment is not live. Every WhatsApp order arrives on the test number."}
        </p>
        <ol className="mt-6 space-y-3">
          {rows.map(([title, body], index) => (
            <li key={title} className="rounded-xl border border-line bg-cream p-4">
              <p className="text-sm font-semibold">{index + 1}. {title}</p>
              <p className="mt-1 text-sm leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </main>
    </Shell>
  );
}
