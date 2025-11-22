import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ExecutionChartProps {
  data: Array<{
    date: string;
    mensagens: number;
    erros: number;
  }>;
}

export function ExecutionChart({ data }: ExecutionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Line 
              type="monotone" 
              dataKey="mensagens" 
              stroke="hsl(var(--chart-1))" 
              strokeWidth={2}
              name="Mensagens Enviadas"
            />
            <Line 
              type="monotone" 
              dataKey="erros" 
              stroke="hsl(var(--destructive))" 
              strokeWidth={2}
              name="Erros"
            />
          </LineChart>
        </ResponsiveContainer>
  );
}
