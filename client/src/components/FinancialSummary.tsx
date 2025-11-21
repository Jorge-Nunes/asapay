import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
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

const getPeriodDates = (period: string): { startDate: string; endDate: string } => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  switch (period) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };
    case 'thisMonth': {
      const startOfMonth = new Date(year, today.getMonth(), 1);
      const startDate = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
      return { startDate, endDate: todayStr };
    }
    case 'thisYear': {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      return { startDate, endDate };
    }
    case 'allTime':
      return { startDate: '', endDate: '' };
    default:
      return { startDate: '', endDate: '' };
  }
};

const getPeriodLabel = (period: string): string => {
  const labels: Record<string, string> = {
    today: 'Hoje',
    thisMonth: 'Este mês',
    thisYear: 'Este ano',
    allTime: 'Desde o início',
    custom: 'Personalizado',
  };
  return labels[period] || 'Este mês';
};

export function FinancialSummarySection() {
  const [period, setPeriod] = useState('thisMonth');
  const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
  const [isOpen, setIsOpen] = useState(false);

  const displayPeriod = period === 'custom' ? customDates : getPeriodDates(period);
  const queryParams = new URLSearchParams();
  if (displayPeriod.startDate) queryParams.append('startDate', displayPeriod.startDate);
  if (displayPeriod.endDate) queryParams.append('endDate', displayPeriod.endDate);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  const { data: summary, isLoading } = useQuery<FinancialSummaryType>({
    queryKey: ['/api/dashboard/financial-summary', displayPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/financial-summary${queryString}`);
      if (!response.ok) throw new Error('Erro ao carregar resumo financeiro');
      return response.json();
    },
  });

  const handleApply = () => {
    setIsOpen(false);
  };

  const handleClear = () => {
    setPeriod('thisMonth');
    setCustomDates({ startDate: '', endDate: '' });
  };

  if (isLoading || !summary) {
    return <div className="text-center py-8 text-muted-foreground">Carregando dados financeiros...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-foreground">Situação das cobranças</h2>
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-full"
              data-testid="button-filter-period"
            >
              <Calendar className="h-4 w-4" />
              {getPeriodLabel(period)}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <RadioGroup value={period} onValueChange={(val) => {
                setPeriod(val);
                if (val !== 'custom') {
                  setCustomDates({ startDate: '', endDate: '' });
                }
              }}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="today" id="today" />
                  <Label htmlFor="today" className="text-sm font-normal cursor-pointer">Hoje</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="thisMonth" id="thisMonth" />
                  <Label htmlFor="thisMonth" className="text-sm font-normal cursor-pointer">Este mês</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="thisYear" id="thisYear" />
                  <Label htmlFor="thisYear" className="text-sm font-normal cursor-pointer">Este ano</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="allTime" id="allTime" />
                  <Label htmlFor="allTime" className="text-sm font-normal cursor-pointer">Desde o início</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="text-sm font-normal cursor-pointer">Personalizado</Label>
                </div>
              </RadioGroup>

              {period === 'custom' && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Data inicial</label>
                    <Input
                      type="date"
                      value={customDates.startDate}
                      onChange={(e) => setCustomDates({ ...customDates, startDate: e.target.value })}
                      data-testid="input-custom-start"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Data final</label>
                    <Input
                      type="date"
                      value={customDates.endDate}
                      onChange={(e) => setCustomDates({ ...customDates, endDate: e.target.value })}
                      data-testid="input-custom-end"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClear}
                  data-testid="button-clear"
                  className="flex-1"
                >
                  Limpar
                </Button>
                <Button 
                  size="sm"
                  onClick={handleApply}
                  data-testid="button-apply"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

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
