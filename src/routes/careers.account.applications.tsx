import { createFileRoute } from "@tanstack/react-router";
import { ComingNext } from "@/components/applicant/ComingNext";

export const Route = createFileRoute("/careers/account/applications")({
  component: () => <ComingNext title="My Applications" text="You'll be able to follow every role you've applied for here." />,
});
