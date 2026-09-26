import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <EmptyState icon={SearchX} title="Not found" description="The asset or page you’re looking for doesn’t exist, or it may have been archived." action={<Button asChild variant="outline"><Link href="/assets">Go to Asset Register</Link></Button>} />;
}
