export function AnimalRule({ ar }: { ar: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-cream px-4 py-3 text-sm leading-relaxed text-ink">
      <p>
        {ar
          ? "بيع الحيوانات ممنوع على سوق بطوطة. أي منشور أو منتج يعرض حيواناً للبيع يُحذف، مهما كانت الخطة. تبنَّ، لا تشترِ. مستلزمات الحيوانات مثل الأكل والألعاب والأسرّة والطوق مسموحة."
          : "Selling animals is prohibited on Souq Battuta. Any post or listing offering animals for sale will be removed, regardless of subscription tier. Adopt, don’t shop. Pet accessories like food, toys, beds, and leashes are welcome."}
      </p>
      <p className="mt-2">
        {ar
          ? "يُستثنى من هذا المنع بيع الطيور المرباة باليد، وهو مسموح. بيع غيرها من الحيوانات غير مسموح."
          : "Hand-reared birds may be sold. Sale of other animals is not."}
      </p>
    </div>
  );
}
