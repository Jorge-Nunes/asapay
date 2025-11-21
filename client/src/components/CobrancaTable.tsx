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

type SortFieldCobranca = 'customerName' | 'value' | 'dueDate' | 'status' | 'tipo';
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
  processada: { label: "Processada", variant: "outline" as const },
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
              className={onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}
              onClick={() => onSort?.('customerName')}
              data-testid="header-cliente"
            >
              Cliente {SortIcon && sortField === 'customerName' && <SortIcon field="customerName" />}
            </TableHead>
            <TableHead 
              className={onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}
              onClick={() => onSort?.('value')}
              data-testid="header-valor"
            >
              Valor {SortIcon && sortField === 'value' && <SortIcon field="value" />}
            </TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead 
              className={onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}
              onClick={() => onSort?.('status')}
              data-testid="header-status"
            >
              Status {SortIcon && sortField === 'status' && <SortIcon field="status" />}
            </TableHead>
            <TableHead 
              className={onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}
              onClick={() => onSort?.('dueDate')}
              data-testid="header-vencimento"
            >
              Vencimento {SortIcon && sortField === 'dueDate' && <SortIcon field="dueDate" />}
            </TableHead>
            <TableHead className="text-right w-24">Ações</TableHead>
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
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(cobranca.customerName)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{cobranca.customerName}</span>
                  </div>
                </TableCell>

                {/* Valor */}
                <TableCell className="tabular-nums font-semibold text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cobranca.value)}
                </TableCell>

                {/* Descrição/ID */}
                <TableCell className="text-sm text-muted-foreground">
                  {cobranca.description || cobranca.id.slice(0, 8)}
                </TableCell>

                {/* Tipo com Badge melhorado */}
                <TableCell>
                  {cobranca.tipo ? (
                    <Badge variant={tipoConfig[cobranca.tipo].variant} className="text-xs">
                      {tipoConfig[cobranca.tipo].label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Indefinido</Badge>
                  )}
                </TableCell>

                {/* Status com Indicador Visual */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Circle 
                      className={`h-3 w-3 fill-current ${statusConfig[cobranca.status].color}`}
                    />
                    <span className="text-sm font-medium">{statusConfig[cobranca.status].label}</span>
                  </div>
                </TableCell>

                {/* Data de Vencimento */}
                <TableCell className="text-sm tabular-nums">
                  <div className="flex items-center gap-1">
                    {format(new Date(cobranca.dueDate), 'dd/MM/yyyy', { locale: ptBR })}
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const dueDate = new Date(cobranca.dueDate);
                      dueDate.setHours(0, 0, 0, 0);
                      const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      
                      if (daysUntilDue < 0) return <Circle className="h-2 w-2 fill-red-500 text-red-500" />;
                      if (daysUntilDue === 0) return <Circle className="h-2 w-2 fill-yellow-500 text-yellow-500" />;
                      if (daysUntilDue <= 3) return <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />;
                      return null;
                    })()}
                  </div>
                </TableCell>

                {/* Ações */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {onSendMessage && (
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
