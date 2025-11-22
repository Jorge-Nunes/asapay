import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface MessageTypeChartProps {
  venceHoje: number;
  aviso: number;
}

const COLORS = ['#ef4444', '#f59e0b'];

export function MessageTypeChart({ venceHoje, aviso }: MessageTypeChartProps) {
  const data = [
    { name: 'Vence Hoje', value: venceHoje },
    { name: 'Aviso', value: aviso },
  ];

  const total = venceHoje + aviso;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[250px]">
        <p className="text-muted-foreground">Nenhuma mensagem registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="flex justify-center flex-1" style={{ minHeight: '250px' }}>
        <ResponsiveContainer width="100%" height="100%" maxWidth={400}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={(value: number) => [value, 'Mensagens']}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {data.map((item, index) => (
          <div key={item.name} className="p-3 bg-muted rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-xs font-medium text-muted-foreground truncate">
                {item.name}
              </span>
            </div>
            <div className="text-lg font-bold tabular-nums">
              {item.value}
            </div>
            <div className="text-xs text-muted-foreground">
              {((item.value / total) * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
