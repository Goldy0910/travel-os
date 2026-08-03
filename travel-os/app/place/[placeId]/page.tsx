import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ placeId: string }>;
};

/** Spec path `/place/{id}` → authenticated app place page. */
export default async function PlaceRedirectPage({ params }: Props) {
  const { placeId } = await params;
  redirect(`/app/place/${encodeURIComponent(placeId)}`);
}
