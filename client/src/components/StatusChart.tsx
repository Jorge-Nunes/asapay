interface StatusChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export function StatusChart({ data }: StatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="space-y-4">
      {data.map((item, index) => {
        const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
        const barWidth = ((item.value / maxValue) * 100) || 5;
        
        return (
          <div key={item.name} className="flex items-center gap-4" data-testid={`bar-status-${item.name.toLowerCase()}`}>
            <div className="w-24 text-sm font-semibold text-foreground">{item.name}</div>
            <div className="flex-1">
              <div className="h-5 bg-muted rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
              </div>
            </div>
            <div className="w-16 text-right">
              <div className="text-sm font-bold tabular-nums text-foreground">{item.value}</div>
              <div className="text-xs font-medium" style={{ color: COLORS[index % COLORS.length] }}>
                {percentage}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
