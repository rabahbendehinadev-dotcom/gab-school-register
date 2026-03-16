import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListStaff, useCreateStaff, useDeleteStaff, getListStaffQueryKey, CreateStaffBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Shield } from "lucide-react";
import { useForm } from "react-hook-form";

export default function Staff() {
  const queryClient = useQueryClient();
  const { data: staff, isLoading } = useListStaff();
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useCreateStaff({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        setIsOpen(false);
        form.reset();
      }
    }
  });

  const deleteMutation = useDeleteStaff({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() })
    }
  });

  const form = useForm<CreateStaffBody>({
    defaultValues: { role: "staff" }
  });

  const onSubmit = (data: CreateStaffBody) => {
    createMutation.mutate({ data });
  };

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading staff...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Staff Management</h2>
          <p className="text-muted-foreground">Manage user accounts and permissions.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-lg shadow-primary/20"><Plus className="w-4 h-4 mr-2"/> Add Member</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Add Staff Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input {...form.register("fullName")} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input {...form.register("username")} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" {...form.register("password")} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select onValueChange={(v) => form.setValue("role", v as any)} defaultValue="staff">
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full rounded-xl" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Member"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff?.map(member => (
              <TableRow key={member.id}>
                <TableCell className="font-medium flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                    {member.fullName.charAt(0)}
                  </div>
                  {member.fullName}
                </TableCell>
                <TableCell className="text-muted-foreground">{member.username}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Shield className={`w-4 h-4 ${member.role === 'admin' ? 'text-destructive' : 'text-primary'}`} />
                    <span className="capitalize text-sm font-medium">{member.role}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    onClick={() => confirm("Delete this staff member?") && deleteMutation.mutate({ id: member.id })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}
