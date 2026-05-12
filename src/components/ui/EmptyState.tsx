import { ReactNode } from "react";
import { Button } from "./button";

interface Props {
  icon?: any;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; href?: string };
  secondaryAction?: { label: string; onClick: () => void };
  illustration?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({ icon: Icon, title, description, action, secondaryAction, illustration, size = "md" }: Props) {
  const padding = size === "sm" ? "py-8" : size === "lg" ? "py-16" : "py-12";
  const iconSize = size === "sm" ? "h-10 w-10" : size === "lg" ? "h-20 w-20" : "h-14 w-14";
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 ${padding}`}>
      {illustration ? (
        <div className="mb-4">{illustration}</div>
      ) : Icon ? (
        <div className={`${iconSize} rounded-2xl bg-muted/50 flex items-center justify-center mb-4`}>
          <Icon className={size === "sm" ? "h-5 w-5" : size === "lg" ? "h-10 w-10" : "h-7 w-7"} />
        </div>
      ) : null}
      <h3 className={`font-black ${size === "sm" ? "text-base" : size === "lg" ? "text-xl" : "text-lg"} mb-1`}>
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {action && (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>
          )}
        </div>
      )}
    </div>
  );
}
