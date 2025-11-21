import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'received' | 'confirmed' | 'pending' | 'overdue' | 'default';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

const variantStyles = {
  received: 'bg-gradient-to-b from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800',
  confirmed: 'bg-gradient-to-b from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200 dark:border-indigo-800',
  pending: 'bg-gradient-to-b from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800',
  overdue: 'bg-gradient-to-b from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900 border-rose-200 dark:border-rose-800',
  default: 'bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 border-slate-200 dark:border-slate-800',
};

const variantBgStripes = {
  received: 'via-emerald-200 dark:via-emerald-700',
  confirmed: 'via-indigo-200 dark:via-indigo-700',
  pending: 'via-orange-200 dark:via-orange-700',
  overdue: 'via-rose-200 dark:via-rose-700',
  default: 'via-slate-200 dark:via-slate-700',
};

const variantTextColor = {
  received: 'text-emerald-700 dark:text-emerald-300',
  confirmed: 'text-indigo-700 dark:text-indigo-300',
  pending: 'text-orange-700 dark:text-orange-300',
  overdue: 'text-rose-700 dark:text-rose-300',
  default: 'text-slate-700 dark:text-slate-300',
};

export function MetricCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  variant = 'default',
  trend, 
  className 
}: MetricCardProps) {
  return (
    <Card 
      className={cn(
        "relative overflow-hidden hover-elevate border-2 transition-all",
        variantStyles[variant],
        className
      )} 
      data-testid={`metric-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Diagonal stripes background */}
      <div className="absolute inset-0 opacity-30 dark:opacity-20" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.5) 35px, rgba(255,255,255,0.5) 70px)',
        pointerEvents: 'none',
      }}></div>

      <CardHeader className="relative z-10 flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex-1">
          <p className={cn("text-sm font-medium", variantTextColor[variant])}>{title}</p>
        </div>
        <Icon className={cn("h-5 w-5", variantTextColor[variant])} />
      </CardHeader>

      <CardContent className="relative z-10">
        <div className={cn("text-3xl font-bold tabular-nums", variantTextColor[variant])} data-testid={`value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <p className={cn(
            "text-xs mt-2 font-medium",
            trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% vs. mês anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}
