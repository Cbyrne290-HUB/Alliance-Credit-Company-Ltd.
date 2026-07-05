export const DOCUMENTS_BUCKET = "documents";

/** Signed URLs are regenerated on every page load/mutation, so this only
 * needs to outlive a single viewing session, not be long-lived. */
export const SIGNED_URL_TTL_SECONDS = 600;

export const DOCUMENT_FIELDS = [
  { column: "id_photo_url", slug: "id_photo", label: "ID Photo" },
  { column: "address_proof_url", slug: "address_proof", label: "Proof of Address" },
  { column: "income_proof_url", slug: "income_proof", label: "Proof of Income" },
  { column: "ppsn_photo_url", slug: "ppsn_photo", label: "PPSN Photo" },
] as const;

export type DocumentField = (typeof DOCUMENT_FIELDS)[number];
export type DocumentColumn = DocumentField["column"];
export type DocumentSlug = DocumentField["slug"];

export function documentStoragePath(customerId: string, slug: DocumentSlug) {
  return `${customerId}/${slug}.jpg`;
}
