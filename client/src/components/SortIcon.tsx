import { ChevronUp, ChevronDown } from "lucide-react";

interface SortIconProps {
  isActive: boolean;
  isAscending: boolean;
}

export function SortIcon({ isActive, isAscending }: SortIconProps) {
  if (!isActive) return null;
  return isAscending ? (
    <ChevronUp className="h-3 w-3 ml-1" />
  ) : (
    <ChevronDown className="h-3 w-3 ml-1" />
  );
}
