import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { OptImg } from "@/components/opt-img";

export type Frame = { x: number; y: number; scale: number };

const CENTER: Frame = { x: 50, y: 50, scale: 1 };

function keyOf(id: string) {
  return `souq-frame:${id}`;
}

export function readFrame(id: string): Frame {
  try {
    const raw = localStorage.getItem(keyOf(id));
    if (!raw) return CENTER;
    const parsed = JSON.parse(raw) as Frame;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return CENTER;
    return { x: parsed.x, y: parsed.y, scale: parsed.scale || 1 };
  } catch {
    return CENTER;
  }
}

export function readSrc(id: string, fallback: string) {
  try {
    return localStorage.getItem(`souq-src:${id}`) || fallback;
  } catch {
    return fallback;
  }
}

export function saveSrc(id: string, src: string) {
  if (src.startsWith("data:image")) return;
  try {
    localStorage.setItem(`souq-src:${id}`, src);
  } catch {
    /* preview storage can fill up on a very large photo */
  }
}

export function saveFrame(id: string, frame: Frame) {
  try {
    localStorage.setItem(keyOf(id), JSON.stringify(frame));
  } catch {
    /* a full browser store should not break the page */
  }
}

export function FramedImage({
  src,
  frameId,
  className,
  alt = "",
}: {
  src: string;
  frameId: string;
  className?: string;
  alt?: string;
}) {
  const [frame, setFrame] = useState<Frame>(CENTER);
  const [shown, setShown] = useState(src);
  useEffect(() => {
    setFrame(readFrame(frameId));
    const stored = readSrc(frameId, "");
    const generic = !src || src.includes("/brand/avatars/");
    setShown(generic && stored ? stored : src);
  }, [frameId, src]);
  return (
    <OptImg
      src={shown}
      alt={alt}
      className={cn("object-cover", className)}
      style={{
        objectPosition: `${frame.x}% ${frame.y}%`,
        transform: frame.scale > 1 ? `scale(${frame.scale})` : undefined,
      }}
    />
  );
}

export function PhotoStudio({
  label,
  shape,
  src,
  frameId,
  onSrc,
}: {
  label: string;
  shape: "header" | "avatar";
  src: string;
  frameId: string;
  onSrc: (src: string) => void;
}) {
  const [frame, setFrame] = useState<Frame>(CENTER);
  const [shown, setShown] = useState(src);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  useEffect(() => {
    setFrame(readFrame(frameId));
    setShown(readSrc(frameId, src));
  }, [frameId, src]);

  function commit(next: Frame) {
    const clamped = {
      x: Math.min(100, Math.max(0, next.x)),
      y: Math.min(100, Math.max(0, next.y)),
      scale: Math.min(2.4, Math.max(1, next.scale)),
    };
    setFrame(clamped);
    saveFrame(frameId, clamped);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line bg-paper px-3 text-sm">
          Choose photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") {
                  saveSrc(frameId, reader.result);
                  onSrc(reader.result);
                }
                commit(CENTER);
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
      </div>
      <div
        className={cn(
          "relative mx-auto overflow-hidden bg-sand touch-none",
          shape === "header" ? "h-40 w-full rounded-xl sm:h-52" : "size-40 rounded-full",
        )}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, fx: frame.x, fy: frame.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const box = e.currentTarget.getBoundingClientRect();
          const dx = ((e.clientX - drag.current.x) / box.width) * 100;
          const dy = ((e.clientY - drag.current.y) / box.height) * 100;
          commit({ ...frame, x: drag.current.fx - dx, y: drag.current.fy - dy });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <img
          src={shown}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          width={640}
          height={640}
          className="h-full w-full object-cover"
          style={{
            objectPosition: `${frame.x}% ${frame.y}%`,
            transform: frame.scale > 1 ? `scale(${frame.scale})` : undefined,
          }}
        />
      </div>
      <label className="mt-3 flex items-center gap-3 text-xs text-mute">
        Zoom
        <input
          type="range"
          min={1}
          max={2.4}
          step={0.01}
          value={frame.scale}
          className="w-full accent-ink"
          onChange={(e) => commit({ ...frame, scale: Number(e.target.value) })}
        />
      </label>
      <button type="button" className="mt-2 h-10 text-sm font-semibold text-ink underline" onClick={() => commit(CENTER)}>
        Center
      </button>
    </div>
  );
}

export function SquareCrop({
  label,
  src,
  onPick,
  large,
  story,
}: {
  label: string;
  src: string | null;
  onPick: (url: string) => void;
  large?: boolean;
  story?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(src ?? "");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  function fitStory(dataUrl: string) {
    const image = new Image();
    image.onload = () => {
      const width = 720;
      const height = 1280;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#f4efe4";
      ctx.fillRect(0, 0, width, height);
      const scale = Math.min(width / image.width, height / image.height);
      const dw = image.width * scale;
      const dh = image.height * scale;
      ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
      onPick(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.src = dataUrl;
  }

  function save() {
    if (!file || !stage.current) return;
    const box = stage.current.getBoundingClientRect();
    const image = new Image();
    image.onload = () => {
      const size = 640;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const fit = Math.min(box.width / image.width, box.height / image.height) * zoom;
      const dw = image.width * fit;
      const dh = image.height * fit;
      const left = (box.width - dw) / 2 + pan.x;
      const top = (box.height - dh) / 2 + pan.y;
      const scale = size / box.width;
      ctx.fillStyle = "#f4efe4";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(image, left * scale, top * scale, dw * scale, dh * scale);
      onPick(canvas.toDataURL("image/jpeg", 0.72));
      setOpen(false);
    };
    image.src = file;
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">{label}</p>
      <div className={cn("relative overflow-hidden rounded-lg bg-paper", story ? "mx-auto aspect-[9/16] w-full max-w-[12rem]" : large ? "size-52" : "size-24")}>
        {src ? <img src={src} alt="" loading="lazy" decoding="async" width={640} height={640} className={cn("h-full w-full", story ? "object-contain" : "object-cover")} /> : <span className="flex h-full items-center justify-center px-2 text-center text-xs text-mute">{label}</span>}
      </div>
      {story && <p className="mt-2 text-sm text-mute">The whole photo is kept. Nothing is cut off. It is sized for a phone story.</p>}
      <div className="mt-2 flex gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line bg-paper px-3 text-sm">
          {src ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (!picked) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result !== "string") return;
                setFile(reader.result);
                setZoom(1);
                setPan({ x: 0, y: 0 });
                if (story) fitStory(reader.result);
                else setOpen(true);
              };
              reader.readAsDataURL(picked);
            }}
          />
        </label>
        {src && !story && (
          <button
            type="button"
            className="h-10 rounded-md border border-line px-3 text-sm"
            onClick={() => {
              setFile(src);
              setZoom(1);
              setPan({ x: 0, y: 0 });
              setOpen(true);
            }}
          >
            Edit
          </button>
        )}
      </div>
      {open && file && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl bg-cream p-4">
            <h3 className="font-display text-xl">{label}</h3>
            <p className="mt-1 text-sm text-mute">Drag the photo. Zoom out to see all of it, then crop the square.</p>
            <div
              ref={stage}
              className="relative mx-auto mt-3 size-72 overflow-hidden rounded-lg bg-sand touch-none"
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
            >
              <img
                src={file}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: `${zoom * 100}%`,
                  height: "auto",
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
                }}
              />
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm">
              Zoom
              <input type="range" min={0.4} max={3} step={0.01} value={zoom} className="w-full accent-ink" onChange={(e) => setZoom(Number(e.target.value))} />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="h-11 rounded-md border border-line px-4 text-sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="h-11 rounded-md bg-ink px-4 text-sm font-semibold text-cream" onClick={save}>
                Use photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}