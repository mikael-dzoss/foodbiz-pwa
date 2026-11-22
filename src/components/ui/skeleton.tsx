import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  "data-testid": testId,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { "data-testid"?: string }) {
  return (
    <div
      className={cn("bg-muted animate-pulse rounded-md motion-reduce:animate-none", className)}
      data-testid={testId}
      {...props}
    />
  );
}
