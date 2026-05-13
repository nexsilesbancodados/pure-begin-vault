import * as React from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "gradient" | "blue" | "glow" | "glass" | "hero";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  hover?: boolean;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-card border border-border shadow-card",
  gradient: "bg-gradient-card border border-border/60 shadow-card",
  blue: "bg-gradient-card-blue border border-primary/15 shadow-blue",
  glow: "bg-gradient-card-glow border border-primary/20 shadow-elegant",
  glass: "glass shadow-card",
  hero: "bg-gradient-hero text-white border-0 shadow-elegant",
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", hover = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl text-card-foreground transition-all",
        variantClasses[variant],
        hover && "card-hover cursor-pointer",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
