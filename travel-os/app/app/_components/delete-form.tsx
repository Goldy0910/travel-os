"use client";

import { useFormStatus } from "react-dom";

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}

type DeleteFormProps = {
  action: (formData: FormData) => Promise<void>;
  noun: string;
};

export default function DeleteForm({ action, noun }: DeleteFormProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete this ${noun}? This cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <DeleteSubmit />
    </form>
  );
}
