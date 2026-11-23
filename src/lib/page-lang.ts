import { useRouterState } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { explicitLang } from "@/lib/site";

/** URL language wins so `?lang=ar` matches the server HTML. Otherwise the saved choice. */
export function usePageLang(): "en" | "ar" {
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  const sessionLang = useSession((state) => state.lang);
  return explicitLang(searchStr) ?? (sessionLang === "ar" ? "ar" : "en");
}
