import { createFileRoute } from "@tanstack/react-router";
import { adminHead } from "@/lib/supabase/cms";
import { PageHeader, EmptyState } from "@/components/admin/cms";

export const Route = createFileRoute("/control-centre/_admin/admin-users")({
  head: () => adminHead("Admin users"),
  component: AdminUsers,
});

function AdminUsers() {
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="System" title="Admin users" description="Managing who can access the Control Centre is coming in a later phase." />
      <EmptyState>For now, admin access is granted directly in Supabase.</EmptyState>
    </div>
  );
}
