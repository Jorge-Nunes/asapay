import { useState } from "react";
import { CobrancaTable } from "@/components/CobrancaTable";
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
import { Search, Filter, RefreshCw, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Cobranca } from "@shared/schema";

type SortFieldCobranca = 'customerName' | 'value' | 'dueDate' | 'status' | 'tipo' | 'description';
type SortDirection = 'asc' | 'desc';

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
  const [sortField, setSortField] = useState<SortFieldCobranca>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);
  const pageSize = 50;

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
    if (page < totalPages - 1) {
      setPage(page + 1);
    }
  };

  const handlePreviousPage = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  const handlePageClick = (pageNum: number) => {
    setPage(pageNum);
  };

  const filteredCobrancas = cobrancas.filter((cobranca) => {
    const matchesSearch = cobranca.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const sortedCobrancas = [...filteredCobrancas].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === 'dueDate') {
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

  const handleSort = (field: SortFieldCobranca) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortFieldCobranca }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 inline ml-1" />
      : <ArrowDown className="h-4 w-4 inline ml-1" />;
  };

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

  const handleSendMessage = (cobranca: Cobranca) => {
    console.log('Enviando mensagem para:', cobranca.customerName);
    sendMessageMutation.mutate(cobranca.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cobranças</h1>
          <p className="text-muted-foreground mt-1">Gerencie todas as cobranças pendentes</p>
        </div>
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
          <Button variant="outline" className="border-2" data-testid="button-filter">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
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
              sortDirection={sortDirection}
              onSort={handleSort}
              SortIcon={SortIcon}
            />
            
            {/* Paginação */}
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                {total === 0 ? (
                  <span>Nenhuma cobrança encontrada</span>
                ) : (
                  <span>
                    Exibindo {Math.min((page * pageSize) + 1, total)} a {Math.min((page + 1) * pageSize, total)} de {total}
                  </span>
                )}
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>

                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <Button
                        key={idx}
                        variant={page === idx ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageClick(idx)}
                        className="min-w-10"
                        data-testid={`button-page-${idx}`}
                      >
                        {idx + 1}
                      </Button>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={page >= totalPages - 1}
                    data-testid="button-next-page"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-1" />
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
