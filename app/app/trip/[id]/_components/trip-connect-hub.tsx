"use client";

import type { ConnectSection } from "@/app/app/trip/[id]/_lib/trip-tab-keys";
import TripDocsClient, {
  type TripDocsClientInputProps,
} from "@/app/app/trip/[id]/docs/_components/trip-docs-client";
import { type ReactNode } from "react";
import TripConnectShell from "./trip-connect-shell";

type Props = {
  section: ConnectSection;
  onSectionChange: (s: ConnectSection) => void;
  chat: ReactNode;
  members: ReactNode;
  docs: TripDocsClientInputProps;
};

/**
 * Client-only wrapper: composes Chat / Docs / Members for the Connect tab.
 * Keeps `connectDocsActive` on the client so the server page never passes a function prop.
 */
export default function TripConnectHub({
  section,
  onSectionChange,
  chat,
  members,
  docs,
}: Props) {
  return (
    <TripConnectShell
      section={section}
      onSectionChange={onSectionChange}
      chat={chat}
      docs={<TripDocsClient {...docs} connectDocsActive={section === "docs"} />}
      members={members}
    />
  );
}
