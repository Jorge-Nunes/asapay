import { MetricCard } from "@/components/MetricCard";
import { ExecutionChart } from "@/components/ExecutionChart";
import { StatusChart } from "@/components/StatusChart";
import { FinancialSummarySection } from "@/components/FinancialSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, FileText, MessageSquare, TrendingUp, Play, RefreshCw } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DashboardMetrics, Execution } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();

  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
  });

  const { data: chartData = [] } = useQuery<Array<{ date: string; mensagens: number; erros: number }>>({
    queryKey: ['/api/dashboard/chart-data'],
  });

  const { data: statusData = [] } = useQuery<Array<{ name: string; value: number }>>({
    queryKey: ['/api/dashboard/status-data'],
  });

  const { data: executions = [] } = useQuery<Execution[]>({
    queryKey: ['/api/executions'],
  });

  const runExecutionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/executions/run', { method: 'POST' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao executar');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/executions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/chart-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cobrancas'] });
      toast({
        title: "Execução concluída",
        description: "O processamento foi executado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na execução",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRunExecution = () => {
    runExecutionMutation.mutate();
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
    toast({
      title: "Atualizado",
      description: "Dados atualizados com sucesso.",
    });
  };

  const latestExecutions = executions.slice(0, 5);

  const statusCounts = statusData.reduce((acc, item) => {
    if (item.name === 'Recebido') acc.received = item.value;
    if (item.name === 'Confirmado') acc.confirmed = item.value;
    if (item.name === 'Pendente') acc.pending = item.value;
    if (item.name === 'Vencido') acc.overdue = item.value;
    return acc;
  }, { received: 0, confirmed: 0, pending: 0, overdue: 0 });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Situação das cobranças</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button 
            onClick={handleRunExecution} 
            disabled={runExecutionMutation.isPending}
            className="bg-primary hover:bg-primary/90"
            data-testid="button-run-execution"
          >
            <Play className="h-4 w-4 mr-2" />
            {runExecutionMutation.isPending ? 'Executando...' : 'Executar Agora'}
          </Button>
        </div>
      </div>

      <FinancialSummarySection />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Mensagens Enviadas (7 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ExecutionChart data={chartData} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusChart data={statusData} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas Execuções</CardTitle>
        </CardHeader>
        <CardContent>
          {latestExecutions.length > 0 ? (
            <div className="space-y-3">
              {latestExecutions.map((exec) => (
                <div key={exec.id} className="p-3 border rounded-md bg-card hover-elevate">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{new Date(exec.timestamp).toLocaleString('pt-BR')}</p>
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                        <p data-testid={`text-messages-${exec.id}`}>Mensagens enviadas: <span className="font-medium text-foreground">{exec.mensagensEnviadas}</span></p>
                        <p data-testid={`text-cobrancas-${exec.id}`}>Cobranças processadas: <span className="font-medium text-foreground">{exec.cobrancasProcessadas}</span></p>
                        <p data-testid={`text-errors-${exec.id}`}>Erros: <span className="font-medium text-foreground">{exec.erros}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${exec.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : exec.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'}`}>
                        {exec.status === 'completed' ? 'Concluído' : exec.status === 'running' ? 'Executando' : 'Falhou'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma execução realizada ainda
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
