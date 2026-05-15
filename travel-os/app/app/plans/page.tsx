import { redirect } from "next/navigation";

/** Saved decision plans now live in the main trips list. */
export default function PlansPage() {
  redirect("/app/trips");
}
