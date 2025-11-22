import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface StatusChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  if (percent === 0) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="font-bold text-sm"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function StatusChart({ data }: StatusChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const hasData = total > 0;

  return (
    <div className="space-y-4 flex flex-col h-full">
      {hasData ? (
        <div className="flex justify-center flex-1" style={{ minHeight: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
                formatter={(value: number) => {
                  const percentage = ((value / total) * 100).toFixed(1);
                  return [`${value} (${percentage}%)`, 'Registros'];
                }}
                cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry: any) => {
                  const item = data[entry.index];
                  return `${item.name}: ${item.value}`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div
          className="flex justify-center items-center flex-1 text-muted-foreground"
          style={{ minHeight: '300px' }}
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
              className="p-3 rounded-lg border transition-all hover-elevate"
              style={{
                backgroundColor: `${COLORS[index % COLORS.length]}15`,
                borderColor: COLORS[index % COLORS.length],
              }}
              data-testid={`card-status-${item.name.toLowerCase()}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs font-semibold text-foreground truncate">
                  {item.name}
                </span>
              </div>
              <div className="text-xl font-bold tabular-nums text-foreground">
                {item.value}
              </div>
              <div className="text-xs font-medium" style={{ color: COLORS[index % COLORS.length] }}>
                {percentage}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
