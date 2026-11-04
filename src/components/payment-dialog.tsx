import { useState, type FormEvent } from "react";
import type { PlanId } from "@/lib/data";

export const CLIQ_ALIAS = "SOUQBATTUTA";

export type PaymentChoice = {
  method: "cliq" | "card";
  ref: string;
  period: "monthly" | "yearly";
  plan: PlanId;
};

export function PaymentDialog({
  ar,
  plan,
  amount,
  onClose,
  onFree,
  onPaid,
}: {
  ar: boolean;
  plan: PlanId;
  amount: string;
  onClose: () => void;
  onFree: () => void;
  onPaid: (choice: PaymentChoice) => void;
}) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");

  function payCliq(event: FormEvent) {
    event.preventDefault();
    const clean = ref.trim();
    if (clean.length < 4) {
      setError(ar ? "اكتب رقم عملية كليك." : "Enter the CliQ transfer reference.");
      return;
    }
    onPaid({ method: "cliq", ref: clean, period, plan });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1c305c]/45 px-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pay-title" className="font-display text-2xl text-ink">{ar ? "الدفع" : "Payment"}</h2>
            <p className="text-sm text-mute">{amount}</p>
          </div>
          <button type="button" aria-label={ar ? "إغلاق" : "Close"} onClick={onClose} className="grid size-9 place-items-center rounded-full text-lg hover:bg-cream">
            ×
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mute">
          {ar
            ? "دفعة واحدة، بلا تجديد تلقائي. لا نأخذ بيانات البطاقة هنا. الدفع يتم على صفحة البنك، أو بتحويل كليك، والحساب يبقى بانتظار التأكيد."
            : "One payment, no auto-renew. Card details are not typed here. Checkout opens on the bank’s page, or you pay by CliQ. The plan stays pending until we confirm it."}
        </p>
        <div className="mt-4 flex gap-2" role="group" aria-label={ar ? "مدة الفاتورة" : "Billing period"}>
          {(["monthly", "yearly"] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={period === id}
              onClick={() => setPeriod(id)}
              className={`h-10 flex-1 rounded-md border text-sm font-semibold ${period === id ? "border-ink bg-ink text-cream" : "border-line"}`}
            >
              {id === "monthly" ? (ar ? "شهري" : "Monthly") : ar ? "سنوي" : "Yearly"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-mute">
          {ar ? "المدة تُحفظ لخصم سنوي لاحقاً. لا يوجد تجديد تلقائي." : "The period is saved for a later yearly discount. Nothing renews on its own."}
        </p>
        <button
          type="button"
          onClick={() => onPaid({ method: "card", ref: "hosted-checkout", period, plan })}
          className="mt-4 h-12 w-full rounded-md bg-ink font-semibold text-cream"
        >
          {ar ? "المتابعة إلى صفحة البنك" : "Continue to bank checkout"}
        </button>
        <p className="mt-1 text-xs text-mute">{ar ? "ستفتح صفحة الدفع الخاصة بالبنك. لا نحتفظ برقم البطاقة." : "This will open the bank’s hosted checkout. We never keep the card number."}</p>
        <form className="mt-5 border-t border-line pt-4" onSubmit={payCliq}>
          <h3 className="text-sm font-semibold">{ar ? "ادفع بكليك" : "Pay with CliQ"}</h3>
          <p className="mt-1 text-sm text-ink">
            {ar ? "الاسم على كليك" : "CliQ alias"}: <b>{CLIQ_ALIAS}</b>
          </p>
          <label className="mt-3 block text-sm font-semibold">
            {ar ? "رقم عملية التحويل" : "Transfer reference"}
            <input
              value={ref}
              onChange={(event) => setRef(event.target.value)}
              autoComplete="off"
              className="mt-1 h-11 w-full rounded-md border border-line px-3 font-normal outline-none focus:border-ink"
            />
          </label>
          {error && <p className="mt-2 text-sm text-red" role="alert">{error}</p>}
          <button type="submit" className="mt-3 h-11 w-full rounded-md border border-ink text-sm font-semibold">
            {ar ? "أرسلت تحويل كليك" : "I've sent the CliQ transfer"}
          </button>
        </form>
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          <button type="button" onClick={onClose} className="h-11 rounded-md border border-line text-sm font-semibold">
            {ar ? "رجوع للخطط" : "Back to plans"}
          </button>
          <button type="button" onClick={onFree} className="text-sm font-semibold text-ink underline">
            {ar ? "ابدأ بالمجاني بدلاً من ذلك" : "Start with Free instead"}
          </button>
        </div>
      </div>
    </div>
  );
}
