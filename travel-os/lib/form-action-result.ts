export type FormActionResult =
  | { ok: true; message: string; redirectTo?: string }
  | { ok: false; error: string };

export function actionSuccess(message: string, redirectTo?: string): FormActionResult {
  return { ok: true, message, redirectTo };
}

export function actionError(error: string): FormActionResult {
  return { ok: false, error };
}
