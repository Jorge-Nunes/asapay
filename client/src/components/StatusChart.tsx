import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

interface StatusChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export function StatusChart({ data }: StatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const hasData = total > 0;

  return (
    <div className="space-y-4 flex flex-col h-full">
      {hasData ? (
        <div className="flex-1" style={{ minHeight: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis 
                type="number"
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                dataKey="name" 
                type="category"
                width={100}
                tick={{ fontSize: 13, fontWeight: 500 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
                formatter={(value: number) => {
                  const percentage = ((value / total) * 100).toFixed(1);
                  return [`${value} registros (${percentage}%)`, 'Total'];
                }}
                cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} animationDuration={800}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          className="flex justify-center items-center flex-1 text-muted-foreground"
          style={{ minHeight: '320px' }}
        >
          Sem dados disponíveis
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.map((item, index) => {
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
          return (
            <div
              key={item.name}
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
                <span className="text-xs font-semibold text-foreground">
                  {item.name}
                </span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {item.value}
              </div>
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
