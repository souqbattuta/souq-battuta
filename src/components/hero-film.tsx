import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

const DESK_SRC = "/brand/hero/storyboard-desktop.mp4";
const PHONE_SRC = "/brand/hero/storyboard-mobile.mp4";
const DESK_POSTER = "/brand/hero/storyboard-desktop-poster.jpg";
const PHONE_POSTER = "/brand/hero/storyboard-mobile-poster.jpg";

const NARROW = "(max-width: 760px)";

function sameSource(video: HTMLVideoElement, src: string) {
  const current = video.currentSrc || video.getAttribute("src") || "";
  return current.endsWith(src);
}

function release(video: HTMLVideoElement | null) {
  if (!video) return;
  video.pause();
  video.muted = true;
  if (video.getAttribute("src") || video.currentSrc) {
    video.removeAttribute("src");
    video.load();
  }
}

/**
 * Homepage hero. One file per orientation; sound is a track in that same file.
 * The sound control only flips `muted` — it never swaps videos.
 */
export function HeroFilm() {
  const rootRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLVideoElement>(null);
  const phoneRef = useRef<HTMLVideoElement>(null);
  const soundRef = useRef(false);
  const holdRef = useRef(false);
  const [sound, setSound] = useState(false);
  const [paused, setPaused] = useState(true);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const hero = rootRef.current?.closest(".home-story-hero");
    const header = document.querySelector("header.site-banner");
    if (!(hero instanceof HTMLElement) || !(header instanceof HTMLElement)) return;

    let last = "";
    const apply = () => {
      const top = Math.max(0, Math.round(hero.getBoundingClientRect().top + window.scrollY));
      const next = `calc(100svh - ${top}px)`;
      if (next === last) return;
      last = next;
      hero.style.setProperty("--home-story-cap", next);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  const active = () => {
    const phone = window.matchMedia(NARROW).matches;
    return {
      phone,
      src: phone ? PHONE_SRC : DESK_SRC,
      video: phone ? phoneRef.current : deskRef.current,
    };
  };

  const begin = (video: HTMLVideoElement, src: string) => {
    if (!sameSource(video, src)) video.src = src;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.loop = true;
    video.muted = !soundRef.current;
    if (soundRef.current) video.volume = 1;
    const pending = video.play();
    pending?.catch(() => {
      holdRef.current = true;
      setPaused(true);
      setReady(false);
    });
  };

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) holdRef.current = true;

    const sync = () => {
      const phone = mq.matches;
      release(phone ? deskRef.current : phoneRef.current);
      setReady(false);
      const video = phone ? phoneRef.current : deskRef.current;
      if (!video || holdRef.current) return;
      begin(video, phone ? PHONE_SRC : DESK_SRC);
    };

    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const togglePlay = () => {
    const { video, src } = active();
    if (!video) return;
    if (!video.paused && sameSource(video, src)) {
      holdRef.current = true;
      video.pause();
      setPaused(true);
      return;
    }
    holdRef.current = false;
    begin(video, src);
  };

  const toggleSound = () => {
    const next = !soundRef.current;
    soundRef.current = next;
    setSound(next);
    const { video, src } = active();
    if (!video || !sameSource(video, src)) return;
    video.muted = !next;
    if (next) video.volume = 1;
  };

  return (
    <div ref={rootRef} className={`hero-film${ready ? " is-ready" : ""}`}>
      <div className="home-story-stage">
        <img className="hero-film__still hero-film__desk" src={DESK_POSTER} width={1920} height={1080} alt="" />
        <img className="hero-film__still hero-film__phone" src={PHONE_POSTER} width={1080} height={1920} alt="" />
        <video
          ref={deskRef}
          className="hero-film__video hero-film__desk"
          poster={DESK_POSTER}
          playsInline
          loop
          preload="none"
          width={1920}
          height={1080}
          aria-label="Souq Battuta. سوق بطوطة مختلف."
          onPlaying={() => {
            setReady(true);
            setPaused(false);
          }}
        />
        <video
          ref={phoneRef}
          className="hero-film__video hero-film__phone"
          poster={PHONE_POSTER}
          playsInline
          loop
          preload="none"
          width={1080}
          height={1920}
          aria-label="Souq Battuta. سوق بطوطة مختلف."
          onPlaying={() => {
            setReady(true);
            setPaused(false);
          }}
        />
        <div className="home-story-controls">
          <button
            type="button"
            className="home-story-btn"
            onClick={togglePlay}
            aria-label={paused ? "تشغيل. Play." : "إيقاف. Pause."}
          >
            {paused ? <PlayMark /> : <PauseMark />}
          </button>
          <button
            type="button"
            className={`home-story-btn${sound ? " is-on" : ""}`}
            onClick={toggleSound}
            aria-pressed={sound}
            aria-label={sound ? "كتم الصوت. Mute." : "تشغيل الصوت. Play sound."}
          >
            <SoundMark on={sound} />
          </button>
        </div>
      </div>
      <Link to="/join" className="home-story-join">
        <span lang="ar">انضم مجاناً الآن</span>
        <span lang="en">Join for free now</span>
      </Link>
    </div>
  );
}

function PauseMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M3.5 2.2h3v11.6h-3zm6 0h3v11.6h-3z" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M4 2.2v11.6L13.4 8z" />
    </svg>
  );
}

function SoundMark({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 9.5h3.2L12 5.2v13.6l-4.8-4.3H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z" />
      {on ? (
        <path fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" d="M15.2 9.2a3.6 3.6 0 0 1 0 5.6M17.6 7a6.2 6.2 0 0 1 0 10" />
      ) : (
        <path fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" d="M16 10l5 5M21 10l-5 5" />
      )}
    </svg>
  );
}
