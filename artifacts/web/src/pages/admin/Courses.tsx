import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, BookOpen, CalendarDays, Users } from "lucide-react";

interface Course {
  id: number;
  title: string;
  startDate: string;
  seats: number;
  enabled: boolean;
  visibleOnPage: boolean;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Courses() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [seats, setSeats] = useState("20");

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["admin-courses"],
    queryFn: () => apiFetch("/admin/courses"),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; startDate: string; seats: number }) =>
      apiFetch("/admin/courses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      setTitle("");
      setStartDate("");
      setSeats("20");
      setShowForm(false);
      toast({ title: "تم إنشاء الدورة بنجاح" });
    },
    onError: () => toast({ title: "خطأ في إنشاء الدورة", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Course> & { id: number }) =>
      apiFetch(`/admin/courses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-courses"] }),
    onError: () => toast({ title: "خطأ في التحديث", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/admin/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      toast({ title: "تم حذف الدورة" });
    },
    onError: () => toast({ title: "خطأ في الحذف", variant: "destructive" }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate) return;
    createMutation.mutate({ title: title.trim(), startDate, seats: Number(seats) });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("ar-DZ", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <AdminLayout>
      <PermissionGuard permission="manage_notifications">
      <div dir="ltr" className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">الدورات</h1>
              <p className="text-sm text-muted-foreground">إدارة الدورات الظاهرة في صفحة التسجيل</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(v => !v)} className="gap-2">
            <Plus className="w-4 h-4" />
            دورة جديدة
          </Button>
        </div>

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-card border rounded-xl p-5 space-y-4 shadow-sm"
          >
            <h2 className="font-semibold text-base">إضافة دورة جديدة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <Label htmlFor="c-title">العنوان</Label>
                <Input
                  id="c-title"
                  placeholder="مثال: دورة ماي 2026"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="c-date">تاريخ الانطلاق</Label>
                <Input
                  id="c-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="c-seats">عدد المقاعد</Label>
                <Input
                  id="c-seats"
                  type="number"
                  min={1}
                  value={seats}
                  onChange={e => setSeats(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء الدورة"}
              </Button>
            </div>
          </form>
        )}

        {/* Courses list */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">جارٍ التحميل...</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">لا توجد دورات حتى الآن</p>
            <p className="text-xs text-muted-foreground/60">اضغط «دورة جديدة» لإضافة أول دورة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map(course => (
              <div
                key={course.id}
                className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm"
              >
                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1" dir="rtl">
                  <p className="font-semibold text-sm truncate">{course.title}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {formatDate(course.startDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {course.seats} مقعد
                    </span>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="flex flex-col items-center gap-1">
                    <Switch
                      checked={course.visibleOnPage}
                      onCheckedChange={val =>
                        updateMutation.mutate({ id: course.id, visibleOnPage: val })
                      }
                      className="data-[state=checked]:bg-blue-500"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {course.visibleOnPage ? "ظاهر" : "مخفي"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Switch
                      checked={course.enabled}
                      onCheckedChange={val =>
                        updateMutation.mutate({ id: course.id, enabled: val })
                      }
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-400"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {course.enabled ? "مفعّل" : "معطّل"}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`حذف دورة "${course.title}"؟`)) {
                        deleteMutation.mutate(course.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
