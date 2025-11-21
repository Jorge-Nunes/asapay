import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExecutionLogTable } from "@/components/ExecutionLogTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Clock, CheckCircle2, XCircle, RefreshCw, ChevronLeft, ChevronRight, Lock, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Execution } from "@shared/schema";

const ITEMS_PER_PAGE = 10;

type SortField = 'timestamp' | 'status' | 'cobrancasProcessadas' | 'mensagensEnviadas' | 'usuariosBloqueados' | 'erros';
type SortDirection = 'asc' | 'desc';

export default function Execucoes() {
  const { toast } = useToast();
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { data: executions = [] } = useQuery<Execution[]>({
    queryKey: ['/api/executions'],
  });

  // Sorting function
  const sortedExecutions = [...executions].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    // Handle timestamp specially
    if (sortField === 'timestamp') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedExecutions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedExecutions = sortedExecutions.slice(startIndex, endIndex);

  const handlePrevious = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNext = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 inline ml-1" />
      : <ArrowDown className="h-4 w-4 inline ml-1" />;
  };

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
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">Concluída</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Falhou</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">Em execução</Badge>;
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

      {executions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Nenhuma execução encontrada
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Detalhes da Execução */}
          {selectedExecution && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Detalhes da Execução</CardTitle>
                  {getStatusBadge(selectedExecution.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Data/Hora</p>
                    <p className="text-base font-semibold flex items-center gap-2">
                      {getStatusIcon(selectedExecution.status)}
                      {format(new Date(selectedExecution.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Cobrança Processadas</p>
                    <p className="text-2xl font-bold text-primary">{selectedExecution.cobrancasProcessadas}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Mensagens Enviadas</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{selectedExecution.mensagensEnviadas}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Lock className="h-4 w-4" />
                      Usuários Bloqueados
                    </p>
                    <p className={`text-2xl font-bold ${selectedExecution.usuariosBloqueados > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                      {selectedExecution.usuariosBloqueados}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Erros</p>
                    <p className={`text-2xl font-bold ${selectedExecution.erros > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                      {selectedExecution.erros}
                    </p>
                  </div>
                </div>

                {selectedExecution.detalhes && selectedExecution.detalhes.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-sm font-semibold mb-4">Registros Detalhados</h3>
                    <div className="max-h-64 overflow-y-auto">
                      <ExecutionLogTable logs={selectedExecution.detalhes} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Histórico de Execuções */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Execuções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50 select-none"
                      onClick={() => handleSort('timestamp')}
                      data-testid="header-timestamp"
                    >
                      Data/Hora <SortIcon field="timestamp" />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50 select-none"
                      onClick={() => handleSort('status')}
                      data-testid="header-status"
                    >
                      Status <SortIcon field="status" />
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-accent/50 select-none"
                      onClick={() => handleSort('cobrancasProcessadas')}
                      data-testid="header-processadas"
                    >
                      Processadas <SortIcon field="cobrancasProcessadas" />
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-accent/50 select-none"
                      onClick={() => handleSort('mensagensEnviadas')}
                      data-testid="header-enviadas"
                    >
                      Enviadas <SortIcon field="mensagensEnviadas" />
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-accent/50 select-none"
                      onClick={() => handleSort('usuariosBloqueados')}
                      data-testid="header-bloqueados"
                    >
                      Bloqueados <SortIcon field="usuariosBloqueados" />
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-accent/50 select-none"
                      onClick={() => handleSort('erros')}
                      data-testid="header-erros"
                    >
                      Erros <SortIcon field="erros" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedExecutions.map((execution) => (
                    <TableRow
                      key={execution.id}
                      className={`cursor-pointer hover-elevate transition-all ${
                        selectedExecution?.id === execution.id ? 'bg-accent' : ''
                      }`}
                      onClick={() => setSelectedExecutionId(execution.id)}
                      data-testid={`row-execution-${execution.id}`}
                    >
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(execution.status)}
                          {format(new Date(execution.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(execution.status)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {execution.cobrancasProcessadas}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {execution.mensagensEnviadas}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {execution.usuariosBloqueados}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {execution.erros}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
