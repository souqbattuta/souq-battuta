/** Accessible name for a control that opens a shop or item photo. */
export function photoControlName(lang: "en" | "ar", seller: string, item?: string) {
  const who = seller.trim();
  const what = item?.trim();
  if (lang === "ar") return what ? `عرض صور ${who} ${what}` : `عرض صور ${who}`;
  return what ? `View ${who} ${what} photos` : `View ${who} photos`;
}
