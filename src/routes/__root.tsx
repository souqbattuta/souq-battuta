import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { preconnect } from "react-dom";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { KeepPlace } from "@/components/keep-place";
import appCss from "../styles.css?url";

const APP_NAME = "Souq Battuta";
const SITE = "https://wave-sage-hill-pepper.grok.me";
const FONT =
  "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap";

const PAGE_COPY: Record<string, [string, string]> = {
  "/": ["Souq Battuta", "Amman first. Sellers keep the customer."],
  "/home": ["Home · Souq Battuta", "Wander the souq. Stalls chosen for you, new places, and what is near."],
  "/discover": ["Discover · Souq Battuta", "Search stalls on Souq Battuta."],
  "/hello": ["Hello, World! · Souq Battuta", "A daily note from the souq. Up at 12, gone at 12."],
  "/sign-in": ["Log in · Souq Battuta", "Log in to Souq Battuta as a buyer or a seller."],
  "/join": ["Create an account · Souq Battuta", "Join Souq Battuta as a buyer or a seller."],
  "/join/buyer": ["Buyer account · Souq Battuta", "Create a buyer account on Souq Battuta."],
  "/join/seller": ["Seller account · Souq Battuta", "Open a stall on Souq Battuta."],
  "/sell": ["For sellers · Souq Battuta", "Plans for sellers on Souq Battuta. You keep the customer."],
  "/privacy": ["Privacy · Souq Battuta", "How Souq Battuta handles your account, orders, and reviews."],
  "/contact": ["Contact · Souq Battuta", "Write to Souq Battuta from the site."],
  "/advertise": ["Advertise · Souq Battuta", "Advertise on Souq Battuta."],
  "/checklist": ["Test list · Souq Battuta", "A checklist for friends testing Souq Battuta."],
  "/desk": ["Souq desk · Souq Battuta", "The Souq Battuta desk."],
  "/shelf": ["More stalls · Souq Battuta", "More stalls from a home or category shelf."],
  "/account": ["Your account · Souq Battuta", "Your Souq Battuta account."],
  "/seller": ["Seller desk · Souq Battuta", "Your stall desk on Souq Battuta."],
  "/inbox": ["Inbox · Souq Battuta", "Messages on Souq Battuta."],
  "/welcome": ["Welcome · Souq Battuta", "Welcome to Souq Battuta."],
  "/otp": ["Code · Souq Battuta", "Enter the code to finish joining Souq Battuta."],
};

function describe(path: string) {
  const known = PAGE_COPY[path] ?? PAGE_COPY[path.replace(/\/$/, "")];
  if (known) return { title: known[0], description: known[1] };
  if (path.startsWith("/category/")) {
    const id = decodeURIComponent(path.split("/")[2] || "Aisle");
    const name = id.charAt(0).toUpperCase() + id.slice(1);
    return { title: `${name} · Souq Battuta`, description: `${name} stalls on Souq Battuta.` };
  }
  if (path.startsWith("/shop/")) {
    const name = decodeURIComponent(path.split("/")[2] || "Stall").replace(/-/g, " ");
    return { title: `${name} · Souq Battuta`, description: `Visit ${name} on Souq Battuta.` };
  }
  if (path.startsWith("/buyer/")) {
    const name = decodeURIComponent(path.split("/")[2] || "buyer");
    return { title: `@${name} · Souq Battuta`, description: `${name} on Souq Battuta.` };
  }
  return { title: APP_NAME, description: "Amman first. Sellers keep the customer." };
}

export const Route = createRootRoute({
  head: ({ matches }) => {
    const path = matches[matches.length - 1]?.pathname ?? "/";
    const landing = path === "/";
    const info = describe(path);
    const canonical = `${SITE}${path === "/" ? "/" : path}`;
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: info.title },
        { name: "theme-color", content: "#1C305C" },
        { name: "description", content: info.description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: info.title },
        { property: "og:description", content: info.description },
        { property: "og:url", content: canonical },
        { property: "og:image", content: "/brand/og-image.jpg" },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: info.title },
        { name: "twitter:description", content: info.description },
        { name: "twitter:image", content: "/brand/og-image.jpg" },
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        ...(landing ? [] : [{ rel: "stylesheet", href: appCss }]),
        { rel: "manifest", href: "/__grok/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
        { rel: "stylesheet", href: FONT },
      ],
    };
  },
  component: () => {
    preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });
    preconnect("https://fonts.googleapis.com");
    return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <KeepPlace />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
    );
  },
});
