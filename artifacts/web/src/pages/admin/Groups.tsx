import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { 
  useListGroups, useCreateGroup, useUpdateGroup, useDeleteGroup, useGetGroup, 
  useAssignStudentToGroup, getListGroupsQueryKey, getListStudentsQueryKey, getGetGroupQueryKey,
  type CreateGroupBody, type UpdateGroupBody, type Group, type Student,
  type CreateGroupBodyTrainingType, type CreateGroupBodyStatus, type UpdateGroupBodyTrainingType, type UpdateGroupBodyStatus
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Calendar, Settings, Plus, Trash2, Edit, X } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

type GroupWithCount = Group & { studentCount: number };

export default function Groups() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: groups, isLoading, refetch } = useListGroups();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupWithCount | null>(null);
  const [membersGroupId, setMembersGroupId] = useState<number | null>(null);

  const createMutation = useCreateGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        refetch();
        setIsCreateOpen(false);
        createForm.reset();
        toast({ title: "✅ تم إنشاء المجموعة بنجاح!" });
      }
    }
  });

  const updateMutation = useUpdateGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        refetch();
        setEditGroup(null);
        toast({ title: "✅ تم تحديث المجموعة" });
      }
    }
  });

  const deleteMutation = useDeleteGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        refetch();
        toast({ title: "🗑️ تم حذف المجموعة" });
      }
    }
  });

  const unassignMutation = useAssignStudentToGroup({
    mutation: {
      onSuccess: () => {
        if (membersGroupId) {
          queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(membersGroupId) });
        }
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student removed from group" });
      }
    }
  });

  const createForm = useForm<CreateGroupBody>({
    defaultValues: { status: "open", trainingType: "physical", capacity: 20 }
  });

  const editForm = useForm<UpdateGroupBody>();

  const onCreateSubmit = (data: CreateGroupBody) => {
    data.capacity = Number(data.capacity);
    createMutation.mutate({ data });
  };

  const onEditSubmit = (data: UpdateGroupBody) => {
    if (!editGroup) return;
    if (data.capacity) data.capacity = Number(data.capacity);
    updateMutation.mutate({ id: editGroup.id, data });
  };

  const openEdit = (group: GroupWithCount) => {
    setEditGroup(group);
    editForm.reset({
      name: group.name,
      startDate: group.startDate,
      capacity: group.capacity,
      trainingType: group.trainingType,
      status: group.status,
      notes: group.notes ?? "",
    });
  };

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading groups...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Training Groups</h2>
          <p className="text-muted-foreground">Manage batches and student assignments.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-lg shadow-primary/20"><Plus className="w-4 h-4 mr-2"/> Create Group</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Create New Group</DialogTitle>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input {...createForm.register("name")} required placeholder="e.g. Batch 2026 Alpha" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" {...createForm.register("startDate")} required className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Training Type</Label>
                  <Select onValueChange={(v: CreateGroupBodyTrainingType) => createForm.setValue("trainingType", v)} defaultValue="physical">
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input type="number" {...createForm.register("capacity")} required className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select onValueChange={(v: CreateGroupBodyStatus) => createForm.setValue("status", v)} defaultValue="open">
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input {...createForm.register("notes")} placeholder="Optional notes" className="rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-xl" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Group"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups?.map(group => (
          <Card key={group.id} className="rounded-2xl shadow-sm border-border/50 hover:shadow-md transition-shadow overflow-hidden flex flex-col group/card">
            <div className={`h-2 ${group.status === 'open' ? 'bg-green-500' : 'bg-muted-foreground'}`} />
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl mb-1">{group.name}</CardTitle>
                  <span className={`text-xs px-2 py-1 rounded-md font-medium uppercase ${group.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {group.status}
                  </span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" size="icon" 
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
                    title="Edit Group" onClick={() => openEdit(group)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" size="icon" 
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => confirm("Delete this group?") && deleteMutation.mutate({ id: group.id })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 mr-3 text-primary" />
                  Starts: {format(new Date(group.startDate), "MMM d, yyyy")}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Settings className="w-4 h-4 mr-3 text-primary" />
                  Type: <span className="capitalize ml-1">{group.trainingType}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="w-4 h-4 mr-3 text-primary" />
                  Students: {group.studentCount} / {group.capacity}
                </div>
              </div>
              
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden mb-4">
                <div 
                  className="bg-primary h-full transition-all" 
                  style={{ width: `${Math.min(100, (group.studentCount / group.capacity) * 100)}%` }}
                />
              </div>
              
              <Button 
                variant="outline" 
                className="w-full rounded-xl hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                onClick={() => setMembersGroupId(group.id)}
              >
                Manage Members
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Group</DialogTitle>
          </DialogHeader>
          {editGroup && (
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input {...editForm.register("name")} placeholder="Group name" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" {...editForm.register("startDate")} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Training Type</Label>
                  <Select onValueChange={(v: UpdateGroupBodyTrainingType) => editForm.setValue("trainingType", v)} defaultValue={editGroup.trainingType}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input type="number" {...editForm.register("capacity")} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select onValueChange={(v: UpdateGroupBodyStatus) => editForm.setValue("status", v)} defaultValue={editGroup.status}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input {...editForm.register("notes")} placeholder="Optional notes" className="rounded-xl" />
              </div>
              <Button type="submit" className="w-full rounded-xl" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <MembersDialog groupId={membersGroupId} onClose={() => setMembersGroupId(null)} onRemove={(studentId) => unassignMutation.mutate({ id: studentId, data: { groupId: null } })} />
    </AdminLayout>
  );
}

function MembersDialog({ groupId, onClose, onRemove }: { groupId: number | null; onClose: () => void; onRemove: (studentId: number) => void }) {
  const { data: group } = useGetGroup(groupId!, { query: { queryKey: getGetGroupQueryKey(groupId!), enabled: !!groupId } });

  return (
    <Dialog open={!!groupId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px] rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{group?.name ?? "Group"} — Members</DialogTitle>
        </DialogHeader>
        {group?.students && group.students.length > 0 ? (
          <div className="max-h-80 overflow-auto mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.students.map((s: Student) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                    <TableCell className="text-sm">{s.phone}</TableCell>
                    <TableCell><span className="capitalize text-sm">{s.stage?.replace("_", " ")}</span></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive" onClick={() => onRemove(s.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm mt-4">
            No members in this group yet. Assign students from the Students page.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
