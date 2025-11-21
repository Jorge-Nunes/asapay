import { MetricCard } from "@/components/MetricCard";
import { ExecutionChart } from "@/components/ExecutionChart";
import { StatusChart } from "@/components/StatusChart";
import { ExecutionLogTable } from "@/components/ExecutionLogTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, FileText, MessageSquare, TrendingUp, Play, RefreshCw, Users } from "lucide-react";
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

  const latestLogs = executions[0]?.detalhes?.slice(0, 10) || [];

  // Calculate status data
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

      {/* Situação das cobranças */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Situação das cobranças</h2>
          <Button variant="ghost" size="sm">Versão gráfica</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            title="Recebidas"
            value={metricsLoading ? '...' : `R$ ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(0)}`}
            subtitle={`${statusCounts.received} cliente${statusCounts.received !== 1 ? 's' : ''}`}
            icon={DollarSign}
            variant="received"
          />
          <MetricCard
            title="Confirmadas"
            value={metricsLoading ? '...' : `R$ ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(0)}`}
            subtitle={`${statusCounts.confirmed} cliente${statusCounts.confirmed !== 1 ? 's' : ''}`}
            icon={FileText}
            variant="confirmed"
          />
          <MetricCard
            title="Aguardando pagamento"
            value={metricsLoading ? '...' : `R$ ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics?.totalPendente || 0)}`}
            subtitle={`${statusCounts.pending} cliente${statusCounts.pending !== 1 ? 's' : ''}`}
            icon={MessageSquare}
            variant="pending"
          />
          <MetricCard
            title="Vencidas"
            value={metricsLoading ? '...' : `R$ ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(0)}`}
            subtitle={`${statusCounts.overdue} cliente${statusCounts.overdue !== 1 ? 's' : ''}`}
            icon={TrendingUp}
            variant="overdue"
          />
        </div>
      </div>

      {/* Métricas de execução */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Métricas de execução</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Card className="border-2 hover-elevate">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mensagens Enviadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{metricsLoading ? '...' : metrics?.mensagensEnviadas || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Últimos 30 dias</p>
            </CardContent>
          </Card>
          <Card className="border-2 hover-elevate">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vence Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{metricsLoading ? '...' : metrics?.venceHoje || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Próxima execução</p>
            </CardContent>
          </Card>
          <Card className="border-2 hover-elevate">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Conversão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{metricsLoading ? '...' : `${(metrics?.taxaConversao || 0).toFixed(1)}%`}</div>
              <p className="text-xs text-muted-foreground mt-1">Pagamentos realizados</p>
            </CardContent>
          </Card>
          <Card className="border-2 hover-elevate">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Execuções</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{executions.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Neste mês</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-base">Execuções</CardTitle>
          </CardHeader>
          <CardContent>
            <ExecutionChart data={chartData} />
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusChart data={statusData} />
          </CardContent>
        </Card>
      </div>

      {/* Últimas execuções */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Últimas execuções</h2>
        <Card className="border-2">
          <CardContent className="pt-6">
            <ExecutionLogTable logs={latestLogs} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
