import { createFileRoute } from "@tanstack/react-router";
import { adminHead } from "@/lib/supabase/cms";
import { ProjectEditorLoader } from "@/components/admin/ProjectEditor";

export const Route = createFileRoute("/control-centre/_admin/portfolio/projects/$id")({
  head: () => adminHead("Edit project"),
  component: EditProject,
});

function EditProject() {
  const { id } = Route.useParams();
  return <ProjectEditorLoader id={id} />;
}
