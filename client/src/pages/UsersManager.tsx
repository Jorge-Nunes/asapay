import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit2, Plus } from "lucide-react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function UsersManager() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({ username: "", password: "" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      return await axios.post("/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setFormData({ username: "", password: "" });
      setIsCreateDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.response?.data?.error || "Erro ao criar usuário",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      return await axios.put(`/api/users/${selectedUser.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setFormData({ username: "", password: "" });
      setIsEditDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.response?.data?.error || "Erro ao atualizar usuário",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await axios.delete(`/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Sucesso",
        description: "Usuário deletado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.response?.data?.error || "Erro ao deletar usuário",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!formData.username || !formData.password) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setFormData({ username: user.username, password: "" });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!formData.username) {
      toast({
        title: "Erro",
        description: "O nome de usuário é obrigatório",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Usuários</h2>
          <p className="text-muted-foreground mt-1">Crie, edite e delete usuários do sistema</p>
        </div>
        <Button
          data-testid="button-create-user"
          onClick={() => {
            setFormData({ username: "", password: "" });
            setIsCreateDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando usuários...</p>
      ) : users.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum usuário encontrado</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Usuário</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Data de Criação</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user: any) => (
                  <tr key={user.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 text-sm font-medium">{user.username}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-right flex gap-2 justify-end">
                      <Button
                        data-testid={`button-edit-user-${user.id}`}
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        data-testid={`button-delete-user-${user.id}`}
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>Adicione um novo usuário ao sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Usuário</label>
              <Input
                data-testid="input-new-username"
                placeholder="Nome de usuário"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Senha</label>
              <Input
                data-testid="input-new-password"
                type="password"
                placeholder="Senha"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <Button
              data-testid="button-submit-create"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full"
            >
              {createMutation.isPending ? "Criando..." : "Criar Usuário"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize as informações do usuário</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Usuário</label>
              <Input
                data-testid="input-edit-username"
                placeholder="Nome de usuário"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Nova Senha (deixe em branco para manter)</label>
              <Input
                data-testid="input-edit-password"
                type="password"
                placeholder="Nova senha"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <Button
              data-testid="button-submit-edit"
              onClick={handleUpdateUser}
              disabled={updateMutation.isPending}
              className="w-full"
            >
              {updateMutation.isPending ? "Atualizando..." : "Atualizar Usuário"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
