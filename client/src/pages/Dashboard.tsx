import { MetricCard } from "@/components/MetricCard";
import { ExecutionChart } from "@/components/ExecutionChart";
import { StatusChart } from "@/components/StatusChart";
import { ExecutionLogTable } from "@/components/ExecutionLogTable";
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral do sistema de cobranças</p>
        </div>
        <div className="flex items-center gap-4">
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
            data-testid="button-run-execution"
          >
            <Play className="h-4 w-4 mr-2" />
            {runExecutionMutation.isPending ? 'Executando...' : 'Executar Agora'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Pendente"
          value={metricsLoading ? '...' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics?.totalPendente || 0)}
          icon={DollarSign}
        />
        <MetricCard
          title="Vence Hoje"
          value={metricsLoading ? '...' : metrics?.venceHoje || 0}
          icon={FileText}
        />
        <MetricCard
          title="Mensagens Enviadas"
          value={metricsLoading ? '...' : metrics?.mensagensEnviadas || 0}
          icon={MessageSquare}
        />
        <MetricCard
          title="Taxa de Conversão"
          value={metricsLoading ? '...' : `${(metrics?.taxaConversao || 0).toFixed(1)}%`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExecutionChart data={chartData} />
        <StatusChart data={statusData} />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Últimas Execuções</h2>
        <ExecutionLogTable logs={latestLogs} />
      </div>
    </div>
  );
}
