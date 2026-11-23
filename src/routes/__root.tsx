import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { KeepPlace } from "@/components/keep-place";
import { useSession } from "@/lib/session";
import { usePageLang } from "@/lib/page-lang";
import {
  DUCK_LOGO,
  HOME_DESCRIPTION,
  HOME_TITLE,
  PUBLIC_CATEGORIES,
  TAGLINE_AR,
  TAGLINE_EN,
  canonicalUrl,
  explicitLang,
  homeJsonLd,
  isPrivatePath,
  languageLinks,
  pageLangOf,
  shareMeta,
} from "@/lib/site";
import appCss from "../styles.css?url";
import fontsCss from "../fonts.css?url";

const APP_NAME = "Souq Battuta";

const PAGE_COPY: Record<string, [string, string, string]> = {
  "/home": ["Home | Souq Battuta", "Wander the souq. Shops chosen for you, new places, and what is near.", "تجوّل في السوق. دكاكين لك، أماكن جديدة، وما هو قريب."],
  "/discover": ["Explore | Souq Battuta", "Search shops on Souq Battuta.", "ابحث عن الدكاكين في سوق بطوطة."],
  "/hello": ["Hello, World! | Souq Battuta", "A note from a shop. It stays up for 24 hours from the time it was published.", "ملاحظة من دكان. تبقى ٢٤ ساعة من وقت النشر."],
  "/sign-in": ["Log in | Souq Battuta", "Log in to Souq Battuta as a buyer or a seller.", "ادخل إلى سوق بطوطة كزبون أو كبائع."],
  "/forgot": ["Reset password | Souq Battuta", "Set a new Souq Battuta password with a WhatsApp code.", "كلمة مرور جديدة لسوق بطوطة برمز واتساب."],
  "/join": ["Create an account | Souq Battuta", "Join Souq Battuta as a buyer or a seller.", "انضم إلى سوق بطوطة كزبون أو كبائع."],
  "/join/buyer": ["Buyer account | Souq Battuta", "Create a buyer account on Souq Battuta.", "أنشئ حساب زبون في سوق بطوطة."],
  "/join/seller": ["Seller account | Souq Battuta", "Open a shop on Souq Battuta.", "افتح دكاناً في سوق بطوطة."],
  "/sell": ["For sellers | Souq Battuta", "Plans for sellers on Souq Battuta. You keep the customer.", "خطط البائعين في سوق بطوطة. الزبون يبقى لك."],
  "/privacy": ["Privacy | Souq Battuta", "How Souq Battuta handles your account, orders, and reviews.", "كيف يتعامل سوق بطوطة مع حسابك وطلباتك وتقييماتك."],
  "/rules": ["Rules | Souq Battuta", "Souq Battuta rules, including animal sales.", "قواعد سوق بطوطة، بما فيها بيع الحيوانات."],
  "/contact": ["Contact | Souq Battuta", "Write to Souq Battuta from the site.", "راسل سوق بطوطة من الموقع."],
  "/advertise": ["Advertise | Souq Battuta", "Advertise on Souq Battuta.", "أعلن في سوق بطوطة."],
  "/checklist": ["Test list | Souq Battuta", "A checklist for friends testing Souq Battuta.", "قائمة لمن يجرّب سوق بطوطة."],
  "/desk": ["The Souq | Souq Battuta", "The Souq Battuta desk.", "مكتب سوق بطوطة."],
  "/shelf": ["More shops | Souq Battuta", "More shops from a home or category shelf.", "دكاكين أكثر من رف البيت أو الصنف."],
  "/account": ["Your account | Souq Battuta", "Your Souq Battuta account.", "حسابك في سوق بطوطة."],
  "/seller": ["My shop | Souq Battuta", "Your shop on Souq Battuta.", "دكانك في سوق بطوطة."],
  "/inbox": ["Inbox | Souq Battuta", "Messages on Souq Battuta.", "رسائل سوق بطوطة."],
  "/welcome": ["Welcome | Souq Battuta", "Welcome to Souq Battuta.", "أهلاً بك في سوق بطوطة."],
  "/otp": ["Code | Souq Battuta", "Enter the code to finish joining Souq Battuta.", "أدخل الرمز لإكمال الانضمام إلى سوق بطوطة."],
  "/join/seller/plan": ["Seller plan | Souq Battuta", "Choose a seller plan on Souq Battuta.", "اختر خطة البائع في سوق بطوطة."],
};

function describe(path: string, lang: "en" | "ar") {
  if (path === "/" || path === "/home") {
    return { title: HOME_TITLE, description: lang === "ar" ? `${TAGLINE_AR} ${TAGLINE_EN}` : HOME_DESCRIPTION };
  }
  const known = PAGE_COPY[path] ?? PAGE_COPY[path.replace(/\/$/, "")];
  if (known) return { title: known[0], description: lang === "ar" ? known[2] : known[1] };
  if (path.startsWith("/category/")) {
    const id = decodeURIComponent(path.split("/")[2] || "");
    const category = PUBLIC_CATEGORIES.find((item) => item.id === id);
    if (!category) return { title: "Aisle | Souq Battuta", description: lang === "ar" ? "هذا الممر غير مفتوح." : "This aisle is not open." };
    const name = lang === "ar" ? category.ar : category.en;
    return { title: `${name} | Souq Battuta`, description: lang === "ar" ? `دكاكين ${category.ar} في سوق بطوطة.` : `${category.en} shops on Souq Battuta.` };
  }
  if (path.startsWith("/buyer/")) {
    const name = decodeURIComponent(path.split("/")[2] || "buyer");
    return { title: `@${name} | Souq Battuta`, description: `${name} on Souq Battuta.` };
  }
  return { title: `${APP_NAME} | Souq Battuta`, description: lang === "ar" ? TAGLINE_AR : TAGLINE_EN };
}

function LangMirror() {
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  const setLang = useSession((state) => state.setLang);
  const urlLang = explicitLang(searchStr);
  useEffect(() => {
    if (urlLang) setLang(urlLang);
  }, [setLang, urlLang]);
  return null;
}

function Document() {
  const lang = usePageLang();
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <LangMirror />
        <PreviewHostBridge />
        <KeepPlace />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRoute({
  head: ({ matches }) => {
    const path = matches[matches.length - 1]?.pathname ?? "/";
    const lang = pageLangOf(matches[matches.length - 1]?.search);
    const shopPath = path.startsWith("/shop/");
    const priv = isPrivatePath(path);
    const home = path === "/" || path === "/home";
    const info = shopPath ? null : describe(path, lang);
    const canonical = shopPath || priv ? "" : canonicalUrl(path, lang);
    const landing = path === "/";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...(info ? [{ title: info.title }, { name: "description", content: info.description }] : []),
        { name: "theme-color", content: "#1C305C" },
        { name: "application-name", content: APP_NAME },
        { name: "robots", content: priv ? "noindex, nofollow" : "index, follow" },
        ...(info && !priv ? shareMeta(info.title, info.description, canonical, DUCK_LOGO) : []),
        ...(home && !priv ? [{ "script:ld+json": homeJsonLd() } as any] : []),
      ],
      links: [
        ...(canonical ? [{ rel: "canonical" as const, href: canonical }] : []),
        ...(!priv ? languageLinks(path) : []),
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        ...(landing ? [] : [{ rel: "stylesheet", href: appCss }]),
        { rel: "stylesheet", href: fontsCss },
        { rel: "manifest", href: "/__grok/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      ],
    };
  },
  component: Document,
});
