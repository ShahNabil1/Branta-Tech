import { createFileRoute } from "@tanstack/react-router";
import { ComingNext } from "@/components/applicant/ComingNext";

export const Route = createFileRoute("/careers/account/interviews")({
  component: () => <ComingNext title="Interviews" text="Interview invitations and times will appear here." />,
});
