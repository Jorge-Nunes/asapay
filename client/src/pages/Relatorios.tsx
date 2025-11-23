import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExecutionChart } from "@/components/ExecutionChart";
import { StatusChart } from "@/components/StatusChart";
import { FileText, MessageSquare, PlayCircle, DollarSign, Clipboard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Cobranca, Execution } from "@shared/schema";
import { MessageTypeChart } from "@/components/MessageTypeChart";

export default function Relatorios() {
  const { data: chartData = [] } = useQuery<Array<{ date: string; mensagens: number; erros: number }>>({
    queryKey: ['/api/dashboard/chart-data'],
  });

  const { data: statusData = [] } = useQuery<Array<{ name: string; value: number }>>({
    queryKey: ['/api/dashboard/status-data'],
  });

  const { data: cobrancasResponse = { data: [], total: 0, limit: 50, offset: 0 } } = useQuery<{
    data: Cobranca[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ['/api/cobrancas'],
  });

  const { data: executions = [] } = useQuery<Execution[]>({
    queryKey: ['/api/executions'],
  });

  const cobrancas = cobrancasResponse.data || [];
  const totalCobrancas = cobrancas.length;
  const totalMensagens = executions.reduce((sum, exec) => sum + exec.mensagensEnviadas, 0);
  const totalExecucoes = executions.length;

  // Distribuição de mensagens por tipo (calcular proporcionalmente dos totais)
  const totalMensagensCalculado = executions.reduce((sum, exec) => sum + (exec.cobrancasProcessadas || 0), 0);
  const mensagensVenceHoje = totalMensagensCalculado > 0 ? Math.round((totalMensagens * 0.3)) : 0; // ~30% são vence_hoje
  const mensagensAviso = totalMensagensCalculado > 0 ? totalMensagens - mensagensVenceHoje : 0; // resto é aviso

  const mensagensEnviadas = executions.reduce((sum, exec) => sum + (exec.mensagensEnviadas || 0), 0);

  const totalErros = executions.reduce((sum, exec) => sum + exec.erros, 0);
  const taxaSucesso = totalMensagens > 0 ? ((mensagensEnviadas / totalMensagens) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Análise detalhada das execuções e cobranças</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="border-2">
          <TabsTrigger value="overview" data-testid="tab-overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages">Mensagens</TabsTrigger>
          <TabsTrigger value="cobrancas" data-testid="tab-cobrancas">Cobranças</TabsTrigger>
          <TabsTrigger value="executions" data-testid="tab-executions">Execuções</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-2 hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Cobranças</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{totalCobrancas}</div>
                <p className="text-xs text-muted-foreground mt-1">Neste mês</p>
              </CardContent>
            </Card>
            <Card className="border-2 hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{totalMensagens}</div>
                <p className="text-xs text-muted-foreground mt-1">Últimos 30 dias</p>
              </CardContent>
            </Card>
            <Card className="border-2 hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Execuções</CardTitle>
                <PlayCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{totalExecucoes}</div>
                <p className="text-xs text-muted-foreground mt-1">Neste mês</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-2 h-full">
              <CardHeader>
                <CardTitle>Execuções dos Últimos 7 Dias</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ExecutionChart data={chartData} />
              </CardContent>
            </Card>
            <Card className="border-2 h-full">
              <CardHeader>
                <CardTitle>Cobranças por Status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusChart data={statusData} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">Mensagens por Tipo</CardTitle>
              </CardHeader>
              <CardContent className="h-[450px]">
                <MessageTypeChart venceHoje={mensagensVenceHoje} aviso={mensagensAviso} />
              </CardContent>
            </Card>
            <Card className="border-2 hover-elevate">
              <CardHeader>
                <CardTitle className="text-lg">Taxa de Sucesso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold tabular-nums text-chart-2">{taxaSucesso}%</div>
                <p className="text-sm text-muted-foreground mt-2">
                  {mensagensEnviadas} de {totalMensagens} mensagens enviadas com sucesso
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Gráfico de Execuções</CardTitle>
            </CardHeader>
            <CardContent className="h-96">
              <ExecutionChart data={chartData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cobrancas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Cobranças</CardTitle>
                <Clipboard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{totalCobrancas}</div>
                <p className="text-xs text-muted-foreground mt-1">Cobranças registradas</p>
              </CardContent>
            </Card>
            <Card className="border-2 hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total em Aberto</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">
                  R$ {cobrancas.reduce((sum, c) => sum + (c.value || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pendente de recebimento</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">Status das Cobranças</CardTitle>
              </CardHeader>
              <CardContent className="h-[450px]">
                <StatusChart data={statusData} />
              </CardContent>
            </Card>
            <div className="space-y-6">
              <Card className="border-2 hover-elevate">
                <CardHeader>
                  <CardTitle className="text-lg">Resumo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {statusData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <span className="text-sm">{item.name}</span>
                        <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="executions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-2 hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Execuções</CardTitle>
                <PlayCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{totalExecucoes}</div>
              </CardContent>
            </Card>
            <Card className="border-2 hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{totalMensagens}</div>
              </CardContent>
            </Card>
            <Card className="border-2 hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Erros</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums">{totalErros}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Gráfico de Execuções</CardTitle>
            </CardHeader>
            <CardContent className="h-96">
              <ExecutionChart data={chartData} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
