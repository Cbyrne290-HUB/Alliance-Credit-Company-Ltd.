import { PageHeader } from "@/components/layout/page-header";

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Users"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Users" }]}
      />
      <div className="flex items-center justify-center px-4 py-24">
        <p className="text-lg font-medium text-slate-700">
          Users - coming soon
        </p>
      </div>
    </>
  );
}
