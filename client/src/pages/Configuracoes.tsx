import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Config } from "@shared/schema";
import UsersManager from "./UsersManager";

export default function Configuracoes() {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<Config>({
    queryKey: ['/api/config'],
  });

  const [formData, setFormData] = useState<Config>({
    asaasToken: '',
    asaasUrl: 'https://api.asaas.com/v3',
    evolutionUrl: '',
    evolutionInstance: '',
    evolutionApiKey: '',
    traccarUrl: '',
    traccarApiKey: '',
    traccarLimiteCobrancasVencidas: 3,
    diasAviso: 10,
    messageTemplates: {
      venceHoje: '',
      aviso: '',
      atraso: '',
    },
  });

  useEffect(() => {
    if (config) {
      setFormData({
        ...config,
        asaasToken: config.asaasToken || '',
        evolutionApiKey: config.evolutionApiKey || '',
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Config>) => {
      return apiRequest('PUT', '/api/config', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const dataToSend = {
      ...formData,
      asaasToken: formData.asaasToken === '••••••••' ? undefined : formData.asaasToken,
      evolutionApiKey: formData.evolutionApiKey === '••••••••' ? undefined : formData.evolutionApiKey,
      traccarApiKey: formData.traccarApiKey === '••••••••' ? undefined : formData.traccarApiKey,
    };
    
    saveMutation.mutate(dataToSend);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie as configurações do sistema</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending}
          className="bg-primary hover:bg-primary/90"
          data-testid="button-save"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      <Tabs defaultValue="asaas" className="space-y-6">
        <TabsList className="border-2">
          <TabsTrigger value="asaas" data-testid="tab-asaas">Asaas</TabsTrigger>
          <TabsTrigger value="evolution" data-testid="tab-evolution">Evolution API</TabsTrigger>
          <TabsTrigger value="traccar" data-testid="tab-traccar">Traccar</TabsTrigger>
          <TabsTrigger value="preferences" data-testid="tab-preferences">Preferências</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          <TabsTrigger value="usuarios" data-testid="tab-usuarios">Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="asaas" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Integração Asaas</CardTitle>
              <CardDescription>Configure o acesso à API do Asaas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="asaas-token">Token de Acesso</Label>
                <Input
                  id="asaas-token"
                  type="password"
                  value={formData.asaasToken}
                  onChange={(e) => setFormData({ ...formData, asaasToken: e.target.value })}
                  className="border-2"
                  data-testid="input-asaas-token"
                />
                <p className="text-xs text-muted-foreground">
                  Token de API do Asaas (Produção ou Sandbox)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asaas-url">URL da API</Label>
                <Input
                  id="asaas-url"
                  value={formData.asaasUrl}
                  onChange={(e) => setFormData({ ...formData, asaasUrl: e.target.value })}
                  className="border-2"
                  data-testid="input-asaas-url"
                />
                <p className="text-xs text-muted-foreground">
                  Produção: https://api.asaas.com/v3 | Sandbox: https://api-sandbox.asaas.com/v3
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolution" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Evolution API</CardTitle>
              <CardDescription>Configure a integração com WhatsApp</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evolution-url">URL da Evolution API</Label>
                <Input
                  id="evolution-url"
                  value={formData.evolutionUrl}
                  onChange={(e) => setFormData({ ...formData, evolutionUrl: e.target.value })}
                  className="border-2"
                  data-testid="input-evolution-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evolution-instance">Nome da Instância</Label>
                <Input
                  id="evolution-instance"
                  value={formData.evolutionInstance}
                  onChange={(e) => setFormData({ ...formData, evolutionInstance: e.target.value })}
                  className="border-2"
                  data-testid="input-evolution-instance"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evolution-apikey">API Key</Label>
                <Input
                  id="evolution-apikey"
                  type="password"
                  value={formData.evolutionApiKey}
                  onChange={(e) => setFormData({ ...formData, evolutionApiKey: e.target.value })}
                  className="border-2"
                  data-testid="input-evolution-apikey"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traccar" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Integração Traccar GPS</CardTitle>
              <CardDescription>Configure bloqueio automático de usuários com cobranças vencidas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="traccar-url">URL do Servidor Traccar</Label>
                <Input
                  id="traccar-url"
                  value={formData.traccarUrl || ''}
                  onChange={(e) => setFormData({ ...formData, traccarUrl: e.target.value })}
                  placeholder="http://localhost:8082"
                  className="border-2"
                  data-testid="input-traccar-url"
                />
                <p className="text-xs text-muted-foreground">
                  URL completa do servidor Traccar (ex: http://localhost:8082)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="traccar-apikey">Token de Acesso Traccar</Label>
                <Input
                  id="traccar-apikey"
                  type="password"
                  value={formData.traccarApiKey || ''}
                  onChange={(e) => setFormData({ ...formData, traccarApiKey: e.target.value })}
                  className="border-2"
                  data-testid="input-traccar-apikey"
                />
                <p className="text-xs text-muted-foreground">
                  Token de API do Traccar para autenticação
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="traccar-limite">Limite de Cobranças Vencidas</Label>
                <Input
                  id="traccar-limite"
                  type="number"
                  min="1"
                  value={formData.traccarLimiteCobrancasVencidas || 3}
                  onChange={(e) => setFormData({ ...formData, traccarLimiteCobrancasVencidas: parseInt(e.target.value) || 3 })}
                  className="border-2"
                  data-testid="input-traccar-limite"
                />
                <p className="text-xs text-muted-foreground">
                  Quantas cobranças vencidas são necessárias para bloquear um usuário no Traccar
                </p>
              </div>
              <div className="pt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Como funciona:</strong> Quando um usuário no Asaas tiver mais cobranças vencidas que o limite configurado, ele será bloqueado automaticamente no Traccar. A correspondência é feita por telefone e email.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Preferências de Envio</CardTitle>
              <CardDescription>Configure quando as mensagens devem ser enviadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dias-aviso">Dias de Aviso</Label>
                <Input
                  id="dias-aviso"
                  type="number"
                  value={formData.diasAviso}
                  onChange={(e) => setFormData({ ...formData, diasAviso: parseInt(e.target.value) || 10 })}
                  className="border-2"
                  data-testid="input-dias-aviso"
                />
                <p className="text-xs text-muted-foreground">
                  Quantos dias antes do vencimento enviar o aviso
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Template - Vence Hoje</CardTitle>
              <CardDescription>Mensagem enviada no dia do vencimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={8}
                value={formData.messageTemplates.venceHoje}
                onChange={(e) => setFormData({
                  ...formData,
                  messageTemplates: { ...formData.messageTemplates, venceHoje: e.target.value }
                })}
                className="border-2"
                data-testid="textarea-template-vence-hoje"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {'{'}{'{'} link_fatura {'}'}{'}'}, {'{'}{'{'} valor {'}'}{'}'}, {'{'}{'{'} vencimento {'}'}{'}'}, {'{'}{'{'} cliente_nome {'}'}{'}'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Template - Aviso</CardTitle>
              <CardDescription>Mensagem enviada X dias antes do vencimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={8}
                value={formData.messageTemplates.aviso}
                onChange={(e) => setFormData({
                  ...formData,
                  messageTemplates: { ...formData.messageTemplates, aviso: e.target.value }
                })}
                className="border-2"
                data-testid="textarea-template-aviso"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {'{'}{'{'} link_fatura {'}'}{'}'}, {'{'}{'{'} valor {'}'}{'}'}, {'{'}{'{'} vencimento {'}'}{'}'}, {'{'}{'{'} dias_aviso {'}'}{'}'}, {'{'}{'{'} cliente_nome {'}'}{'}'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Template - Atraso</CardTitle>
              <CardDescription>Mensagem para cobranças vencidas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={8}
                value={formData.messageTemplates.atraso}
                onChange={(e) => setFormData({
                  ...formData,
                  messageTemplates: { ...formData.messageTemplates, atraso: e.target.value }
                })}
                className="border-2"
                data-testid="textarea-template-atraso"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {'{'}{'{'} link_fatura {'}'}{'}'}, {'{'}{'{'} valor {'}'}{'}'}, {'{'}{'{'} vencimento {'}'}{'}'}, {'{'}{'{'} cliente_nome {'}'}{'}'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-6">
          <UsersManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
