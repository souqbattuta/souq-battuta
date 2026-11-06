import { createFileRoute, Link } from "@tanstack/react-router";
import landingCss from "../landing.css?url";
import desktopLandingLock from "../desktop-landing.lock.css?url";

const PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const poster = {
  deskAvif: "/brand/h/landing-desktop-800.7a5ff5dbb5.avif 800w, /brand/h/landing-desktop.ab63abf19c.avif 1600w",
  deskWebp: "/brand/h/landing-desktop-800.16fc4d2e5b.webp 800w, /brand/h/landing-desktop.895041c600.webp 1600w",
  deskJpg: "/brand/h/landing-desktop-800.e188247166.jpg 800w, /brand/h/landing-desktop.cefdd38b76.jpg 1600w",
  phoneAvif: "/brand/h/landing-mobile.04dfc2037e.avif",
  phoneWebp: "/brand/h/landing-mobile.9995255240.webp",
  phoneJpg: "/brand/h/landing-mobile.f2875738ab.jpg",
};

export const Route = createFileRoute("/")({
  head: () => ({
    links: [
      { rel: "stylesheet", href: landingCss },
      { rel: "stylesheet", href: desktopLandingLock },
      {
        rel: "preload",
        as: "image",
        href: "/brand/h/landing-desktop.ab63abf19c.avif",
        type: "image/avif",
        media: "(min-width:641px)",
        fetchPriority: "high",
      },
      {
        rel: "preload",
        as: "image",
        href: poster.phoneAvif,
        type: "image/avif",
        media: "(max-width:640px)",
        fetchPriority: "high",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="landing-stage">
      <main className="landing-fit">
        <h1 className="sr-only">
          <span lang="en">Souq Battuta</span> <span lang="ar">سوق بطوطة</span> – Amman marketplace
        </h1>
        <div className="landing-poster" dir="ltr">
          <picture className="landing-hero">
            <source media="(min-width:641px)" type="image/avif" srcSet={poster.deskAvif} sizes="(min-width:1152px) 1152px, 100vw" />
            <source media="(min-width:641px)" type="image/webp" srcSet={poster.deskWebp} sizes="(min-width:1152px) 1152px, 100vw" />
            <source media="(min-width:641px)" type="image/jpeg" srcSet={poster.deskJpg} sizes="(min-width:1152px) 1152px, 100vw" />
            <source media="(max-width:640px)" type="image/avif" srcSet={poster.phoneAvif} />
            <source media="(max-width:640px)" type="image/webp" srcSet={poster.phoneWebp} />
            <source media="(max-width:640px)" type="image/jpeg" srcSet={poster.phoneJpg} />
            <img
              className="landing-art-wide"
              src={PIXEL}
              width={1600}
              height={1078}
              alt="سوق بطوطة Souq Battuta"
              draggable={false}
              fetchPriority="high"
            />
          </picture>
          <Link to="/sign-in" search={{ next: "/home" }} className="signin-stamp" aria-label="تسجيل الدخول / Log in">
            <picture>
              <source srcSet="/brand/h/login-stamp-navy.4d8c143511.avif" type="image/avif" />
              <source srcSet="/brand/h/login-stamp-navy.38c86491e9.webp" type="image/webp" />
              <source srcSet="/brand/h/login-stamp-navy.6bea708315.png" type="image/png" />
              <img className="login-ticket" src={PIXEL} width={420} height={186} alt="" />
            </picture>
          </Link>
          <Link
            to="/join"
            search={{ intent: "buyer" }}
            className="stamp-hit stamp-join"
            style={{ left: "21.8%", top: "82%", width: "17%", height: "12.5%" }}
            aria-label="انضم لسرب بطوطة / Join the Battuta Flock"
          >
            <picture>
              <source srcSet="/brand/h/stamp-join.7a273e3fb1.avif" type="image/avif" />
              <source srcSet="/brand/h/stamp-join.00c5a76269.webp" type="image/webp" />
              <source srcSet="/brand/h/stamp-join.076dc38cea.png" type="image/png" />
              <img className="stamp-art" src={PIXEL} width={800} height={352} alt="" />
            </picture>
            <span className="pointer-events-auto absolute inset-0" aria-hidden="true" />
            <span className="stamp-tip" role="tooltip" aria-hidden="true">
              <span className="font-arabic" lang="ar">تسجيل</span>
              <span className="font-display" lang="en">Sign up</span>
            </span>
          </Link>
          <Link to="/home" className="stamp-hit stamp-discover" style={{ left: "63.8%", top: "82%", width: "20.7%", height: "12.5%" }} aria-label="Explore the Souq">
            <picture>
              <source srcSet="/brand/h/stamp-discover.a1727f2731.avif" type="image/avif" />
              <source srcSet="/brand/h/stamp-discover.0cc148c1e7.webp" type="image/webp" />
              <source srcSet="/brand/h/stamp-discover.9edf7485ee.png" type="image/png" />
              <img className="stamp-art" src={PIXEL} width={800} height={352} alt="" />
            </picture>
            <span className="pointer-events-auto absolute inset-0" aria-hidden="true" />
            <span className="stamp-tip" role="tooltip" aria-hidden="true">
              <span className="font-arabic" lang="ar">تخطَّ التسجيل</span>
              <span className="font-display" lang="en">Skip sign up</span>
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
