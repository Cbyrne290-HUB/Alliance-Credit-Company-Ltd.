import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { CustomerDocuments } from "@/components/customers/customer-documents";
import { DOCUMENT_FIELDS, DOCUMENTS_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/documents";
import type { Customer } from "@/types/customer";
import type { Loan } from "@/types/loan";
import { DeleteCustomerButton } from "./delete-customer-button";

function LoanStatusPill({ loan }: { loan: Loan }) {
  if (loan.status === "cleared") {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Cleared
      </span>
    );
  }
  if ((loan.arrears ?? 0) > 0) {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        Arrears
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      Active
    </span>
  );
}

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("agent", activeAgent)
    .single();

  const customer = data as Customer | null;

  if (!customer) notFound();

  const { data: loansData } = await supabase
    .from("loans")
    .select("*")
    .eq("customer_id", id)
    .eq("agent", activeAgent)
    .order("created_at", { ascending: false });

  const loans = (loansData ?? []) as Loan[];
  const fullName = `${customer.first_name} ${customer.surname}`;

  const initialDocuments = await Promise.all(
    DOCUMENT_FIELDS.map(async (field) => {
      const path = customer[field.column];
      let signedUrl: string | null = null;

      if (path) {
        const { data: signedData } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        signedUrl = signedData?.signedUrl ?? null;
      }

      return { ...field, path, signedUrl };
    }),
  );

  const details = [
    { label: "Account Number", value: customer.account_number },
    { label: "Date of Birth", value: formatDate(customer.date_of_birth) },
    { label: "Address", value: customer.address ?? "—" },
    { label: "Eircode", value: customer.eircode ?? "—" },
    { label: "Phone", value: customer.phone ?? "—" },
    { label: "PPSN", value: customer.ppsn ?? "—" },
  ];

  return (
    <>
      <PageHeader
        title={fullName}
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Customers", href: "/customers" },
          { label: fullName },
        ]}
      />
      <div className="px-8 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex justify-end gap-2">
            <Link
              href={`/customers/${customer.id}/edit`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Edit
            </Link>
            <DeleteCustomerButton customerId={customer.id} customerName={fullName} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-4">
              <Avatar name={fullName} />
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                {fullName}
              </h1>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {details.map((d) => (
                <div key={d.label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {d.label}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Documents
            </h2>
            <div className="mt-4">
              <CustomerDocuments
                customerId={customer.id}
                initialDocuments={initialDocuments}
              />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Loans
              </h2>
              <Link
                href={`/customers/${customer.id}/loans/new`}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
              >
                Create New Loan
              </Link>
            </div>

            {loans.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Loans will appear here.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {loans.map((loan) => (
                  <Link
                    key={loan.id}
                    href={`/loans/${loan.id}`}
                    className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 transition-colors hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {loan.loan_reference}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatCurrency(loan.principal)} borrowed · Balance{" "}
                        {formatCurrency(loan.balance)}
                      </p>
                    </div>
                    <LoanStatusPill loan={loan} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
