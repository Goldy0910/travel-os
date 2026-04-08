"use client";

import type { FormActionResult } from "@/lib/form-action-result";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";

export function useFormActionFeedback() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleForm = useCallback(
    (
      e: React.FormEvent<HTMLFormElement>,
      action: (fd: FormData) => Promise<FormActionResult>,
      onSuccess?: () => void,
    ) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        const r = await action(fd);
        if (r.ok) {
          toast.success(r.message);
          onSuccess?.();
          if (r.redirectTo) {
            router.push(r.redirectTo);
            router.refresh();
            return;
          }
          router.refresh();
        } else {
          toast.error(r.error);
        }
      });
    },
    [router],
  );

  const runAction = useCallback(
    (action: () => Promise<FormActionResult>, onSuccess?: () => void) => {
      startTransition(async () => {
        const r = await action();
        if (r.ok) {
          toast.success(r.message);
          onSuccess?.();
          if (r.redirectTo) {
            router.push(r.redirectTo);
            router.refresh();
            return;
          }
          router.refresh();
        } else {
          toast.error(r.error);
        }
      });
    },
    [router],
  );

  return { pending, handleForm, runAction };
}
