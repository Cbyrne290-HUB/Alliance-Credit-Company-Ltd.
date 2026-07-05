import { PageHeader } from "@/components/layout/page-header";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Reports" }]}
      />
      <div className="flex items-center justify-center px-4 py-24">
        <p className="text-lg font-medium text-slate-700">
          Reports - coming soon
        </p>
      </div>
    </>
  );
}
