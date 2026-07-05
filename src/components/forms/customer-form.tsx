"use client";

import { useState, type FormEvent } from "react";

export type CustomerFormValues = {
  account_number: string;
  first_name: string;
  surname: string;
  date_of_birth: string;
  address: string;
  eircode: string;
  phone: string;
  ppsn: string;
  walking_order: string;
};

const EMPTY_VALUES: CustomerFormValues = {
  account_number: "",
  first_name: "",
  surname: "",
  date_of_birth: "",
  address: "",
  eircode: "",
  phone: "",
  ppsn: "",
  walking_order: "",
};

export function CustomerForm({
  initialValues,
  submitLabel,
  onSubmit,
}: {
  initialValues?: CustomerFormValues;
  submitLabel: string;
  onSubmit: (values: CustomerFormValues) => Promise<string | void>;
}) {
  const [form, setForm] = useState<CustomerFormValues>(
    initialValues ?? EMPTY_VALUES,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof CustomerFormValues>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const message = await onSubmit(form);

    if (message) {
      setError(message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Account Number"
          value={form.account_number}
          onChange={(v) => update("account_number", v)}
          required
        />
        <Field
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={(v) => update("phone", v)}
        />
        <Field
          label="First Name"
          value={form.first_name}
          onChange={(v) => update("first_name", v)}
          required
        />
        <Field
          label="Surname"
          value={form.surname}
          onChange={(v) => update("surname", v)}
          required
        />
        <Field
          label="Date of Birth"
          type="date"
          value={form.date_of_birth}
          onChange={(v) => update("date_of_birth", v)}
        />
        <Field
          label="PPSN"
          value={form.ppsn}
          onChange={(v) => update("ppsn", v)}
        />
        <Field
          label="Walking Order"
          type="number"
          value={form.walking_order}
          onChange={(v) => update("walking_order", v)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field
            label="Address"
            value={form.address}
            onChange={(v) => update("address", v)}
          />
        </div>
        <Field
          label="Eircode"
          value={form.eircode}
          onChange={(v) => update("eircode", v)}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    </div>
  );
}
