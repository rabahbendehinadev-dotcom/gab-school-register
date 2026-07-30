import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, Globe, ToggleLeft, ToggleRight, X, Upload } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface BrandLogo {
  id: number;
  name: string;
  imageUrl: string;
  website: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchAll(): Promise<BrandLogo[]> {
  const res = await fetch(`${BASE}/api/brand-logos/all`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function BrandLogos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: logos = [], isLoading } = useQuery({ queryKey: ["brand-logos-all"], queryFn: fetchAll });

  // ── Modal state ─────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BrandLogo | null>(null);
  const [form, setForm] = useState({ name: "", website: "", sortOrder: "0", isActive: true });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Drag & drop state ───────────────────────────────────────────────────
  const dragId = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", website: "", sortOrder: String(logos.length), isActive: true });
    setImageFile(null);
    setImagePreview("");
    setModalOpen(true);
  };

  const openEdit = (logo: BrandLogo) => {
    setEditing(logo);
    setForm({
      name: logo.name,
      website: logo.website ?? "",
      sortOrder: String(logo.sortOrder),
      isActive: logo.isActive,
    });
    setImageFile(null);
    setImagePreview(logo.imageUrl);
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  // ── Save (create / update) ───────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("website", form.website);
      fd.append("sortOrder", form.sortOrder);
      fd.append("isActive", String(form.isActive));
      if (imageFile) fd.append("image", imageFile);

      const url = editing
        ? `${BASE}/api/brand-logos/${editing.id}`
        : `${BASE}/api/brand-logos`;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, credentials: "include", body: fd });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-logos-all"] });
      qc.invalidateQueries({ queryKey: ["brand-logos"] });
      toast({ title: editing ? "تم التحديث ✅" : "تم الإضافة ✅" });
      closeModal();
    },
    onError: () => toast({ variant: "destructive", title: "حدث خطأ" }),
  });

  // ── Toggle ───────────────────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/brand-logos/${id}/toggle`, { method: "PATCH", credentials: "include" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-logos-all"] });
      qc.invalidateQueries({ queryKey: ["brand-logos"] });
    },
  });

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/brand-logos/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand-logos-all"] });
      qc.invalidateQueries({ queryKey: ["brand-logos"] });
      toast({ title: "تم الحذف" });
    },
    onError: () => toast({ variant: "destructive", title: "فشل الحذف" }),
  });

  // ── Drag & drop reorder ──────────────────────────────────────────────────
  const reorderMutation = useMutation({
    mutationFn: async (items: { id: number; sortOrder: number }[]) => {
      const res = await fetch(`${BASE}/api/brand-logos/reorder`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-logos-all"] }),
  });

  const handleDragStart = useCallback((id: number) => {
    dragId.current = id;
    setDragging(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (dragId.current === null || dragId.current === targetId) return;
    const ordered = [...logos].sort((a, b) => a.sortOrder - b.sortOrder);
    const fromIdx = ordered.findIndex(l => l.id === dragId.current);
    const toIdx = ordered.findIndex(l => l.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...ordered];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const items = reordered.map((l, i) => ({ id: l.id, sortOrder: i }));
    reorderMutation.mutate(items);
    dragId.current = targetId;
  }, [logos, reorderMutation]);

  const handleDragEnd = useCallback(() => {
    dragId.current = null;
    setDragging(null);
  }, []);

  const sorted = [...logos].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <AdminLayout>
      <div dir="rtl" className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground">إدارة العلامات التجارية</h1>
            <p className="text-sm text-muted-foreground mt-0.5">اللوغوهات تظهر في شريط متحرك بالصفحة الرئيسية</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            إضافة لوغو
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "إجمالي اللوغوهات", value: logos.length },
            { label: "مفعّل", value: logos.filter(l => l.isActive).length },
            { label: "مخفي", value: logos.filter(l => !l.isActive).length },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black text-orange-500">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">جاري التحميل…</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="font-bold text-foreground">لا توجد علامات تجارية بعد</p>
            <p className="text-sm text-muted-foreground mt-1">اضغط "إضافة لوغو" للبداية</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {sorted.map((logo) => (
              <div
                key={logo.id}
                draggable
                onDragStart={() => handleDragStart(logo.id)}
                onDragOver={(e) => handleDragOver(e, logo.id)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                  dragging === logo.id ? "bg-orange-50 dark:bg-orange-900/10 opacity-60" : "hover:bg-muted/30"
                }`}
              >
                {/* Drag handle */}
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />

                {/* Logo image */}
                <div className="w-14 h-10 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={logo.imageUrl.startsWith("/api") ? `${BASE}${logo.imageUrl}` : logo.imageUrl}
                    alt={logo.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{logo.name}</p>
                  {logo.website && (
                    <a
                      href={logo.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-orange-500 flex items-center gap-1 mt-0.5 hover:underline"
                    >
                      <Globe className="w-3 h-3" />
                      {logo.website}
                    </a>
                  )}
                </div>

                {/* Sort order badge */}
                <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                  #{logo.sortOrder}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleMutation.mutate(logo.id)}
                    title={logo.isActive ? "تعطيل" : "تفعيل"}
                    className={`transition-colors ${logo.isActive ? "text-green-500" : "text-muted-foreground"}`}
                  >
                    {logo.isActive
                      ? <ToggleRight className="w-5 h-5" />
                      : <ToggleLeft className="w-5 h-5" />}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => openEdit(logo)}
                    className="text-muted-foreground hover:text-orange-500 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (confirm(`حذف "${logo.name}"؟`)) deleteMutation.mutate(logo.id);
                    }}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div dir="rtl" className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-black text-lg">{editing ? "تعديل اللوغو" : "إضافة لوغو جديد"}</h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-5 py-4 space-y-4">

              {/* Image upload */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-2">صورة اللوغو *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-orange-400 transition-colors flex flex-col items-center gap-2"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview.startsWith("/api") ? `${BASE}${imagePreview}` : imagePreview}
                      alt="preview"
                      className="max-h-24 object-contain rounded"
                    />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">اضغط لرفع صورة اللوغو</span>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم العلامة التجارية *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: Yacine Auto"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              {/* Website */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">الرابط (اختياري)</label>
                <input
                  value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  placeholder="https://example.com"
                  dir="ltr"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              {/* Sort order + active */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">ترتيب الظهور</label>
                  <input
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">الحالة</label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold border transition-colors ${
                      form.isActive
                        ? "bg-green-50 border-green-300 text-green-700"
                        : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    {form.isActive ? <><ToggleRight className="w-4 h-4" /> مفعّل</> : <><ToggleLeft className="w-4 h-4" /> معطّل</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-border">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name || (!editing && !imageFile)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black py-2.5 rounded-xl transition-colors text-sm"
              >
                {saveMutation.isPending ? "جاري الحفظ…" : (editing ? "حفظ التعديلات" : "إضافة")}
              </button>
              <button
                onClick={closeModal}
                className="px-4 py-2.5 border border-border rounded-xl text-sm font-bold hover:bg-muted transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
