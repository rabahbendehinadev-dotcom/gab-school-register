import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  username: z.string().min(1, "Username required"),
  password: z.string().min(1, "Password required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      const user = await loginMutation.mutateAsync({ data });
      queryClient.setQueryData(getGetMeQueryKey(), user);
      toast({ title: "Welcome back", description: `Logged in as ${user.fullName}` });
      setLocation("/admin");
    } catch (error) {
      toast({ 
        variant: "destructive", 
        title: "Login Failed", 
        description: "Invalid credentials. Please try again." 
      });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="w-full max-w-md bg-card/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-border/50 p-8 relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center text-white font-display font-bold text-3xl mb-6 shadow-lg shadow-primary/20">
            G
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">Admin Portal</h1>
          <p className="text-muted-foreground mt-2">Sign in to manage GAB SCHOOL</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2 relative">
            <User className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
            <Input 
              {...form.register("username")} 
              className="h-12 pl-12 rounded-xl bg-background border-border/50 focus:bg-background" 
              placeholder="Username" 
            />
          </div>
          <div className="space-y-2 relative">
            <Lock className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
            <Input 
              type="password"
              {...form.register("password")} 
              className="h-12 pl-12 rounded-xl bg-background border-border/50 focus:bg-background" 
              placeholder="Password" 
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 rounded-xl text-md font-semibold"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
