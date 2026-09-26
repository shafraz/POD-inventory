"use client";

import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <EmptyState icon={AlertTriangle} title="Something went wrong" description="The page could not be loaded. Please try again." action={<Button variant="outline" onClick={reset}>Try again</Button>} />;
}
