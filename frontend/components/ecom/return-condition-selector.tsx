/**
 * Return Condition Selector Component
 * Condition input per item for returns
 */

import { useState } from "react";
import { Check } from "lucide-react";

type Condition = "new" | "used" | "damaged" | "not_restockable";

interface ReturnConditionSelectorProps {
  value: Condition | null;
  onChange: (condition: Condition | null) => void;
  className?: string;
  disabled?: boolean;
}

const conditions: { value: Condition; label: string; description: string }[] = [
  { value: "new", label: "New", description: "Item is in new condition" },
  { value: "used", label: "Used", description: "Item shows signs of use" },
  { value: "damaged", label: "Damaged", description: "Item is damaged but may be restockable" },
  { value: "not_restockable", label: "Not Restockable", description: "Item cannot be restocked" },
];

export function ReturnConditionSelector({
  value,
  onChange,
  className = "",
  disabled = false,
}: ReturnConditionSelectorProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-xs font-medium text-foreground">Condition</label>
      <div className="grid grid-cols-2 gap-2">
        {conditions.map((condition) => {
          const isSelected = value === condition.value;
          return (
            <button
              key={condition.value}
              type="button"
              onClick={() => onChange(condition.value)}
              disabled={disabled}
              className={`flex items-start gap-2 rounded-md border p-2 text-left text-xs transition ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:bg-muted"
              } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <div
                className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border"
                }`}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <div className="flex-1">
                <div className="font-medium">{condition.label}</div>
                <div className="text-muted-foreground">{condition.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

