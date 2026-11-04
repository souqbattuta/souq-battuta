import { PLANS, type PlanId } from "@/lib/data";
import { cn } from "@/lib/cn";

const CROWN_COLOR: Record<Exclude<PlanId, "free">, string> = {
  basic: "#e3b23c",
  grow: "#1f7a4d",
  premium: "#1c305c",
};

function crownMask(color: string) {
  return {
    backgroundColor: color,
    WebkitMaskImage: "url(/brand/crown-mark.png)",
    maskImage: "url(/brand/crown-mark.png)",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  } as const;
}

export function Crown({ plan, className }: { plan: PlanId; className?: string }) {
  if (plan === "free") return null;
  if (className?.includes("plan-badge")) {
    const plate = plan === "premium" ? "#e3b23c" : "#fffdf8";
    const ring = plan === "grow" ? "#1f7a4d" : plan === "premium" ? "#1c305c" : "#c4922a";
    return (
      <span
        aria-hidden="true"
        className={className}
        style={{ background: plate, boxShadow: `0 0 0 2px ${ring}, 0 2px 6px rgba(28, 48, 92, 0.28)` }}
      >
        <span className="plan-badge-mark" style={crownMask(CROWN_COLOR[plan])} />
      </span>
    );
  }
  if (plan === "premium") {
    const height = className?.match(/h-\S+/)?.[0] ?? "h-7";
    return (
      <span aria-hidden="true" className={cn("inline-grid aspect-square shrink-0 place-items-center rounded-full bg-[#e3b23c]", height)}>
        <span className="block h-[68%] w-[68%]" style={crownMask(CROWN_COLOR.premium)} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cn("inline-block h-7 w-8 shrink-0", className)} style={crownMask(CROWN_COLOR[plan])} />
  );
}

export function PlanStamp({ plan, className }: { plan: PlanId; className?: string }) {
  if (plan === "free" || !PLANS[plan]) return null;
  return <Crown plan={plan} className={className ?? "h-6 w-7"} />;
}