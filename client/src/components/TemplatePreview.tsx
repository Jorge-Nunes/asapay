import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TemplatePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  templateName: string;
  templateContent: string;
}

export function TemplatePreview({ isOpen, onClose, templateName, templateContent }: TemplatePreviewProps) {
  // Sample data for variable replacement
  const sampleData: Record<string, string> = {
    "{{cliente_nome}}": "João Silva",
    "{{nome}}": "João Silva",
    "{{valor}}": "R$ 150,00",
    "{{data}}": new Date().toLocaleDateString('pt-BR'),
    "{{link_fatura}}": "https://asaas.com/fatura/123",
    "{{vencimento}}": new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
    "{{dias_aviso}}": "10",
    "{{quantidade_cobrancas}}": "2",
    "{{valor_total}}": "R$ 300,00",
  };

  // Replace all template variables with sample data
  let previewContent = templateContent;
  Object.entries(sampleData).forEach(([key, value]) => {
    previewContent = previewContent.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });

  // Convert template text to WhatsApp format
  // Bold text: *text* -> bold
  // Line breaks are preserved
  const formatMessage = (text: string) => {
    return text.split('\n').map((line, idx) => (
      <div key={idx}>
        {line.split(/(\*[^*]+\*)/).map((part, i) => (
          part.startsWith('*') && part.endsWith('*') ? (
            <span key={i} className="font-bold">
              {part.slice(1, -1)}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        ))}
      </div>
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white dark:bg-gray-950">
        <DialogHeader>
          <DialogTitle>Preview: {templateName}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-96">
          {/* Phone frame */}
          <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-2xl p-3 flex flex-col">
            {/* Phone header */}
            <div className="bg-green-600 text-white px-4 py-3 rounded-t-xl text-sm">
              <div className="font-semibold">TEKSAT Rastreamento</div>
              <div className="text-xs opacity-75">online</div>
            </div>

            {/* Messages area */}
            <ScrollArea className="flex-1 bg-gray-100 dark:bg-gray-900 p-4">
              <div className="space-y-2">
                {/* Incoming message bubble */}
                <div className="flex justify-end">
                  <div className="bg-green-500 text-white rounded-lg rounded-tr-none px-3 py-2 max-w-xs text-sm leading-relaxed">
                    {formatMessage(previewContent)}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Phone footer */}
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-b-xl border-t border-gray-300 dark:border-gray-700 text-xs text-gray-500">
              <div>Type a message...</div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3 text-center">
            Visualização de como a mensagem aparecerá no WhatsApp do cliente
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
