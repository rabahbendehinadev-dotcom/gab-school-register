import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListStudents, useDeleteStudent, getListStudentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Trash2, Edit, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export default function Students() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  
  const queryClient = useQueryClient();
  const { data: students, isLoading } = useListStudents({ 
    search: search || undefined,
    stage: stageFilter !== "all" ? stageFilter : undefined
  });

  const deleteMutation = useDeleteStudent({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() })
    }
  });

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading students...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
        
        {/* Toolbar */}
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
          <div className="flex gap-4 w-full sm:w-auto">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[160px] rounded-xl bg-background">
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
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students?.map((student) => (
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
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize border border-primary/20">
                      {student.stage.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(student.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg">
                        <Edit className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          if(confirm("Delete this student?")) deleteMutation.mutate({ id: student.id })
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!students?.length && (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                    No students found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
