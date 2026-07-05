export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatCurrency(value: number) {
  return `€${value.toFixed(2)}`;
}
