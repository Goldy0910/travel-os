"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import type { FormActionResult } from "@/lib/form-action-result";

type DeleteFormProps = {
  action: (formData: FormData) => Promise<FormActionResult>;
  noun: string;
};

export default function DeleteForm({ action, noun }: DeleteFormProps) {
  const { pending, handleForm } = useFormActionFeedback();

  return (
    <form
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete this ${noun}? This cannot be undone.`,
          )
        ) {
          e.preventDefault();
          return;
        }
        handleForm(e, action);
      }}
      className="inline"
    >
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-8 min-w-[4.25rem] items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-50"
      >
        {pending ? (
          <>
            <ButtonSpinner className="h-3.5 w-3.5 text-rose-600" />
            …
          </>
        ) : (
          "Delete"
        )}
      </button>
    </form>
  );
}
