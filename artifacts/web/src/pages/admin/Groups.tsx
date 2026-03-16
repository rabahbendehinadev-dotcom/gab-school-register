import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListGroups, useCreateGroup, useDeleteGroup, getListGroupsQueryKey, CreateGroupBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Calendar, Settings, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";

export default function Groups() {
  const queryClient = useQueryClient();
  const { data: groups, isLoading } = useListGroups();
  const [isOpen, setIsOpen] = useState(false);

  const createMutation = useCreateGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        setIsOpen(false);
        form.reset();
      }
    }
  });

  const deleteMutation = useDeleteGroup({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() })
    }
  });

  const form = useForm<CreateGroupBody>({
    defaultValues: { status: "open", trainingType: "physical", capacity: 20 }
  });

  const onSubmit = (data: CreateGroupBody) => {
    // API expects integer capacity
    data.capacity = Number(data.capacity);
    createMutation.mutate({ data });
  };

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading groups...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold">Training Groups</h2>
          <p className="text-muted-foreground">Manage batches and student assignments.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-lg shadow-primary/20"><Plus className="w-4 h-4 mr-2"/> Create Group</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Create New Group</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input {...form.register("name")} required placeholder="e.g. Batch 2026 Alpha" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" {...form.register("startDate")} required className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Training Type</Label>
                  <Select onValueChange={(v) => form.setValue("trainingType", v as any)} defaultValue="physical">
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input type="number" {...form.register("capacity")} required className="rounded-xl" />
                </div>
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
            <div className={`h-2 ${group.status === 'open' ? 'bg-success' : 'bg-muted-foreground'}`} />
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl mb-1">{group.name}</CardTitle>
                  <span className={`text-xs px-2 py-1 rounded-md font-medium uppercase ${group.status === 'open' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                    {group.status}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/card:opacity-100 transition-opacity"
                  onClick={() => confirm("Delete this group?") && deleteMutation.mutate({ id: group.id })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
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
              
              <Button variant="outline" className="w-full rounded-xl hover:bg-primary/5 hover:text-primary hover:border-primary/30">
                Manage Members
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}
