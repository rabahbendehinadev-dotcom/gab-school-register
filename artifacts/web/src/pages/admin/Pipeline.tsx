import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListStudents, useUpdateStudentStage, getListStudentsQueryKey, Student, StudentStage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, MapPin, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

const STAGES: { id: StudentStage; label: string; color: string; border: string }[] = [
  { id: "new", label: "New Leads", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  { id: "contacted", label: "Contacted", color: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  { id: "interested", label: "Interested", color: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  { id: "no_show", label: "No Show", color: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  { id: "archived", label: "Archived", color: "bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-700" },
];

export default function Pipeline() {
  const queryClient = useQueryClient();
  const { data: students, isLoading } = useListStudents();
  const updateStageMutation = useUpdateStudentStage({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() })
    }
  });

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading pipeline...</div></AdminLayout>;

  // Group students by stage
  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage.id] = students?.filter(s => s.stage === stage.id) || [];
    return acc;
  }, {} as Record<StudentStage, Student[]>);

  const handleStageChange = (id: number, stage: StudentStage) => {
    updateStageMutation.mutate({ id, data: { stage } });
  };

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide">
        {STAGES.map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-80 flex flex-col bg-muted/30 rounded-2xl border border-border/50 overflow-hidden">
            {/* Column Header */}
            <div className={`p-4 border-b ${stage.border} bg-card`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stage.color.split(' ')[0]}`} />
                  {stage.label}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stage.color}`}>
                  {grouped[stage.id].length}
                </span>
              </div>
            </div>

            {/* Column Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {grouped[stage.id].map(student => (
                <div 
                  key={student.id} 
                  className={`bg-card rounded-xl p-4 shadow-sm border ${stage.border} hover:shadow-md transition-all group`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-sm">{student.firstName} {student.lastName}</h4>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-muted transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Move to...</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {STAGES.filter(s => s.id !== student.stage).map(s => (
                          <DropdownMenuItem key={s.id} onClick={() => handleStageChange(student.id, s.id)}>
                            {s.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="space-y-1.5 mt-3">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 mr-1.5" /> {student.phone}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 mr-1.5" /> {student.city}
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-border/50 flex justify-between items-center">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      {student.trainingType}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(student.createdAt), "MMM d")}
                    </span>
                  </div>
                </div>
              ))}
              
              {grouped[stage.id].length === 0 && (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground/50 border-2 border-dashed border-border rounded-xl">
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
