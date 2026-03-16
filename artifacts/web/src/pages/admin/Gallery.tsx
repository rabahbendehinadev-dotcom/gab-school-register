import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListGalleryImages, useUploadGalleryImage, useDeleteGalleryImage, getListGalleryImagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Trash2, Upload, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Gallery() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: images, isLoading } = useListGalleryImages();
  const [file, setFile] = useState<File | null>(null);

  const uploadMutation = useUploadGalleryImage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGalleryImagesQueryKey() });
        setFile(null);
        toast({ title: "Image uploaded successfully" });
      }
    }
  });

  const deleteMutation = useDeleteGalleryImage({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListGalleryImagesQueryKey() })
    }
  });

  const handleUpload = () => {
    if (!file) return;
    uploadMutation.mutate({ data: { image: file, sortOrder: 0 } });
  };

  if (isLoading) return <AdminLayout><div className="animate-pulse">Loading gallery...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-primary" /> Gallery Management
          </h2>
          <p className="text-muted-foreground">Manage images displayed on the public landing page.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card p-2 rounded-2xl border border-border/50 shadow-sm">
          <input 
            type="file" 
            accept="image/*"
            id="image-upload"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <label 
            htmlFor="image-upload"
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-sm font-medium rounded-xl cursor-pointer transition-colors"
          >
            {file ? file.name : "Select Image"}
          </label>
          <Button 
            onClick={handleUpload} 
            disabled={!file || uploadMutation.isPending}
            className="rounded-xl shadow-md"
          >
            {uploadMutation.isPending ? "Uploading..." : <><Upload className="w-4 h-4 mr-2"/> Upload</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {images?.map(img => (
          <div key={img.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border/50 shadow-sm hover:shadow-lg transition-all">
            <img src={img.url} alt="Gallery item" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <Button 
                variant="destructive" 
                size="icon" 
                className="rounded-full shadow-xl scale-0 group-hover:scale-100 transition-transform delay-100"
                onClick={() => confirm("Delete this image?") && deleteMutation.mutate({ id: img.id })}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
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
    </AdminLayout>
  );
}
