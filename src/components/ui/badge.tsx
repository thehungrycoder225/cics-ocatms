import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20",
        secondary:
          "border border-secondary/50 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20",
        outline: "text-foreground border border-input",
        success:
          "border border-success/50 bg-success/10 text-success hover:bg-success/20",
        warning:
          "border border-warning/50 bg-warning/10 text-warning hover:bg-warning/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={clsx(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
