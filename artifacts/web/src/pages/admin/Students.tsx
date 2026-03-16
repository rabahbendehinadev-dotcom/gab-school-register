import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { 
  useListStudents, useDeleteStudent, useUpdateStudent, useUpdateStudentStage, 
  useAssignStudentToGroup, useListGroups, getListStudentsQueryKey,
  type Student, type UpdateStudentBody, type UpdateStageBodyStage
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Trash2, ArrowRightLeft, Users, Eye, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

const STAGES = ["new", "contacted", "interested", "no_show", "archived"] as const;
const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 border-blue-200",
  contacted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  interested: "bg-green-100 text-green-700 border-green-200",
  no_show: "bg-red-100 text-red-700 border-red-200",
  archived: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function Students() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stageDialogStudent, setStageDialogStudent] = useState<Student | null>(null);
  const [groupDialogStudent, setGroupDialogStudent] = useState<Student | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "manager";
  
  const queryClient = useQueryClient();
  const { data: students, isLoading } = useListStudents({ 
    search: search || undefined,
    stage: stageFilter !== "all" ? stageFilter : undefined,
    trainingType: typeFilter !== "all" ? typeFilter : undefined,
  });
  const { data: groups } = useListGroups();

  const deleteMutation = useDeleteStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student deleted" });
      }
    }
  });

  const stageMutation = useUpdateStudentStage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setStageDialogStudent(null);
        toast({ title: "Stage updated" });
      }
    }
  });

  const groupMutation = useAssignStudentToGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setGroupDialogStudent(null);
        toast({ title: "Group assignment updated" });
      }
    }
  });

  const updateMutation = useUpdateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setDetailStudent(null);
        toast({ title: "Student updated" });
      }
    }
  });

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading students...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
        
        <div className="p-4 sm:p-6 border-b border-border/50 flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/20">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search students..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border shadow-sm rounded-xl"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[140px] rounded-xl bg-background">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="interested">Interested</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] rounded-xl bg-background">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="physical">Physical</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students?.map((student) => {
                const group = groups?.find(g => g.id === student.groupId);
                return (
                  <TableRow key={student.id} className="group hover:bg-muted/30">
                    <TableCell className="font-medium">
                      {student.firstName} {student.lastName}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{student.phone}</div>
                      <div className="text-xs text-muted-foreground">WA: {student.whatsapp}</div>
                    </TableCell>
                    <TableCell>{student.city}</TableCell>
                    <TableCell className="capitalize">{student.trainingType}</TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${STAGE_COLORS[student.stage] || STAGE_COLORS.new}`}>
                        {student.stage.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{group ? group.name : "—"}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(student.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost" size="icon" className="w-8 h-8 rounded-lg"
                          title="View/Edit" onClick={() => setDetailStudent(student)}
                        >
                          <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="w-8 h-8 rounded-lg"
                          title="Change Stage" onClick={() => setStageDialogStudent(student)}
                        >
                          <ArrowRightLeft className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost" size="icon" className="w-8 h-8 rounded-lg"
                            title="Assign Group" onClick={() => setGroupDialogStudent(student)}
                          >
                            <Users className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="ghost" size="icon"
                            className="w-8 h-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                            title="Delete"
                            onClick={() => { if (confirm("Delete this student?")) deleteMutation.mutate({ id: student.id }); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!students?.length && (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    No students found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <StageDialog 
        student={stageDialogStudent} 
        onClose={() => setStageDialogStudent(null)} 
        onStageChange={(id, stage) => stageMutation.mutate({ id, data: { stage: stage as UpdateStageBodyStage } })}
        isPending={stageMutation.isPending}
      />

      <GroupAssignDialog
        student={groupDialogStudent}
        groups={groups ?? []}
        onClose={() => setGroupDialogStudent(null)}
        onAssign={(studentId, groupId) => groupMutation.mutate({ id: studentId, data: { groupId } })}
      />

      <StudentDetailDialog
        student={detailStudent}
        onClose={() => setDetailStudent(null)}
        onSave={(id, data) => updateMutation.mutate({ id, data })}
        isPending={updateMutation.isPending}
      />
    </AdminLayout>
  );
}

function StageDialog({ student, onClose, onStageChange, isPending }: { 
  student: Student | null; onClose: () => void; 
  onStageChange: (id: number, stage: string) => void; isPending: boolean;
}) {
  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[360px] rounded-3xl">
        <DialogHeader><DialogTitle>Change Stage</DialogTitle></DialogHeader>
        {student && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              {student.firstName} {student.lastName} — currently <strong className="capitalize">{student.stage.replace('_', ' ')}</strong>
            </p>
            <div className="grid grid-cols-1 gap-2">
              {STAGES.map(stage => (
                <Button
                  key={stage}
                  variant={stage === student.stage ? "default" : "outline"}
                  className="w-full capitalize rounded-xl justify-start"
                  disabled={stage === student.stage || isPending}
                  onClick={() => onStageChange(student.id, stage)}
                >
                  {stage.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GroupAssignDialog({ student, groups, onClose, onAssign }: {
  student: Student | null; groups: Array<{ id: number; name: string; studentCount: number; capacity: number }>;
  onClose: () => void; onAssign: (studentId: number, groupId: number | null) => void;
}) {
  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[360px] rounded-3xl">
        <DialogHeader><DialogTitle>Assign to Group</DialogTitle></DialogHeader>
        {student && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">{student.firstName} {student.lastName}</p>
            <div className="space-y-2">
              <Label>Select Group</Label>
              <Select 
                defaultValue={student.groupId?.toString() || "none"}
                onValueChange={(v) => onAssign(student.id, v === "none" ? null : parseInt(v))}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Group</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id.toString()}>
                      {g.name} ({g.studentCount}/{g.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StudentDetailDialog({ student, onClose, onSave, isPending }: {
  student: Student | null; onClose: () => void;
  onSave: (id: number, data: UpdateStudentBody) => void; isPending: boolean;
}) {
  const form = useForm<UpdateStudentBody>();

  useEffect(() => {
    if (student) {
      form.reset({
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.phone,
        whatsapp: student.whatsapp,
        city: student.city,
        experienceLevel: student.experienceLevel,
        note: student.note ?? "",
        housingNeeded: student.housingNeeded,
      });
    }
  }, [student]);

  return (
    <Dialog open={!!student} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl p-6">
        <DialogHeader><DialogTitle className="text-xl font-bold">Student Details</DialogTitle></DialogHeader>
        {student && (
          <form onSubmit={form.handleSubmit((data) => onSave(student.id, data))} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input {...form.register("firstName")} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input {...form.register("lastName")} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...form.register("phone")} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input {...form.register("whatsapp")} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input {...form.register("city")} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Experience Level</Label>
                <Input {...form.register("experienceLevel")} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input {...form.register("note")} className="rounded-xl" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="housing" {...form.register("housingNeeded")} className="rounded" />
              <Label htmlFor="housing">Housing Needed</Label>
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1 rounded-xl" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
