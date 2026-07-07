import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  APPLICATION_DOCUMENTS_BUCKET,
  APPLICATION_DOCUMENT_FIELDS,
  APPLICATION_SIGNED_URL_TTL_SECONDS,
} from "@/lib/applications";
import type { Application } from "@/types/application";
import { ApplicationDetail } from "./application-detail";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("applications").select("*").eq("id", id).single();

  const application = data as Application | null;

  if (!application) notFound();

  const documents = await Promise.all(
    APPLICATION_DOCUMENT_FIELDS.map(async (field) => {
      const path = application[field.column];
      let signedUrl: string | null = null;

      if (path) {
        const { data: signedData } = await supabase.storage
          .from(APPLICATION_DOCUMENTS_BUCKET)
          .createSignedUrl(path, APPLICATION_SIGNED_URL_TTL_SECONDS);
        signedUrl = signedData?.signedUrl ?? null;
      }

      return { label: field.label, path, signedUrl };
    }),
  );

  return <ApplicationDetail application={application} documents={documents} />;
}
