import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { FinancialSummary as FinancialSummaryType } from "@shared/schema";

const FinancialSummaryCard = ({ title, total, netValue, customers, invoices, color }: { 
  title: string;
  total: number; 
  netValue: number; 
  customers: number; 
  invoices: number;
  color: 'green' | 'blue' | 'orange' | 'red';
}) => {
  const colorMap = {
    green: 'border-l-4 border-l-green-500',
    blue: 'border-l-4 border-l-blue-500',
    orange: 'border-l-4 border-l-orange-500',
    red: 'border-l-4 border-l-red-500',
  };

  const bgColorMap = {
    green: 'bg-green-500/5',
    blue: 'bg-blue-500/5',
    orange: 'bg-orange-500/5',
    red: 'bg-red-500/5',
  };

  const textColorMap = {
    green: 'text-green-700 dark:text-green-400',
    blue: 'text-blue-700 dark:text-blue-400',
    orange: 'text-orange-700 dark:text-orange-400',
    red: 'text-red-700 dark:text-red-400',
  };

  return (
    <Card className={`${colorMap[color]} ${bgColorMap[color]} p-6`}>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <div className={`text-2xl font-bold ${textColorMap[color]}`}>
            R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(total)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(netValue)} líquido
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">👤 cliente{customers !== 1 ? 's' : ''}</span>
            <span className="font-semibold">{customers}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">📄 cobrança{invoices !== 1 ? 's' : ''}</span>
            <span className="font-semibold">{invoices}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export function FinancialSummarySection() {
  const { data: summary, isLoading } = useQuery<FinancialSummaryType>({
    queryKey: ['/api/dashboard/financial-summary'],
  });

  if (isLoading || !summary) {
    return <div className="text-center py-8 text-muted-foreground">Carregando dados financeiros...</div>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-4">Situação das cobranças</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinancialSummaryCard
          title="Recebidas"
          total={summary.received.total}
          netValue={summary.received.netValue}
          customers={summary.received.customers}
          invoices={summary.received.invoices}
          color="green"
          data-testid="card-received"
        />
        <FinancialSummaryCard
          title="Confirmadas"
          total={summary.confirmed.total}
          netValue={summary.confirmed.netValue}
          customers={summary.confirmed.customers}
          invoices={summary.confirmed.invoices}
          color="blue"
          data-testid="card-confirmed"
        />
        <FinancialSummaryCard
          title="Aguardando pagamento"
          total={summary.pending.total}
          netValue={summary.pending.netValue}
          customers={summary.pending.customers}
          invoices={summary.pending.invoices}
          color="orange"
          data-testid="card-pending"
        />
        <FinancialSummaryCard
          title="Vencidas"
          total={summary.overdue.total}
          netValue={summary.overdue.netValue}
          customers={summary.overdue.customers}
          invoices={summary.overdue.invoices}
          color="red"
          data-testid="card-overdue"
        />
      </div>
    </div>
  );
}
