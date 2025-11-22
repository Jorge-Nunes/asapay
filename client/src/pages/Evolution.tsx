import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Power, RotateCcw, Plus, RefreshCw, QrCode } from 'lucide-react';

interface EvolutionInstance {
  instanceName: string;
  status: 'open' | 'closed' | 'connecting' | 'qr' | 'unknown';
  qrCode?: string;
  connected: boolean;
  phone?: string;
  timestamp?: number;
}

export default function Evolution() {
  const { toast } = useToast();
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const { data: status, isLoading, refetch } = useQuery<EvolutionInstance>({
    queryKey: ['/api/evolution/instance/status'],
    refetchInterval: 5000,
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
      refetch();
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
      refetch();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Integração Evolution</h1>
        <p className="text-muted-foreground mt-2">Gerenciar instância WhatsApp via Evolution API</p>
      </div>

      {/* Status Card */}
      <Card className="hover-elevate transition-all">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Status da Instância</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh-evolution"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Carregando...
            </div>
          ) : status ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Nome</p>
                  <p className="text-lg font-bold text-foreground">{status.instanceName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                  <Badge className={`text-sm font-semibold border ${getStatusColor(status.status)}`}>
                    {getStatusLabel(status.status)}
                  </Badge>
                </div>
                {status.phone && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Telefone</p>
                    <p className="text-lg font-bold text-foreground">{status.phone}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Conexão</p>
                  <Badge variant={status.connected ? 'default' : 'secondary'}>
                    {status.connected ? '✓ Online' : '✕ Offline'}
                  </Badge>
                </div>
              </div>

              {/* Controles */}
              <div className="flex gap-3 flex-wrap pt-4">
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
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações */}
      <Card>
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>📱 <strong>Status:</strong> Monitora em tempo real a conexão WhatsApp</p>
          <p>📲 <strong>QR Code:</strong> Escaneie para autenticar nova instância</p>
          <p>🔄 <strong>Reiniciar:</strong> Reconecta a instância mantendo sessão</p>
          <p>⏹️ <strong>Parar:</strong> Desconecta e encerra a instância</p>
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            {qrCode ? (
              <div className="bg-white p-4 rounded-lg border-2 border-border">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                  data-testid="img-qrcode"
                />
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                Carregando QR code...
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Abra WhatsApp no seu telefone e escaneie este código para conectar
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
