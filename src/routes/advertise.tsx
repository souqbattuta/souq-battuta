import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/site-header";
import { AdvertiseBar } from "@/components/hello-board";

export const Route = createFileRoute("/advertise")({ component: AdvertisePage });

function AdvertisePage() {
  return (
    <Shell>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <AdvertiseBar />
      </main>
    </Shell>
  );
}
