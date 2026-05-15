"use client";

import RefinementChatPanel from "@/app/app/master-trip/_components/refinement-chat-panel";
import type { MasterTripFile } from "@/lib/master-trip-file";
import { useEffect, useState } from "react";
import { useItineraryRefinement } from "./itinerary-refinement-context";

type Props = {
  masterId: string;
  initialVersion: number;
  initialFile: MasterTripFile;
};

export default function WorkspaceRefinementPanel({
  masterId,
  initialVersion,
  initialFile,
}: Props) {
  const [version, setVersion] = useState(initialVersion);
  const [file, setFile] = useState(initialFile);
  const { registerRunRefinement, registerOpenRefinement } = useItineraryRefinement();

  useEffect(() => {
    setFile(initialFile);
    setVersion(initialVersion);
  }, [initialFile, initialVersion]);

  return (
    <RefinementChatPanel
      masterId={masterId}
      version={version}
      file={file}
      onVersionChange={setVersion}
      onFileUpdate={setFile}
      onRegisterRunRefinement={registerRunRefinement}
      onRegisterOpen={registerOpenRefinement}
      hideFloatingTrigger
    />
  );
}
