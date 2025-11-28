/**
 * Inventory Allocation View Component
 * Shows which branch/version allocated for order items
 */

import { MapPin, Package } from "lucide-react";

interface AllocationInfo {
  branchId?: number | null;
  branchName?: string | null;
  versionId?: number | null;
  productCode?: string | null;
  quantity: number;
}

interface InventoryAllocationViewProps {
  allocations: AllocationInfo[];
  className?: string;
}

export function InventoryAllocationView({ allocations, className = "" }: InventoryAllocationViewProps) {
  if (allocations.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No inventory allocated
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-xs font-semibold text-foreground">Inventory Allocation</h4>
      <div className="space-y-1.5">
        {allocations.map((allocation, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs"
          >
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {allocation.productCode || "Unknown"}
            </span>
            <span className="text-muted-foreground">× {allocation.quantity}</span>
            {allocation.branchName && (
              <>
                <span className="text-muted-foreground">•</span>
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{allocation.branchName}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

