import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExecutionLogTable } from "@/components/ExecutionLogTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Execution } from "@shared/schema";

export default function Execucoes() {
  const { toast } = useToast();
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

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

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/executions'] });
    toast({
      title: "Atualizado",
      description: "Lista de execuções atualizada.",
    });
  };

  const selectedExecution = executions.find(e => e.id === selectedExecutionId) || executions[0];

  const getStatusIcon = (status: Execution['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getStatusBadge = (status: Execution['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Concluída</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Em execução</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Execuções</h1>
          <p className="text-muted-foreground mt-1">Histórico de todas as execuções automáticas</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="border-2"
            data-testid="button-refresh-executions"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button 
            onClick={() => runExecutionMutation.mutate()}
            disabled={runExecutionMutation.isPending}
            className="bg-primary hover:bg-primary/90"
            data-testid="button-run-now"
          >
            <Play className="h-4 w-4 mr-2" />
            {runExecutionMutation.isPending ? 'Executando...' : 'Executar Agora'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold">Histórico</h2>
          {executions.length === 0 ? (
            <Card className="border-2">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  Nenhuma execução encontrada
                </p>
              </CardContent>
            </Card>
          ) : (
            executions.map((execution) => (
              <Card
                key={execution.id}
                className={`cursor-pointer transition-all border-2 hover-elevate ${
                  selectedExecution?.id === execution.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedExecutionId(execution.id)}
                data-testid={`card-execution-${execution.id}`}
              >
                <CardHeader className="space-y-0 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(execution.status)}
                      <CardTitle className="text-sm">
                        {format(new Date(execution.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </CardTitle>
                    </div>
                    {getStatusBadge(execution.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processadas:</span>
                      <span className="font-medium tabular-nums">{execution.cobrancasProcessadas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Enviadas:</span>
                      <span className="font-medium tabular-nums">{execution.mensagensEnviadas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Erros:</span>
                      <span className="font-medium tabular-nums">{execution.erros}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Detalhes da Execução</h2>
          {selectedExecution ? (
            <Card className="border-2">
              <CardContent className="pt-6">
                <ExecutionLogTable logs={selectedExecution.detalhes || []} />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  Selecione uma execução para ver os detalhes
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
