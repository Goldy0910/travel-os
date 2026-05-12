"use client";

import type { FormActionResult } from "@/lib/form-action-result";
import { showNoInternetModal } from "@/app/app/_components/no-internet-modal";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";

function isLikelyNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("offline")
  );
}

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
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        showNoInternetModal();
        return;
      }
      const fd = new FormData(e.currentTarget);
      startTransition(async () => {
        try {
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
        } catch (err) {
          if (isLikelyNetworkError(err)) {
            showNoInternetModal();
            return;
          }
          toast.error("Something went wrong. Please try again.");
        }
      });
    },
    [router],
  );

  const runAction = useCallback(
    (action: () => Promise<FormActionResult>, onSuccess?: () => void) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        showNoInternetModal();
        return;
      }
      startTransition(async () => {
        try {
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
        } catch (err) {
          if (isLikelyNetworkError(err)) {
            showNoInternetModal();
            return;
          }
          toast.error("Something went wrong. Please try again.");
        }
      });
    },
    [router],
  );

  return { pending, handleForm, runAction };
}
