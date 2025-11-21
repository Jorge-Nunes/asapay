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
import { ExternalLink, MessageSquare, ArrowUp, ArrowDown } from "lucide-react";
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
  PENDING: { label: "Pendente", variant: "secondary" as const },
  RECEIVED: { label: "Recebido", variant: "default" as const },
  CONFIRMED: { label: "Confirmado", variant: "default" as const },
  OVERDUE: { label: "Vencido", variant: "destructive" as const },
};

const tipoConfig = {
  vence_hoje: { label: "Vence Hoje", variant: "destructive" as const },
  aviso: { label: "Aviso", variant: "secondary" as const },
  processada: { label: "Processada", variant: "outline" as const },
};

export function CobrancaTable({ cobrancas, onSendMessage, sortField, sortDirection, onSort, SortIcon }: CobrancaTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
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
            <TableHead 
              className={onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}
              onClick={() => onSort?.('dueDate')}
              data-testid="header-vencimento"
            >
              Vencimento {SortIcon && sortField === 'dueDate' && <SortIcon field="dueDate" />}
            </TableHead>
            <TableHead 
              className={onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}
              onClick={() => onSort?.('status')}
              data-testid="header-status"
            >
              Status {SortIcon && sortField === 'status' && <SortIcon field="status" />}
            </TableHead>
            <TableHead 
              className={onSort ? "cursor-pointer hover:bg-accent/50 select-none" : ""}
              onClick={() => onSort?.('tipo')}
              data-testid="header-tipo"
            >
              Tipo {SortIcon && sortField === 'tipo' && <SortIcon field="tipo" />}
            </TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cobrancas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhuma cobrança encontrada
              </TableCell>
            </TableRow>
          ) : (
            cobrancas.map((cobranca) => (
              <TableRow key={cobranca.id} data-testid={`row-cobranca-${cobranca.id}`} className="hover-elevate">
                <TableCell className="font-medium">{cobranca.customerName}</TableCell>
                <TableCell className="tabular-nums">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cobranca.value)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {format(new Date(cobranca.dueDate), 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig[cobranca.status].variant}>
                    {statusConfig[cobranca.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {cobranca.tipo && (
                    <Badge variant={tipoConfig[cobranca.tipo].variant} className="text-xs">
                      {tipoConfig[cobranca.tipo].label}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(cobranca.invoiceUrl, '_blank')}
                      data-testid={`button-view-${cobranca.id}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    {onSendMessage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSendMessage(cobranca)}
                        data-testid={`button-send-message-${cobranca.id}`}
                      >
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    )}
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
