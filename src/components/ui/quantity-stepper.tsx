"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  "data-testid"?: string;
}

export function QuantityStepper({
  value,
  min = 0,
  max = 999,
  disabled = false,
  onChange,
  className,
  "data-testid": testId,
}: QuantityStepperProps) {
  const handleDecrement = () => {
    if (!disabled && value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (!disabled && value < max) {
      onChange(value + 1);
    }
  };

  return (
    <div
      className={cn(
        "border-border bg-card inline-flex items-center rounded-md border p-1",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
      data-testid={testId}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className="text-foreground hover:bg-muted h-12 w-12"
        data-testid="quantity-decrement"
      >
        <Minus className="h-4 w-4" />
      </Button>

      <span
        className="text-body-md text-foreground w-12 text-center tabular-nums"
        data-testid="quantity-value"
      >
        {value}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        className="text-foreground hover:bg-muted h-12 w-12"
        data-testid="quantity-increment"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
