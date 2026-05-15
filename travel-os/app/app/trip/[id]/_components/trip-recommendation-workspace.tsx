"use client";

import RefinementChatPanel from "@/app/app/master-trip/_components/refinement-chat-panel";
import type { MasterTripFile } from "@/lib/master-trip-file";
import type { NormalizedTripPlan } from "@/lib/unified-trip";
import { useState } from "react";
import TripSummaryPanel from "./trip-summary-panel";

type Props = {
  plan: NormalizedTripPlan;
  dayCount: number;
  masterId: string;
  initialVersion: number;
  initialFile: MasterTripFile;
};

/** Summary + AI refinement for recommendation-backed trips (single workspace entry). */
export default function TripRecommendationWorkspace({
  plan,
  dayCount,
  masterId,
  initialVersion,
  initialFile,
}: Props) {
  const [version, setVersion] = useState(initialVersion);
  const [file, setFile] = useState(initialFile);

  return (
    <>
      <TripSummaryPanel plan={plan} dayCount={dayCount} />
      <RefinementChatPanel
        masterId={masterId}
        version={version}
        file={file}
        onVersionChange={setVersion}
        onFileUpdate={(updater) => setFile(updater)}
      />
    </>
  );
}
