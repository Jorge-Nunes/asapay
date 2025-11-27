import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink, MessageSquare, ArrowUp, ArrowDown, Phone, MoreHorizontal, Circle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Cobranca } from "@shared/schema";

type SortFieldCobranca = 'customerName' | 'value' | 'dueDate' | 'status' | 'tipo' | 'description';
type SortDirection = 'asc' | 'desc';

interface CobrancaTableProps {
  cobrancas: Cobranca[];
  onSendMessage?: (cobranca: Cobranca) => void;
  sortField?: SortFieldCobranca;
  sortDirection?: SortDirection;
  onSort?: (field: SortFieldCobranca) => void;
  SortIcon?: ({ field }: { field: SortFieldCobranca }) => React.ReactNode;
}

const statusConfig = {
  PENDING: { label: "Pendente", color: "bg-yellow-500", textColor: "text-yellow-700 dark:text-yellow-300" },
  RECEIVED: { label: "Recebido", color: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-300" },
  CONFIRMED: { label: "Confirmado", color: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-300" },
  OVERDUE: { label: "Vencido", color: "bg-red-500", textColor: "text-red-700 dark:text-red-300" },
};

const tipoConfig = {
  vence_hoje: { label: "Vence Hoje", variant: "destructive" as const },
  aviso: { label: "Aviso", variant: "secondary" as const },
  atraso: { label: "Atraso", variant: "destructive" as const },
  processada: { label: "Processada", variant: "outline" as const },
  importada: { label: "Importada", variant: "default" as const },
};

export function CobrancaTable({ cobrancas, onSendMessage, sortField, sortDirection, onSort, SortIcon }: CobrancaTableProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead 
              className={`px-2 py-2 text-xs ${onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}`}
              onClick={() => onSort?.('customerName')}
              data-testid="header-cliente"
            >
              Cliente {SortIcon && sortField === 'customerName' && <SortIcon field="customerName" />}
            </TableHead>
            <TableHead 
              className={`px-2 py-2 text-xs ${onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}`}
              onClick={() => onSort?.('value')}
              data-testid="header-valor"
            >
              Valor {SortIcon && sortField === 'value' && <SortIcon field="value" />}
            </TableHead>
            <TableHead 
              className={`px-2 py-2 text-xs ${onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}`}
              onClick={() => onSort?.('description')}
              data-testid="header-descricao"
            >
              Desc. {SortIcon && sortField === 'description' && <SortIcon field="description" />}
            </TableHead>
            <TableHead 
              className={`px-2 py-2 text-xs ${onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}`}
              onClick={() => onSort?.('tipo')}
              data-testid="header-tipo"
            >
              Tipo {SortIcon && sortField === 'tipo' && <SortIcon field="tipo" />}
            </TableHead>
            <TableHead 
              className={`px-2 py-2 text-xs ${onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}`}
              onClick={() => onSort?.('status')}
              data-testid="header-status"
            >
              Status {SortIcon && sortField === 'status' && <SortIcon field="status" />}
            </TableHead>
            <TableHead 
              className={`px-2 py-2 text-xs ${onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}`}
              onClick={() => onSort?.('dueDate')}
              data-testid="header-vencimento"
            >
              Vencimento {SortIcon && sortField === 'dueDate' && <SortIcon field="dueDate" />}
            </TableHead>
            <TableHead className="text-right px-2 py-2 text-xs">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cobrancas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Nenhuma cobrança encontrada
              </TableCell>
            </TableRow>
          ) : (
            cobrancas.map((cobranca) => (
              <TableRow key={cobranca.id} data-testid={`row-cobranca-${cobranca.id}`} className="hover:bg-muted/50 transition-colors">
                {/* Cliente com Avatar */}
                <TableCell className="px-2 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(cobranca.customerName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs truncate">{cobranca.customerName}</span>
                  </div>
                </TableCell>

                {/* Valor */}
                <TableCell className="px-2 py-2 tabular-nums font-semibold text-foreground text-xs">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cobranca.value)}
                </TableCell>

                {/* Descrição/ID */}
                <TableCell className="px-2 py-2 text-xs text-muted-foreground truncate">
                  {cobranca.description || cobranca.id.slice(0, 8)}
                </TableCell>

                {/* Tipo com Badge melhorado */}
                <TableCell className="px-2 py-2">
                  {(() => {
                    const config = cobranca.tipo ? tipoConfig[cobranca.tipo as keyof typeof tipoConfig] : null;
                    return config ? (
                      <Badge variant={config.variant} className="text-xs">
                        {config.label}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Indefinido</Badge>
                    );
                  })()}
                </TableCell>

                {/* Status com Indicador Visual */}
                <TableCell className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <Circle 
                      className={`h-3 w-3 fill-current ${statusConfig[cobranca.status].color}`}
                    />
                    <span className="text-xs font-medium">{statusConfig[cobranca.status].label}</span>
                  </div>
                </TableCell>

                {/* Data de Vencimento */}
                <TableCell className="px-2 py-2 text-xs tabular-nums">
                  <div className="flex items-center gap-1">
                    {(() => {
                      const [year, month, day] = cobranca.dueDate.split('-').map(Number);
                      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
                    })()}
                    {(() => {
                      const today = new Date();
                      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                      const [todayY, todayM, todayD] = todayStr.split('-').map(Number);
                      const [dueY, dueM, dueD] = cobranca.dueDate.split('-').map(Number);
                      const todayDate = new Date(todayY, todayM - 1, todayD, 12, 0, 0);
                      const dueDate = new Date(dueY, dueM - 1, dueD, 12, 0, 0);
                      const daysUntilDue = Math.floor((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                      
                      // Red dot only for overdue PENDING charges
                      if (daysUntilDue < 0 && cobranca.status === 'PENDING') return <Circle className="h-2 w-2 fill-red-500 text-red-500" />;
                      // Yellow dot for charges due today (only if pending)
                      if (daysUntilDue === 0 && cobranca.status === 'PENDING') return <Circle className="h-2 w-2 fill-yellow-500 text-yellow-500" />;
                      // Orange dot for charges due within 3 days (only if pending)
                      if (daysUntilDue > 0 && daysUntilDue <= 3 && cobranca.status === 'PENDING') return <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />;
                      return null;
                    })()}
                  </div>
                </TableCell>

                {/* Ações */}
                <TableCell className="text-right px-2 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {onSendMessage && cobranca.tipo !== 'processada' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => onSendMessage(cobranca)}
                        data-testid={`button-send-message-${cobranca.id}`}
                        title="Enviar mensagem"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => window.open(cobranca.invoiceUrl, '_blank')}
                      data-testid={`button-view-${cobranca.id}`}
                      title="Ver fatura"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
