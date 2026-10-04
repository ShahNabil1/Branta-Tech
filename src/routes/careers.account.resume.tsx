import { createFileRoute } from "@tanstack/react-router";
import { ComingNext } from "@/components/applicant/ComingNext";

export const Route = createFileRoute("/careers/account/resume")({
  component: () => <ComingNext title="Resume" text="You'll be able to keep your CV here, ready for any application." />,
});
