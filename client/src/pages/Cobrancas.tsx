import { useState } from "react";
import { CobrancaTable } from "@/components/CobrancaTable";
import { SortIcon } from "@/components/SortIcon";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSort } from "@/hooks/useSort";
import { sortArray } from "@/utils/sorting";
import type { Cobranca } from "@shared/schema";

type SortFieldCobranca = 'customerName' | 'value' | 'dueDate' | 'status' | 'tipo' | 'description';

interface PaginatedResponse {
  data: Cobranca[];
  total: number;
  limit: number;
  offset: number;
}

export default function Cobrancas() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");
  const { sortField, sortOrder, handleSort } = useSort<SortFieldCobranca>('dueDate', 'desc');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const { data: paginatedData = { data: [], total: 0, limit: pageSize, offset: 0 }, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ['/api/cobrancas', statusFilter, tipoFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (tipoFilter !== 'all') params.append('tipo', tipoFilter);
      params.append('limit', pageSize.toString());
      params.append('offset', (page * pageSize).toString());
      
      const response = await fetch(`/api/cobrancas?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch cobranças');
      return response.json();
    },
  });

  const cobrancas = paginatedData.data || [];
  const total = paginatedData.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/cobrancas'] });
    setPage(0);
    toast({
      title: "Atualizado",
      description: "Lista de cobranças atualizada com sucesso.",
    });
  };

  const handleNextPage = () => {
    if (page < totalPages - 1) setPage(page + 1);
  };

  const handlePreviousPage = () => {
    if (page > 0) setPage(page - 1);
  };

  const filteredCobrancas = cobrancas.filter((cobranca) => {
    const matchesSearch = cobranca.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (cobranca.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesMinValue = minValue ? cobranca.value >= parseFloat(minValue) : true;
    const matchesMaxValue = maxValue ? cobranca.value <= parseFloat(maxValue) : true;
    return matchesSearch && matchesMinValue && matchesMaxValue;
  });

  const sortedCobrancas = sortArray(filteredCobrancas, sortField, sortOrder as 'asc' | 'desc');

  const sendMessageMutation = useMutation({
    mutationFn: async (cobrancaId: string) => {
      const response = await fetch(`/api/cobrancas/${cobrancaId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar mensagem');
      }
      return response.json();
    },
    onSuccess: (data, cobrancaId) => {
      const cobranca = cobrancas.find(c => c.id === cobrancaId);
      toast({
        title: "Sucesso",
        description: `Mensagem enviada para ${cobranca?.customerName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/cobrancas/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao sincronizar cobranças');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cobrancas'] });
      setPage(0);
      toast({
        title: "Sincronização Concluída",
        description: data.message || `Cobranças sincronizadas com sucesso`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (cobranca: Cobranca) => {
    console.log('Enviando mensagem para:', cobranca.customerName);
    sendMessageMutation.mutate(cobranca.id);
  };

  const handleSyncCobrancas = () => {
    toast({
      title: "Sincronizando...",
      description: "Buscando cobranças do Asaas e removendo deletadas...",
    });
    syncMutation.mutate();
  };

  const handleExportCSV = () => {
    const headers = ["Cliente", "Valor", "Descrição", "Tipo", "Status", "Vencimento"];
    const rows = sortedCobrancas.map(c => [
      c.customerName,
      `R$ ${c.value.toFixed(2)}`,
      c.description || '-',
      c.tipo || '-',
      c.status,
      c.dueDate
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(","   )).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cobrancas-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportado", description: `${sortedCobrancas.length} cobranças exportadas em CSV` });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cobranças</h1>
          <p className="text-muted-foreground text-sm">Gerencie todas as cobranças pendentes</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncCobrancas}
            disabled={syncMutation.isPending}
            data-testid="button-sync-cobrancas"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            data-testid="button-refresh-cobrancas"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-2 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 border-2"
              data-testid="input-search-cliente"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] border-2" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="RECEIVED">Recebido</SelectItem>
              <SelectItem value="CONFIRMED">Confirmado</SelectItem>
              <SelectItem value="OVERDUE">Vencido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-full sm:w-[180px] border-2" data-testid="select-tipo-filter">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="vence_hoje">Vence Hoje</SelectItem>
              <SelectItem value="aviso">Aviso</SelectItem>
              <SelectItem value="processada">Processada</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              placeholder="Min valor"
              type="number"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              className="w-24 border-2"
              data-testid="input-min-value"
            />
            <Input
              placeholder="Max valor"
              type="number"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              className="w-24 border-2"
              data-testid="input-max-value"
            />
          </div>
          <Button 
            onClick={handleExportCSV}
            variant="outline" 
            className="border-2" 
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="border-2">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando cobranças...</div>
        ) : (
          <>
            <CobrancaTable 
              cobrancas={sortedCobrancas} 
              onSendMessage={handleSendMessage}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              SortIcon={SortIcon}
            />
            
            {/* Paginação */}
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-xs text-muted-foreground">
                {total === 0 ? (
                  <span>Nenhuma cobrança</span>
                ) : (
                  <span>
                    {Math.min((page * pageSize) + 1, total)}-{Math.min((page + 1) * pageSize, total)} de {total}
                  </span>
                )}
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                    className="h-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="flex gap-1 items-center">
                    {(() => {
                      const pages = [];
                      const maxVisible = 7;
                      const halfWindow = 3;
                      
                      if (totalPages <= maxVisible) {
                        for (let i = 0; i < totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        const start = Math.max(0, page - halfWindow);
                        const end = Math.min(totalPages - 1, page + halfWindow);
                        
                        if (start > 0) pages.push(0);
                        if (start > 1) pages.push('...');
                        
                        for (let i = start; i <= end; i++) {
                          pages.push(i);
                        }
                        
                        if (end < totalPages - 2) pages.push('...');
                        if (end < totalPages - 1) pages.push(totalPages - 1);
                      }
                      
                      return pages.map((pageNum, idx) => (
                        pageNum === '...' ? (
                          <span key={`ellipsis-${idx}`} className="text-xs text-muted-foreground">•••</span>
                        ) : (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageClick(pageNum as number)}
                            className="min-w-8 h-8"
                            data-testid={`button-page-${pageNum}`}
                          >
                            {(pageNum as number) + 1}
                          </Button>
                        )
                      ));
                    })()}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={page >= totalPages - 1}
                    data-testid="button-next-page"
                    className="h-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
