import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { 
  useListStaff, useCreateStaff, useUpdateStaff, useDeleteStaff, getListStaffQueryKey,
  type CreateStaffBody, type UpdateStaffBody, type StaffMember,
  type CreateStaffBodyRole, type UpdateStaffBodyRole
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Shield, Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["admin", "manager", "assistant", "staff"] as const;

export default function Staff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: staff, isLoading } = useListStaff();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);

  const createMutation = useCreateStaff({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        setIsCreateOpen(false);
        createForm.reset();
        toast({ title: "Staff member created" });
      }
    }
  });

  const updateMutation = useUpdateStaff({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        setEditMember(null);
        toast({ title: "Staff member updated" });
      }
    }
  });

  const deleteMutation = useDeleteStaff({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        toast({ title: "Staff member deleted" });
      }
    }
  });

  const createForm = useForm<CreateStaffBody>({
    defaultValues: { role: "staff" }
  });

  const editForm = useForm<UpdateStaffBody>();

  const onCreateSubmit = (data: CreateStaffBody) => {
    createMutation.mutate({ data });
  };

  const onEditSubmit = (data: UpdateStaffBody) => {
    if (!editMember) return;
    updateMutation.mutate({ id: editMember.id, data });
  };

  const openEdit = (member: StaffMember) => {
    setEditMember(member);
    editForm.reset({
      fullName: member.fullName,
      role: member.role,
      password: "",
    });
  };

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading staff...</div></AdminLayout>;

  return (
    <AdminLayout>
      <PermissionGuard permission="manage_staff">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Staff Management</h2>
          <p className="text-muted-foreground">Manage user accounts and permissions.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-lg shadow-primary/20"><Plus className="w-4 h-4 mr-2"/> Add Member</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Add Staff Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input {...createForm.register("fullName")} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input {...createForm.register("username")} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" {...createForm.register("password")} required className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select onValueChange={(v) => createForm.setValue("role", v as CreateStaffBodyRole)} defaultValue="staff">
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
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
              <TableRow key={member.id} className="group">
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
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" size="icon" 
                      className="rounded-lg text-muted-foreground hover:text-foreground"
                      title="Edit" onClick={() => openEdit(member)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" size="icon" 
                      className="rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => confirm("Delete this staff member?") && deleteMutation.mutate({ id: member.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Staff Member</DialogTitle>
          </DialogHeader>
          {editMember && (
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input {...editForm.register("fullName")} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select onValueChange={(v) => editForm.setValue("role", v as UpdateStaffBodyRole)} defaultValue={editMember.role}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>New Password (leave blank to keep current)</Label>
                <Input type="password" {...editForm.register("password")} placeholder="Enter new password" className="rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-xl" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      </PermissionGuard>
    </AdminLayout>
  );
}
