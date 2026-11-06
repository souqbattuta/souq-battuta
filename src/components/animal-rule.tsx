export function AnimalRule({ ar }: { ar: boolean }) {
  return (
    <p className="rounded-lg border border-line bg-cream px-4 py-3 text-sm leading-relaxed text-ink">
      {ar
        ? "بيع الحيوانات ممنوع على سوق بطوطة. أي منشور أو منتج يعرض حيواناً للبيع يُحذف، مهما كانت الخطة. تبنَّ، لا تشترِ. مستلزمات الحيوانات مثل الأكل والألعاب والأسرّة والطوق مسموحة."
        : "Selling animals is prohibited on Souq Battuta. Any post or listing offering animals for sale will be removed, regardless of subscription tier. Adopt, don’t shop. Pet accessories like food, toys, beds, and leashes are welcome."}
    </p>
  );
}
