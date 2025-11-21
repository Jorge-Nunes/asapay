import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, Download, Edit2, ArrowUp, ArrowDown, Lock, Unlock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ClientData } from "@shared/schema";

interface ClientWithPreferences extends ClientData {
  blockDailyMessages: number;
  diasAtrasoNotificacao: number;
  traccarUserId?: string | null;
  isTraccarBlocked?: number;
}

type SortFieldClient = 'name' | 'email' | 'phone' | 'blockDailyMessages' | 'diasAtrasoNotificacao' | 'traccarUserId';
type SortDirection = 'asc' | 'desc';

export default function Clientes() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ blockDailyMessages: false, diasAtrasoNotificacao: 3, traccarUserId: '' });
  const [sortField, setSortField] = useState<SortFieldClient>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [blockingClientId, setBlockingClientId] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery<ClientWithPreferences[]>({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await fetch('/api/clients');
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/clients/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao sincronizar clientes');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({
        title: "Sucesso",
        description: `${data.count} clientes sincronizados com sucesso!`,
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

  const updatePreferencesMutation = useMutation({
    mutationFn: async ({ clientId, blockDailyMessages, diasAtrasoNotificacao, traccarUserId }: { clientId: string; blockDailyMessages: boolean; diasAtrasoNotificacao: number; traccarUserId: string }) => {
      // Update preferences
      const response1 = await fetch(`/api/clients/${clientId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockDailyMessages, diasAtrasoNotificacao }),
      });
      if (!response1.ok) {
        const error = await response1.json();
        throw new Error(error.error || 'Erro ao atualizar preferências');
      }

      // Update traccar mapping
      const response2 = await fetch(`/api/clients/${clientId}/traccar-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traccarUserId: traccarUserId || null }),
      });
      if (!response2.ok) {
        const error = await response2.json();
        throw new Error(error.error || 'Erro ao atualizar mapeamento Traccar');
      }

      return response2.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      setEditingClientId(null);
      toast({
        title: "Sucesso",
        description: "Preferências e mapeamento atualizados com sucesso!",
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

  const blockTraccarMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const action = blockingClientId?.includes('unblock-') ? 'unblock' : 'block';
      const actualClientId = blockingClientId?.replace('unblock-', '') || clientId;
      const response = await fetch(`/api/clients/${actualClientId}/${action}-traccar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao alterar bloqueio Traccar');
      }
      return response.json();
    },
    onSuccess: (data, clientId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      setBlockingClientId(null);
      toast({
        title: "Sucesso",
        description: data.message || "Status Traccar atualizado com sucesso!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      setBlockingClientId(null);
    },
  });

  const filteredClients = clients.filter((client) => {
    const matchesSearch = 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm);
    return matchesSearch;
  });

  const sortedClients = [...filteredClients].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

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

  const handleSort = (field: SortFieldClient) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortFieldClient }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 inline ml-1" />
      : <ArrowDown className="h-4 w-4 inline ml-1" />;
  };

  const handleSync = () => {
    syncMutation.mutate();
  };

  const handleEditClick = (client: ClientWithPreferences) => {
    setEditingClientId(client.id);
    setEditFormData({
      blockDailyMessages: Boolean(client.blockDailyMessages),
      diasAtrasoNotificacao: client.diasAtrasoNotificacao || 3,
      traccarUserId: client.traccarUserId || '',
    });
  };

  const handleSavePreferences = (clientId: string) => {
    updatePreferencesMutation.mutate({
      clientId,
      blockDailyMessages: editFormData.blockDailyMessages,
      diasAtrasoNotificacao: editFormData.diasAtrasoNotificacao,
      traccarUserId: editFormData.traccarUserId,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gerencie as preferências de notificação dos clientes</p>
        </div>
        <Button 
          onClick={handleSync}
          disabled={syncMutation.isPending}
          size="sm"
          data-testid="button-sync-clients"
        >
          <Download className="h-4 w-4 mr-2" />
          {syncMutation.isPending ? "Sincronizando..." : "Sincronizar com Asaas"}
        </Button>
      </div>

      {/* Filtros */}
      <Card className="border-2 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 border-2"
            data-testid="input-search-cliente"
          />
        </div>
      </Card>

      {/* Tabela de Clientes */}
      <Card className="border-2 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando clientes...</div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum cliente encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-accent/50 select-none"
                    onClick={() => handleSort('name')}
                    data-testid="header-nome"
                  >
                    Nome <SortIcon field="name" />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-accent/50 select-none"
                    onClick={() => handleSort('email')}
                    data-testid="header-email"
                  >
                    Email <SortIcon field="email" />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-accent/50 select-none"
                    onClick={() => handleSort('phone')}
                    data-testid="header-telefone"
                  >
                    Telefone <SortIcon field="phone" />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-accent/50 select-none"
                    onClick={() => handleSort('blockDailyMessages')}
                    data-testid="header-bloqueado"
                  >
                    Bloqueado <SortIcon field="blockDailyMessages" />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-accent/50 select-none"
                    onClick={() => handleSort('diasAtrasoNotificacao')}
                    data-testid="header-dias-atraso"
                  >
                    Dias Atraso <SortIcon field="diasAtrasoNotificacao" />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-accent/50 select-none"
                    onClick={() => handleSort('traccarUserId')}
                    data-testid="header-mapeado"
                  >
                    Mapeado <SortIcon field="traccarUserId" />
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedClients.map((client) => (
                  <tr key={client.id} className="border-b hover:bg-muted/30 transition-colors" data-testid={`row-client-${client.id}`}>
                    <td className="px-4 py-3 text-sm">{client.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{client.email || '-'}</td>
                    <td className="px-4 py-3 text-sm">{client.mobilePhone || client.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="inline-flex items-center gap-2">
                        {Boolean(client.blockDailyMessages) ? (
                          <span className="px-2 py-1 bg-destructive/10 text-destructive text-xs rounded">Sim</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-500/10 text-green-700 dark:text-green-400 text-xs rounded">Não</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{client.diasAtrasoNotificacao || 3} dias</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {client.traccarUserId ? (
                          <>
                            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs rounded">
                              Mapeado
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => {
                                const action = Boolean(client.isTraccarBlocked) ? `unblock-${client.id}` : `block-${client.id}`;
                                setBlockingClientId(action);
                                blockTraccarMutation.mutate(client.id);
                              }}
                              disabled={blockTraccarMutation.isPending}
                              title={Boolean(client.isTraccarBlocked) ? "Desbloquear na Traccar" : "Bloquear na Traccar"}
                              data-testid={`button-toggle-traccar-${client.id}`}
                            >
                              {Boolean(client.isTraccarBlocked) ? (
                                <Unlock className="h-3 w-3 text-green-600 dark:text-green-400" />
                              ) : (
                                <Lock className="h-3 w-3 text-red-600 dark:text-red-400" />
                              )}
                            </Button>
                          </>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 text-xs rounded">
                            Não Mapeado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Dialog open={editingClientId === client.id} onOpenChange={(open) => !open && setEditingClientId(null)}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditClick(client)}
                            data-testid={`button-edit-client-${client.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Preferências</DialogTitle>
                            <DialogDescription>
                              Ajuste as preferências de notificação para {client.name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <Label htmlFor="blockMessages" className="text-base">Bloquear mensagens de atraso?</Label>
                              <div className="flex items-center gap-2">
                                <Switch
                                  id="blockMessages"
                                  checked={editFormData.blockDailyMessages}
                                  onCheckedChange={(checked) =>
                                    setEditFormData(prev => ({ ...prev, blockDailyMessages: checked }))
                                  }
                                  data-testid="switch-block-messages"
                                />
                                <span className="text-sm text-muted-foreground">
                                  {editFormData.blockDailyMessages ? "Mensagens bloqueadas" : "Mensagens ativas"}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="diasAtraso" className="text-base">Intervalo entre mensagens de atraso (dias)</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  id="diasAtraso"
                                  type="number"
                                  min="1"
                                  max="30"
                                  value={editFormData.diasAtrasoNotificacao}
                                  onChange={(e) =>
                                    setEditFormData(prev => ({
                                      ...prev,
                                      diasAtrasoNotificacao: Math.max(1, parseInt(e.target.value) || 1)
                                    }))
                                  }
                                  data-testid="input-dias-atraso"
                                  className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">dias</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="traccarUserId" className="text-base">ID do Usuário Traccar (mapeamento)</Label>
                              <Input
                                id="traccarUserId"
                                type="text"
                                placeholder="Ex: 12345"
                                value={editFormData.traccarUserId}
                                onChange={(e) =>
                                  setEditFormData(prev => ({
                                    ...prev,
                                    traccarUserId: e.target.value
                                  }))
                                }
                                data-testid="input-traccar-user-id"
                              />
                              <p className="text-xs text-muted-foreground">
                                Deixe em branco para remover o mapeamento
                              </p>
                            </div>

                            <Button
                              onClick={() => handleSavePreferences(client.id)}
                              disabled={updatePreferencesMutation.isPending}
                              className="w-full"
                              data-testid="button-save-preferences"
                            >
                              {updatePreferencesMutation.isPending ? "Salvando..." : "Salvar Preferências"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Stats */}
      {clients.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 border-2">
            <div className="text-sm text-muted-foreground">Total de Clientes</div>
            <div className="text-2xl font-bold">{clients.length}</div>
          </Card>
          <Card className="p-4 border-2">
            <div className="text-sm text-muted-foreground">Bloqueados</div>
            <div className="text-2xl font-bold">{clients.filter(c => c.blockDailyMessages).length}</div>
          </Card>
          <Card className="p-4 border-2">
            <div className="text-sm text-muted-foreground">Ativos</div>
            <div className="text-2xl font-bold">{clients.filter(c => !c.blockDailyMessages).length}</div>
          </Card>
        </div>
      )}
    </div>
  );
}
