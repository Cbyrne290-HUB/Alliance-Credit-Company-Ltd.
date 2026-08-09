import type { ApplicationDeclarations } from "@/types/application";

/** Static declaration copy shown to admins, mirroring the wording the
 * applicant actually signed on the public apply site. Keys must match the
 * boolean fields under each declarations.<page>.checkboxes object. */
export type DeclarationCheckboxItem = {
  key: string;
  label: string;
  /** Rendered as a small heading directly above this item. */
  groupHeading?: string;
};

export const FCA0_DECLARATION_TEXT =
  "I know that you, by law, can only talk to me about a new loan if I have asked you in advance in writing. I wish to confirm, by my signature below, that I initiated this discussion, without any prompting from you. And I confirm that you may contact me by phone, email or SMS and may visit my home from time to time to discuss personal loans and other credit products.";

export const APP_CHECKBOXES: DeclarationCheckboxItem[] = [
  {
    key: "no_reading_writing_impairment",
    label: "I do not suffer from any reading or writing impairments",
  },
  {
    key: "aware_contact_money_credit_advice_if_overindebted",
    label:
      "I am aware that if I get over-indebted I should contact my local Money / Credit Advice Service",
  },
  {
    key: "consent_contact_at_employment_if_difficult",
    label: "Contacting me at my place of employment, if I am difficult to contact",
  },
  {
    key: "consent_contact_by_text_or_email",
    label: "Contact me by text message or email",
  },
  {
    key: "understand_info_certified_true_held_by_company",
    label:
      "I understand that the information on this form, which I certify to be true, will be held by the company",
  },
];

export const INCOME_CHECKBOXES: DeclarationCheckboxItem[] = [
  {
    key: "confirm_income_expenditure_true_and_accurate",
    label:
      "I confirm the income and expenditure shown here is a true and accurate reflection of my current financial situation",
  },
];

export const GDPR_CHECKBOXES: DeclarationCheckboxItem[] = [
  {
    key: "consent_home_visits_discuss_loans",
    label: "You have my permission to visit my home from time to time to discuss personal loans.",
  },
  {
    key: "consent_credit_reference_bureau_registration",
    label: "I also consent to the following: Registering / reporting with a credit reference bureau",
  },
  {
    key: "agreement_crime_prevention_detection",
    label: "Use of information about me and my accounts for crime prevention and detection",
    groupHeading: "Any agreement I conclude with you:",
  },
  {
    key: "agreement_visiting_phoning_family",
    label:
      "Visiting or phoning my family: if I request, if I am difficult to contact, if they answer the door or phone when you call",
  },
  {
    key: "agreement_debt_recovery_referral",
    label:
      "Referring my account to your Debt Recovery Agency, if I am difficult to contact or default on my repayments",
  },
  {
    key: "agreement_market_research_marketing",
    label:
      "Use of the information about me and my accounts for market research and the marketing to me of credit and other products",
  },
  {
    key: "cash_loan_request_paragraph_agreed",
    label:
      "I am interested in a cash loan. I understand that under the Consumer Credit Act, your staff can only discuss cash loans in my home if they receive a written request from me. Please send someone to my home to discuss a cash loan.",
  },
];

export const PTC2_CERTIFY_INTRO = "By signing this, I certify that:";

export const PTC2_CERTIFY_BULLETS = [
  "You have my permission to visit my home from time to time to discuss personal loans.",
  "Registering / reporting with a credit reference bureau.",
  "Use of information about me and my accounts for crime prevention and detection.",
  "Visiting or phoning my family: if I request, if I am difficult to contact, if they answer the door or phone when you call.",
  "Referring my account to your Debt Recovery Agency, if I am difficult to contact or default on my repayments.",
  "Use of information about me and my accounts for market research and the marketing to me of credit and other products.",
];

export const PTC2_CHECKBOXES: DeclarationCheckboxItem[] = [
  {
    key: "consent_call_anytime_8am_to_10pm",
    label: "You have my permission to call me anytime between 8 AM to 10 PM",
  },
];

export const DECLARATION_SIGNATURE_KEYS = [
  "fca0",
  "app",
  "income",
  "gdpr",
  "ptc2_1",
  "ptc2_2",
] as const;

export type DeclarationSignatureKey = (typeof DECLARATION_SIGNATURE_KEYS)[number];

export type DeclarationSignatureRef = { key: DeclarationSignatureKey; path: string | null };

/** Pulls every signature path out of the declarations JSON, always
 * returning all six keys (with a null path where unsigned or the
 * application predates this feature) so callers get a complete map. */
export function getDeclarationSignatureRefs(
  declarations: ApplicationDeclarations | null,
): DeclarationSignatureRef[] {
  return [
    { key: "fca0", path: declarations?.fca0?.signature_path ?? null },
    { key: "app", path: declarations?.app?.signature_path ?? null },
    { key: "income", path: declarations?.income?.signature_path ?? null },
    { key: "gdpr", path: declarations?.gdpr?.signature_path ?? null },
    { key: "ptc2_1", path: declarations?.ptc2?.signature_path_1 ?? null },
    { key: "ptc2_2", path: declarations?.ptc2?.signature_path_2 ?? null },
  ];
}
