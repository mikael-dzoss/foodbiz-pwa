import Link from "next/link";
import { EmptyState } from "@/components/feedback";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <EmptyState
        title="Page not found"
        description="The page you are looking for doesn't exist or has been moved."
      />
      <div className="mt-4">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
