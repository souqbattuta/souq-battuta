/** Short bilingual notice. The About section keeps the full AnimalRule. */
export function AnimalSaleNotice() {
  return (
    <div className="animal-sale-notice" role="note">
      <p lang="en">Animal sales are prohibited. Adopt, don't shop.</p>
      <p lang="ar" dir="rtl">بيع الحيوانات غير مسموح. التبني أولاً.</p>
      <p lang="en">Hand-reared birds may be sold. Other animals may not.</p>
      <p lang="ar" dir="rtl">بيع الطيور المرباة باليد مسموح. بيع غيرها من الحيوانات غير مسموح.</p>
    </div>
  );
}
