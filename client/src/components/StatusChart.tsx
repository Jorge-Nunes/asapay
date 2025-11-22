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
    <div className="space-y-6 flex flex-col h-full">
      {/* Barras visuais */}
      <div className="space-y-4">
        {data.map((item, index) => {
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
          const barWidth = ((item.value / maxValue) * 100) || 5;
          
          return (
            <div key={item.name} className="flex items-center gap-4" data-testid={`bar-status-${item.name.toLowerCase()}`}>
              <div className="w-24 text-sm font-semibold text-foreground">{item.name}</div>
              <div className="flex-1">
                <div className="h-10 bg-muted rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-300"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
              </div>
              <div className="w-16 text-right">
                <div className="text-lg font-bold tabular-nums text-foreground">{item.value}</div>
                <div className="text-xs font-medium" style={{ color: COLORS[index % COLORS.length] }}>
                  {percentage}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.map((item, index) => {
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
          return (
            <div
              key={`card-${item.name}`}
              className="p-4 rounded-lg border transition-all hover-elevate"
              style={{
                backgroundColor: `${COLORS[index % COLORS.length]}10`,
                borderColor: COLORS[index % COLORS.length],
              }}
              data-testid={`card-status-${item.name.toLowerCase()}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs font-semibold text-foreground">{item.name}</span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-foreground">{item.value}</div>
              <div className="text-sm font-semibold mt-1" style={{ color: COLORS[index % COLORS.length] }}>
                {percentage}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
