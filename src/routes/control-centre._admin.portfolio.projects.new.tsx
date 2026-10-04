import { createFileRoute } from "@tanstack/react-router";
import { adminHead } from "@/lib/supabase/cms";
import { ProjectEditorLoader } from "@/components/admin/ProjectEditor";

export const Route = createFileRoute("/control-centre/_admin/portfolio/projects/new")({
  head: () => adminHead("New project"),
  component: NewProject,
});

function NewProject() {
  return <ProjectEditorLoader id={null} />;
}
