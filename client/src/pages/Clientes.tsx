import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, Download, Edit2 } from "lucide-react";
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
}

export default function Clientes() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ blockDailyMessages: false, diasAtrasoNotificacao: 3 });

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
    mutationFn: async ({ clientId, blockDailyMessages, diasAtrasoNotificacao }: { clientId: string; blockDailyMessages: boolean; diasAtrasoNotificacao: number }) => {
      const response = await fetch(`/api/clients/${clientId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockDailyMessages, diasAtrasoNotificacao }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar preferências');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      setEditingClientId(null);
      toast({
        title: "Sucesso",
        description: "Preferências atualizadas com sucesso!",
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

  const filteredClients = clients.filter((client) => {
    const matchesSearch = 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm);
    return matchesSearch;
  });

  const handleSync = () => {
    syncMutation.mutate();
  };

  const handleEditClick = (client: ClientWithPreferences) => {
    setEditingClientId(client.id);
    setEditFormData({
      blockDailyMessages: Boolean(client.blockDailyMessages),
      diasAtrasoNotificacao: client.diasAtrasoNotificacao || 3,
    });
  };

  const handleSavePreferences = (clientId: string) => {
    updatePreferencesMutation.mutate({
      clientId,
      blockDailyMessages: editFormData.blockDailyMessages,
      diasAtrasoNotificacao: editFormData.diasAtrasoNotificacao,
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
                  <th className="px-4 py-3 text-left text-sm font-semibold">Nome</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Telefone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Bloqueado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Dias Atraso</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
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
