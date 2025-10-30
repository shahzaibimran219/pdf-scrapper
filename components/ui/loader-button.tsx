"use client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import * as React from "react";

type Props = React.ComponentProps<typeof Button> & {
  loading?: boolean;
  loadingText?: string;
};

export function LoaderButton({ loading, loadingText, children, disabled, ...rest }: Props) {
  return (
    <Button disabled={loading || disabled} {...rest}>
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText ?? "Loading…"}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}


