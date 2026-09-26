"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/app-context";

export function AddAssetButton() {
  const { openAddAsset } = useApp();
  return (
    <Button size="sm" onClick={openAddAsset} data-testid="add-asset">
      <Plus /> Add Asset
    </Button>
  );
}
