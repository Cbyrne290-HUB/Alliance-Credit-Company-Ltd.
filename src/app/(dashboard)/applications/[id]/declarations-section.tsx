import type { ReactNode } from "react";
import {
  APP_CHECKBOXES,
  FCA0_DECLARATION_TEXT,
  GDPR_CHECKBOXES,
  INCOME_CHECKBOXES,
  PTC2_CERTIFY_BULLETS,
  PTC2_CERTIFY_INTRO,
  PTC2_CHECKBOXES,
  type DeclarationCheckboxItem,
  type DeclarationSignatureKey,
} from "@/lib/declarations";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ApplicationDeclarations, DeclarationCheckboxes } from "@/types/application";

function CheckboxList({
  items,
  answers,
}: {
  items: DeclarationCheckboxItem[];
  answers: DeclarationCheckboxes | undefined;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const checked = answers?.[item.key] === true;
        return (
          <li key={item.key}>
            {item.groupHeading && (
              <p className="mt-3 mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                {item.groupHeading}
              </p>
            )}
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <span
                aria-hidden
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                  checked
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white text-transparent"
                }`}
              >
                ✓
              </span>
              <span>{item.label}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SignatureImage({
  label,
  url,
  signedAt,
  onOpen,
}: {
  label: string;
  url: string | null;
  signedAt: string | null;
  onOpen: (label: string, url: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        {url ? (
          <button
            type="button"
            onClick={() => onOpen(label, url)}
            className="block h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className="h-full w-full object-contain" />
          </button>
        ) : (
          <div className="text-center text-xs text-slate-400">Not signed</div>
        )}
      </div>
      <span className="text-center text-xs text-slate-500">
        {label}
        {signedAt ? ` · Signed ${formatDate(signedAt)}` : ""}
      </span>
    </div>
  );
}

function PageBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  );
}

export function DeclarationsSection({
  declarations,
  signatureUrls,
  onOpenImage,
}: {
  declarations: ApplicationDeclarations | null;
  signatureUrls: Record<DeclarationSignatureKey, string | null>;
  onOpenImage: (label: string, url: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Signed Declarations
      </h2>

      {!declarations ? (
        <p className="mt-4 text-sm text-slate-400 italic">No signed declarations on file.</p>
      ) : (
        <div className="mt-4 space-y-5">
          <PageBlock title="FCA0 — Unsolicited Contact Declaration">
            <p className="text-sm whitespace-pre-wrap text-slate-700">{FCA0_DECLARATION_TEXT}</p>
            <SignatureImage
              label="Signature"
              url={signatureUrls.fca0}
              signedAt={declarations.fca0?.signed_at ?? null}
              onOpen={onOpenImage}
            />
          </PageBlock>

          <PageBlock title="Application Declaration">
            <CheckboxList items={APP_CHECKBOXES} answers={declarations.app?.checkboxes} />
            <SignatureImage
              label="Signature"
              url={signatureUrls.app}
              signedAt={declarations.app?.signed_at ?? null}
              onOpen={onOpenImage}
            />
          </PageBlock>

          <PageBlock title="Income & Expenditure Declaration">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Total Income", value: declarations.income?.total_income ?? null },
                {
                  label: "Total Expenditure",
                  value: declarations.income?.total_expenditure ?? null,
                },
                {
                  label: "Total Disposable Income",
                  value: declarations.income?.total_disposable_income ?? null,
                },
                {
                  label: "Affordable Weekly Payment",
                  value: declarations.income?.affordable_weekly_payment ?? null,
                },
              ].map((figure) => (
                <div key={figure.label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {figure.label}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {figure.value != null ? formatCurrency(figure.value) : "—"}
                  </dd>
                </div>
              ))}
            </dl>
            <CheckboxList items={INCOME_CHECKBOXES} answers={declarations.income?.checkboxes} />
            <SignatureImage
              label="Signature"
              url={signatureUrls.income}
              signedAt={declarations.income?.signed_at ?? null}
              onOpen={onOpenImage}
            />
          </PageBlock>

          <PageBlock title="GDPR & Marketing Consent">
            <CheckboxList items={GDPR_CHECKBOXES} answers={declarations.gdpr?.checkboxes} />
            <SignatureImage
              label="Signature"
              url={signatureUrls.gdpr}
              signedAt={declarations.gdpr?.signed_at ?? null}
              onOpen={onOpenImage}
            />
          </PageBlock>

          <PageBlock title="PTC2 — Permission to Contact">
            <div>
              <p className="text-sm text-slate-700">{PTC2_CERTIFY_INTRO}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {PTC2_CERTIFY_BULLETS.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
            <SignatureImage
              label="Signature 1"
              url={signatureUrls.ptc2_1}
              signedAt={declarations.ptc2?.signed_at_1 ?? null}
              onOpen={onOpenImage}
            />
            <CheckboxList items={PTC2_CHECKBOXES} answers={declarations.ptc2?.checkboxes} />
            <SignatureImage
              label="Signature 2"
              url={signatureUrls.ptc2_2}
              signedAt={declarations.ptc2?.signed_at_2 ?? null}
              onOpen={onOpenImage}
            />
          </PageBlock>
        </div>
      )}
    </div>
  );
}
