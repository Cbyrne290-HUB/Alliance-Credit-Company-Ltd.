import { PageHeader } from "@/components/layout/page-header";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Settings" }]}
      />
      <div className="flex items-center justify-center px-4 py-24">
        <p className="text-lg font-medium text-slate-700">
          Settings - coming soon
        </p>
      </div>
    </>
  );
}
