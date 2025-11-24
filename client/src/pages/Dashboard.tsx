import { MetricCard } from "@/components/MetricCard";
import { ExecutionChart } from "@/components/ExecutionChart";
import { StatusChart } from "@/components/StatusChart";
import { FinancialSummarySection } from "@/components/FinancialSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, MessageSquare, TrendingUp, Play, RefreshCw, AlertCircle, CheckCircle, Clock, MoreVertical } from "lucide-react";
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

  const latestExecutions = executions.slice(0, 2);

  const statusCounts = statusData.reduce((acc, item) => {
    if (item.name === 'Recebido') acc.received = item.value;
    if (item.name === 'Confirmado') acc.confirmed = item.value;
    if (item.name === 'Pendente') acc.pending = item.value;
    if (item.name === 'Vencido') acc.overdue = item.value;
    return acc;
  }, { received: 0, confirmed: 0, pending: 0, overdue: 0 });

  return (
    <div className="space-y-6">
      {/* Header com Status e Ações */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img 
            src="/asapay-logo.png?v=1763982786" 
            alt="AsaPay Logo" 
            className="h-16 w-auto object-contain"
          />
          <div>
            <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-2">Visão completa da situação das cobranças</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            data-testid="button-refresh"
            className="transition-all hover:scale-105"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button 
            onClick={handleRunExecution} 
            disabled={runExecutionMutation.isPending}
            className="bg-primary hover:bg-primary/90 transition-all hover:scale-105"
            data-testid="button-run-execution"
          >
            <Play className="h-4 w-4 mr-2" />
            {runExecutionMutation.isPending ? 'Executando...' : 'Executar Agora'}
          </Button>
        </div>
      </div>

      {/* KPI Cards - Situação das Cobranças (Estilo Asaas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? (
          <>
            <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
            <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
            <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
            <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
          </>
        ) : (
          <>
            <MetricCard
              title="Recebidas"
              value={`R$ ${(metrics?.totalRecebido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              subtitle={`${statusCounts.received} clientes • ${statusCounts.received} cobranças`}
              icon={CheckCircle}
              variant="received"
            />
            <MetricCard
              title="Confirmadas"
              value={`R$ ${(metrics?.confirmadas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              subtitle={`${statusCounts.confirmed} clientes • ${statusCounts.confirmed} cobranças`}
              icon={CheckCircle}
              variant="confirmed"
            />
            <MetricCard
              title="Aguardando pagamento"
              value={`R$ ${(metrics?.totalPendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              subtitle={`${statusCounts.pending} clientes • ${statusCounts.pending} cobranças`}
              icon={AlertCircle}
              variant="pending"
            />
            <MetricCard
              title="Vencidas"
              value={`R$ ${(metrics?.venceHojeValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              subtitle={`${statusCounts.overdue} clientes • ${statusCounts.overdue} cobranças`}
              icon={AlertCircle}
              variant="overdue"
            />
          </>
        )}
      </div>

      <FinancialSummarySection />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="hover-elevate transition-all h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Mensagens Enviadas (7 dias)</CardTitle>
              <Badge variant="outline" className="text-xs">Últimas 7 dias</Badge>
            </CardHeader>
            <CardContent className="flex-1">
              {chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Sem dados disponível
                </div>
              ) : (
                <ExecutionChart data={chartData} />
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="hover-elevate transition-all h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Distribuição de Status</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-stretch">
              {statusData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Sem dados disponível
                </div>
              ) : (
                <div className="w-full">
                  <StatusChart data={statusData} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Latest Executions - Aprimorado */}
      <Card className="hover-elevate transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Histórico de Execuções</CardTitle>
          <Badge variant="secondary" className="text-xs">{executions.length} total</Badge>
        </CardHeader>
        <CardContent>
          {latestExecutions.length > 0 ? (
            <div className="space-y-3">
              {latestExecutions.map((exec) => (
                <div key={exec.id} className="p-4 border rounded-lg bg-gradient-to-r from-card to-muted/30 hover:from-muted hover:to-muted/50 hover-elevate transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm font-semibold text-foreground">{new Date(exec.timestamp).toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-900">
                          <p className="text-muted-foreground">Mensagens</p>
                          <p className="font-bold text-blue-700 dark:text-blue-300" data-testid={`text-messages-${exec.id}`}>{exec.mensagensEnviadas}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded border border-green-200 dark:border-green-900">
                          <p className="text-muted-foreground">Processadas</p>
                          <p className="font-bold text-green-700 dark:text-green-300" data-testid={`text-cobrancas-${exec.id}`}>{exec.cobrancasProcessadas}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-900">
                          <p className="text-muted-foreground">Erros</p>
                          <p className="font-bold text-red-700 dark:text-red-300" data-testid={`text-errors-${exec.id}`}>{exec.erros}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Badge variant={exec.status === 'completed' ? 'default' : exec.status === 'running' ? 'secondary' : 'destructive'} className="text-xs">
                        {exec.status === 'completed' ? '✓ Concluído' : exec.status === 'running' ? '⟳ Executando' : '✕ Falhou'}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
              <p className="text-muted-foreground">Nenhuma execução realizada ainda</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
