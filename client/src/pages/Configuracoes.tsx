import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Save, Eye, Power, RotateCcw, RefreshCw, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Config } from "@shared/schema";
import UsersManager from "./UsersManager";
import { TemplatePreview } from "@/components/TemplatePreview";

interface PreviewState {
  isOpen: boolean;
  templateName: string;
  templateContent: string;
}

interface EvolutionInstance {
  instanceName: string;
  status: 'open' | 'closed' | 'connecting' | 'qr' | 'unknown';
  qrCode?: string;
  connected: boolean;
  phone?: string;
  timestamp?: number;
}

export default function Configuracoes() {
  const { toast } = useToast();
  const [previewState, setPreviewState] = useState<PreviewState>({
    isOpen: false,
    templateName: '',
    templateContent: '',
  });
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery<Config>({
    queryKey: ['/api/config'],
  });

  const { data: instanceStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<EvolutionInstance>({
    queryKey: ['/api/evolution/instance/status'],
    refetchInterval: 5000,
    enabled: !!config?.evolutionUrl && !!config?.evolutionApiKey && !!config?.evolutionInstance,
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
    webhookUrl: '',
    diasAviso: 10,
    messageTemplates: {
      venceHoje: '',
      aviso: '',
      atraso: '',
      bloqueio: '',
      desbloqueio: '',
      pagamentoConfirmado: '',
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

  // Auto-show QR code when device needs connection
  useEffect(() => {
    if (instanceStatus?.status === 'qr' || instanceStatus?.status === 'connecting') {
      qrMutation.mutate();
      setShowQrModal(true);
    }
  }, [instanceStatus?.status]);

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

  const restartMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/evolution/instance/restart', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Falha ao reiniciar');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: 'Instância reiniciada' });
      refetchStatus();
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao reiniciar', variant: 'destructive' });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/evolution/instance/stop', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Falha ao parar');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: 'Instância parada' });
      refetchStatus();
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao parar', variant: 'destructive' });
    },
  });

  const qrMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/evolution/instance/qrcode');
      if (!response.ok) throw new Error('Falha ao obter QR code');
      return response.json();
    },
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      setShowQrModal(true);
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao obter QR code', variant: 'destructive' });
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

  const openPreview = (name: string, content: string) => {
    setPreviewState({
      isOpen: true,
      templateName: name,
      templateContent: content,
    });
  };

  const closePreview = () => {
    setPreviewState({
      isOpen: false,
      templateName: '',
      templateContent: '',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'closed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'qr':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      open: 'Conectado',
      closed: 'Desconectado',
      connecting: 'Conectando',
      qr: 'Aguardando QR',
      unknown: 'Desconhecido',
    };
    return labels[status] || status;
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
    <>
      <TemplatePreview 
        isOpen={previewState.isOpen}
        onClose={closePreview}
        templateName={previewState.templateName}
        templateContent={previewState.templateContent}
      />
      
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Conectar WhatsApp</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {qrCode ? (
              <>
                <div className="flex justify-center">
                  <div className="bg-white p-6 rounded-lg shadow-lg border border-border">
                    <img
                      src={qrCode}
                      alt="QR Code WhatsApp"
                      className="w-72 h-72"
                      data-testid="img-qrcode"
                    />
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-500 p-4 rounded">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Como conectar o dispositivo:
                  </p>
                  <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-decimal">
                    <li>Abra WhatsApp no seu telefone</li>
                    <li>Vá para Configurações &gt; Dispositivos conectados &gt; Conectar um dispositivo</li>
                    <li>Aponte a câmera do telefone para o QR code acima</li>
                    <li>Aguarde a conexão (pode levar alguns segundos)</li>
                  </ol>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-80">
                <div className="text-center space-y-4">
                  <div className="animate-spin inline-block">
                    <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                  <p className="text-muted-foreground font-medium">
                    Gerando QR code...
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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

          <Card className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950">
            <CardHeader>
              <CardTitle className="text-blue-900 dark:text-blue-100">Webhook Asaas</CardTitle>
              <CardDescription className="text-blue-800 dark:text-blue-200">Configure a notificação automática de eventos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url" className="text-blue-900 dark:text-blue-100">URL Base do Servidor</Label>
                <Input
                  id="webhook-url"
                  value={formData.webhookUrl || ''}
                  onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  placeholder="Ex: https://seu-dominio.com ou deixe em branco para auto-detectar"
                  className="border-2 bg-white dark:bg-gray-900 text-blue-900 dark:text-blue-100"
                  data-testid="input-webhook-url"
                />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Configure se usar um servidor próprio. Deixe vazio para usar a URL da aplicação automaticamente
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">URL do Webhook:</p>
                <div className="bg-white dark:bg-gray-900 p-3 rounded border border-blue-300 dark:border-blue-700 font-mono text-xs break-all">
                  {(formData.webhookUrl || window.location.origin)}/api/webhook/asaas
                </div>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Copie esta URL e configure no Asaas para receber eventos automáticos de pagamentos
                </p>
              </div>
              
              <div className="space-y-2 pt-4 border-t border-blue-300 dark:border-blue-700">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Como configurar:</p>
                <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Acesse <span className="font-mono">app.asaas.com</span></li>
                  <li>Vá em Configurações → Webhooks</li>
                  <li>Clique em "Novo Webhook"</li>
                  <li>Cole a URL do webhook acima</li>
                  <li>Selecione os eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_DELETED</li>
                  <li>Salve e teste a conexão</li>
                </ol>
              </div>

              <div className="space-y-2 pt-4 border-t border-blue-300 dark:border-blue-700">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Funcionalidades:</strong> O sistema receberá eventos automáticos de pagamentos, atualizando o status das cobranças em tempo real
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolution" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Evolution API - Configuração</CardTitle>
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

          {formData.evolutionUrl && formData.evolutionApiKey && formData.evolutionInstance && (
            <Card className="border-2 hover-elevate transition-all">
              <CardHeader>
                <CardTitle>Controles da Instância</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {statusLoading ? (
                  <div className="flex items-center justify-center h-20 text-muted-foreground">
                    Carregando status...
                  </div>
                ) : instanceStatus ? (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Nome</p>
                      <p className="text-lg font-bold text-foreground">{instanceStatus.instanceName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                      <Badge className={`text-sm font-semibold border ${getStatusColor(instanceStatus.status)}`}>
                        {getStatusLabel(instanceStatus.status)}
                      </Badge>
                    </div>
                    {instanceStatus.phone && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Telefone</p>
                        <p className="text-lg font-bold text-foreground">{instanceStatus.phone}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Conexão</p>
                      <Badge variant={instanceStatus.connected ? 'default' : 'secondary'}>
                        {instanceStatus.connected ? '✓ Online' : '✕ Offline'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded">
                    Clique em "Atualizar" para carregar o status da instância
                  </div>
                )}

                <div className="flex gap-3 flex-wrap pt-2 border-t">
                  <Button
                    onClick={() => refetchStatus()}
                    disabled={statusLoading}
                    variant="outline"
                    data-testid="button-refresh-evolution"
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${statusLoading ? 'animate-spin' : ''}`} />
                    {statusLoading ? 'Atualizando...' : 'Atualizar'}
                  </Button>

                  <Button
                    onClick={() => qrMutation.mutate()}
                    disabled={qrMutation.isPending}
                    variant="outline"
                    data-testid="button-qrcode"
                    className="gap-2"
                  >
                    <QrCode className="h-4 w-4" />
                    {qrMutation.isPending ? 'Obtendo...' : 'Ver QR Code'}
                  </Button>

                  <Button
                    onClick={() => restartMutation.mutate()}
                    disabled={restartMutation.isPending}
                    variant="outline"
                    data-testid="button-restart-evolution"
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {restartMutation.isPending ? 'Reiniciando...' : 'Reiniciar'}
                  </Button>

                  <Button
                    onClick={() => stopMutation.mutate()}
                    disabled={stopMutation.isPending}
                    variant="destructive"
                    data-testid="button-stop-evolution"
                    className="gap-2"
                  >
                    <Power className="h-4 w-4" />
                    {stopMutation.isPending ? 'Parando...' : 'Parar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Template - Vence Hoje</CardTitle>
                <CardDescription>Mensagem enviada no dia do vencimento</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => openPreview('Vence Hoje', formData.messageTemplates.venceHoje)}
                data-testid="button-preview-vence-hoje"
              >
                <Eye className="h-4 w-4" />
              </Button>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Template - Aviso</CardTitle>
                <CardDescription>Mensagem enviada X dias antes do vencimento</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => openPreview('Aviso', formData.messageTemplates.aviso)}
                data-testid="button-preview-aviso"
              >
                <Eye className="h-4 w-4" />
              </Button>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Template - Atraso</CardTitle>
                <CardDescription>Mensagem para cobranças vencidas</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => openPreview('Atraso', formData.messageTemplates.atraso)}
                data-testid="button-preview-atraso"
              >
                <Eye className="h-4 w-4" />
              </Button>
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
                Variáveis disponíveis: {'{'}{'{'} link_fatura {'}'}{'}'}, {'{'}{'{'} valor {'}'}{'}'}, {'{'}{'{'} vencimento {'}'}{'}'}, {'{'}{'{'} cliente_nome {'}'}{'}'}, {'{'}{'{'} quantidade_cobrancas {'}'}{'}'}, {'{'}{'{'} valor_total {'}'}{'}'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Template - Bloqueio</CardTitle>
                <CardDescription>Mensagem enviada ao bloquear usuário no Traccar</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => openPreview('Bloqueio', formData.messageTemplates.bloqueio || '')}
                data-testid="button-preview-bloqueio"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={8}
                value={formData.messageTemplates.bloqueio || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  messageTemplates: { ...formData.messageTemplates, bloqueio: e.target.value }
                })}
                className="border-2"
                data-testid="textarea-template-bloqueio"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {'{'}{'{'} cliente_nome {'}'}{'}'}, {'{'}{'{'} quantidade_cobrancas {'}'}{'}'}, {'{'}{'{'} link_fatura {'}'}{'}'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Template - Desbloqueio</CardTitle>
                <CardDescription>Mensagem enviada ao desbloquear usuário no Traccar</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => openPreview('Desbloqueio', formData.messageTemplates.desbloqueio || '')}
                data-testid="button-preview-desbloqueio"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={8}
                value={formData.messageTemplates.desbloqueio || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  messageTemplates: { ...formData.messageTemplates, desbloqueio: e.target.value }
                })}
                className="border-2"
                data-testid="textarea-template-desbloqueio"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {'{'}{'{'} cliente_nome {'}'}{'}'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Template - Pagamento Confirmado</CardTitle>
                <CardDescription>Mensagem enviada quando receber webhook de pagamento confirmado</CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => openPreview('Pagamento Confirmado', formData.messageTemplates.pagamentoConfirmado || '')}
                data-testid="button-preview-pagamento-confirmado"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={8}
                value={formData.messageTemplates.pagamentoConfirmado || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  messageTemplates: { ...formData.messageTemplates, pagamentoConfirmado: e.target.value }
                })}
                className="border-2"
                data-testid="textarea-template-pagamento-confirmado"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {'{'}{'{'} cliente_nome {'}'}{'}'}， {'{'}{'{'} valor {'}'}{'}'}， {'{'}{'{'} data {'}'}{'}'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-6">
          <UsersManager />
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
