import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

export function PageHeader({
  title,
  breadcrumb,
}: {
  title: string;
  breadcrumb: BreadcrumbItem[];
}) {
  const today = new Date().toLocaleDateString("en-IE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
          {breadcrumb.map((item, i) => (
            <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300">•</span>}
              {item.href ? (
                <Link href={item.href} className="transition-colors hover:text-slate-600">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </span>
          ))}
        </p>
      </div>
      <p className="text-sm text-slate-500">{today}</p>
    </div>
  );
}
