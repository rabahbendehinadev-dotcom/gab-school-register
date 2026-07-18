import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PermissionGuard } from "@/components/admin/PermissionGuard";
import { 
  useListGalleryImages, useDeleteGalleryImage, useUpdateGalleryImage, 
  getListGalleryImagesQueryKey, type GalleryImage 
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Upload, ImageIcon, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

function useUploadGalleryImageManual() {
  const baseUrl = import.meta.env.VITE_API_URL || "";
  return useMutation({
    mutationFn: async ({ file, caption, sortOrder }: { file: File; caption: string; sortOrder: number }) => {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("caption", caption);
      formData.append("sortOrder", sortOrder.toString());
      const res = await fetch(`${baseUrl}/api/gallery`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
  });
}

interface UploadFormData {
  caption: string;
  sortOrder: number;
}

interface EditFormData {
  caption: string;
  sortOrder: number;
}

export default function Gallery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: images, isLoading } = useListGalleryImages();
  const [file, setFile] = useState<File | null>(null);
  const [editImage, setEditImage] = useState<GalleryImage | null>(null);

  const uploadForm = useForm<UploadFormData>({ defaultValues: { caption: "", sortOrder: 0 } });
  const editFormCtrl = useForm<EditFormData>();

  const uploadMutation = useUploadGalleryImageManual();

  const deleteMutation = useDeleteGalleryImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGalleryImagesQueryKey() });
        toast({ title: "Image deleted" });
      }
    }
  });

  const updateMutation = useUpdateGalleryImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGalleryImagesQueryKey() });
        setEditImage(null);
        toast({ title: "Image updated" });
      }
    }
  });

  const handleUpload = (data: UploadFormData) => {
    if (!file) return;
    uploadMutation.mutate({ file, caption: data.caption, sortOrder: Number(data.sortOrder) }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGalleryImagesQueryKey() });
        setFile(null);
        uploadForm.reset();
        const input = document.getElementById("image-upload") as HTMLInputElement;
        if (input) input.value = "";
        toast({ title: "Image uploaded successfully" });
      },
    });
  };

  const openEdit = (img: GalleryImage) => {
    setEditImage(img);
    editFormCtrl.reset({ caption: img.caption ?? "", sortOrder: img.sortOrder });
  };

  const handleEditSave = (data: EditFormData) => {
    if (!editImage) return;
    updateMutation.mutate({ id: editImage.id, data: { caption: data.caption, sortOrder: Number(data.sortOrder) } });
  };

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading gallery...</div></AdminLayout>;

  return (
    <AdminLayout>
      <PermissionGuard permission="manage_notifications">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-primary" /> Gallery Management
          </h2>
          <p className="text-muted-foreground">Manage images displayed on the public landing page.</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-6 mb-8">
        <form onSubmit={uploadForm.handleSubmit(handleUpload)} className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="mb-1 block text-sm">Image File</Label>
            <input 
              type="file" accept="image/*" id="image-upload"
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div>
            <Label className="mb-1 block text-sm">Caption</Label>
            <Input {...uploadForm.register("caption")} placeholder="Optional caption" className="rounded-xl w-48" />
          </div>
          <div>
            <Label className="mb-1 block text-sm">Sort Order</Label>
            <Input type="number" {...uploadForm.register("sortOrder")} className="rounded-xl w-24" />
          </div>
          <Button type="submit" disabled={!file || uploadMutation.isPending} className="rounded-xl shadow-md">
            {uploadMutation.isPending ? "Uploading..." : <><Upload className="w-4 h-4 mr-2"/> Upload</>}
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {images?.map(img => (
          <div key={img.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border/50 shadow-sm hover:shadow-lg transition-all">
            <img src={img.url} alt={img.caption || "Gallery item"} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
              <Button 
                variant="secondary" size="icon" 
                className="rounded-full shadow-xl scale-0 group-hover:scale-100 transition-transform delay-75"
                onClick={() => openEdit(img)} title="Edit metadata"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button 
                variant="destructive" size="icon" 
                className="rounded-full shadow-xl scale-0 group-hover:scale-100 transition-transform delay-100"
                onClick={() => confirm("Delete this image?") && deleteMutation.mutate({ id: img.id })}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {img.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-1.5 truncate">
                {img.caption}
              </div>
            )}
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-md">
              #{img.sortOrder}
            </div>
          </div>
        ))}
        {!images?.length && (
          <div className="col-span-full h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-2xl">
            <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
            <p>No images in gallery</p>
          </div>
        )}
      </div>

      <Dialog open={!!editImage} onOpenChange={(o) => !o && setEditImage(null)}>
        <DialogContent className="sm:max-w-[360px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle>Edit Image Metadata</DialogTitle>
          </DialogHeader>
          {editImage && (
            <form onSubmit={editFormCtrl.handleSubmit(handleEditSave)} className="space-y-4 mt-4">
              <div className="aspect-video rounded-xl overflow-hidden bg-muted mb-2">
                <img src={editImage.url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-2">
                <Label>Caption</Label>
                <Input {...editFormCtrl.register("caption")} placeholder="Image caption" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" {...editFormCtrl.register("sortOrder")} className="rounded-xl" />
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
