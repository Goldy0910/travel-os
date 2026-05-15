"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";
import InlineAuthForm from "@/app/app/_components/inline-auth-form";

type Props = {
  open: boolean;
  onClose: () => void;
  destinationLabel?: string;
  onAuthenticated: () => void | Promise<void>;
};

export default function RecommendationAuthSheet({
  open,
  onClose,
  destinationLabel,
  onAuthenticated,
}: Props) {
  return (
    <BottomSheetModal
      open={open}
      onClose={onClose}
      title="Continue planning"
      description={
        destinationLabel
          ? `Sign in to save your ${destinationLabel} plan and open your itinerary.`
          : "Sign in to save your plan and open your itinerary."
      }
      panelClassName="max-h-[min(88dvh,720px)]"
      zClass="z-[250]"
    >
      <InlineAuthForm
        compact
        onAuthenticated={async () => {
          await onAuthenticated();
        }}
      />
    </BottomSheetModal>
  );
}
