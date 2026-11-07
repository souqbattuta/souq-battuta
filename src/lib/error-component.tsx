import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center text-zinc-900">
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-zinc-500">{errorMessage(error)}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/home"
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-zinc-900 px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          <span>Back home</span>
          <span lang="ar" dir="rtl">الرجوع للرئيسية</span>
        </Link>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
        >
          <span>Try again</span>
          <span lang="ar" dir="rtl">حاول مرة أخرى</span>
        </button>
      </div>
    </main>
  );
}