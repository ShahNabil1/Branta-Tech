import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/control-centre")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: () => <Outlet />,
});
