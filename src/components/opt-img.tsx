import type { CSSProperties } from "react";
import { BRAND } from "@/lib/brand-manifest";

export function OptImg({
  src,
  alt = "",
  className,
  eager = false,
  width,
  height,
  sizes,
  style,
  draggable,
}: {
  src: string;
  alt?: string;
  className?: string;
  eager?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  style?: CSSProperties;
  draggable?: boolean;
}) {
  const asset = BRAND[src.split("?")[0]];
  const lazy = eager ? "eager" : "lazy";
  if (!asset) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        width={width}
        height={height}
        style={style}
        draggable={draggable}
        loading={lazy}
        decoding="async"
      />
    );
  }
  return (
    <picture className="opt-pic">
      <source type="image/avif" srcSet={asset.avif} sizes={sizes ?? asset.sizes} />
      <source type="image/webp" srcSet={asset.webp} sizes={sizes ?? asset.sizes} />
      <img
        src={asset.src}
        alt={alt}
        className={className}
        width={width ?? asset.w}
        height={height ?? asset.h}
        style={style}
        draggable={draggable}
        loading={lazy}
        decoding="async"
      />
    </picture>
  );
}
