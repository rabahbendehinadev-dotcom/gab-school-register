import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, BookOpen, MonitorPlay, Users, Award } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCreateStudent, useListGalleryImages } from "@workspace/api-client-react";

const registrationSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  phone: z.string().min(8, "Valid phone is required"),
  whatsapp: z.string().min(8, "Valid WhatsApp is required"),
  city: z.string().min(2, "City is required"),
  trainingType: z.enum(["online", "physical"]),
  housingNeeded: z.boolean().default(false),
  experienceLevel: z.string().min(2, "Please select an experience level"),
  note: z.string().optional(),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

export default function Home() {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const { data: gallery } = useListGalleryImages();
  const createStudentMutation = useCreateStudent();

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      housingNeeded: false,
    }
  });

  const onSubmit = async (data: RegistrationForm) => {
    try {
      await createStudentMutation.mutateAsync({ data });
      setIsSubmitted(true);
      toast({
        title: "Registration Successful!",
        description: "We will contact you shortly via WhatsApp.",
      });
      form.reset();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: "Please try again later.",
      });
    }
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Background" 
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-black/50 backdrop-blur-md border border-white/20 mb-8 shadow-sm text-sm font-medium text-primary"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Admissions open for 2026 Batch
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-display font-extrabold tracking-tight text-foreground mb-6"
          >
            Master Your Craft at <br className="hidden md:block" />
            <span className="text-gradient">GAB SCHOOL</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Join the elite training academy. We offer both physical and online immersive programs designed to accelerate your career.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" className="rounded-full h-14 px-8 text-lg font-semibold shadow-xl shadow-primary/25 hover:-translate-y-1 transition-all" asChild>
              <a href="#register">Register Now <ChevronRight className="ml-2 w-5 h-5" /></a>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-lg font-semibold bg-white/50 backdrop-blur border-border hover:bg-white" asChild>
              <a href="#about">Learn More</a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features/About Section */}
      <section id="about" className="py-24 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Why Choose GAB SCHOOL?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">We provide a comprehensive learning environment with expert instructors and state-of-the-art curriculum.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: MonitorPlay, title: "Online & Physical", desc: "Choose the mode that fits your lifestyle. Immersive campus experience or flexible online sessions." },
              { icon: Users, title: "Expert Mentorship", desc: "Learn directly from industry veterans who have built real-world applications and businesses." },
              { icon: Award, title: "Certification", desc: "Earn a globally recognized certificate upon completion to boost your professional profile." }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-background rounded-3xl p-8 border border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      {gallery && gallery.length > 0 && (
        <section id="gallery" className="py-24 bg-background border-y border-border/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Campus & Life</h2>
                <p className="text-muted-foreground">Take a peek into our facilities and student activities.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {gallery.slice(0, 8).map((img, i) => (
                <motion.div 
                  key={img.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative rounded-2xl overflow-hidden group ${i === 0 ? "md:col-span-2 md:row-span-2" : ""}`}
                >
                  <div className="aspect-square md:aspect-auto md:h-full w-full">
                    <img src={img.url} alt={img.caption || "Gallery"} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  </div>
                  {img.caption && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                      <p className="text-white font-medium">{img.caption}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Registration Form Section */}
      <section id="register" className="py-24 bg-card relative overflow-hidden">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-background rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-black/5 border border-border/50 relative overflow-hidden">
            
            {isSubmitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-display font-bold mb-4">Application Received!</h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
                  Thank you for registering with GAB SCHOOL. Our team will review your application and contact you via WhatsApp shortly.
                </p>
                <Button onClick={() => setIsSubmitted(false)} variant="outline" className="rounded-full">
                  Submit Another
                </Button>
              </motion.div>
            ) : (
              <>
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-display font-bold mb-3">Start Your Journey</h2>
                  <p className="text-muted-foreground">Fill out the form below to secure your spot in the next batch.</p>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" {...form.register("firstName")} className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background" placeholder="John" />
                      {form.formState.errors.firstName && <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" {...form.register("lastName")} className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background" placeholder="Doe" />
                      {form.formState.errors.lastName && <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" {...form.register("phone")} className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background" placeholder="+1 234 567 890" />
                      {form.formState.errors.phone && <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp Number</Label>
                      <Input id="whatsapp" {...form.register("whatsapp")} className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background" placeholder="+1 234 567 890" />
                      {form.formState.errors.whatsapp && <p className="text-sm text-destructive">{form.formState.errors.whatsapp.message}</p>}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="city">City / Region</Label>
                      <Input id="city" {...form.register("city")} className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background" placeholder="New York" />
                      {form.formState.errors.city && <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Training Type</Label>
                      <Select onValueChange={(val: "online" | "physical") => form.setValue("trainingType", val)}>
                        <SelectTrigger className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="physical">Physical (Campus)</SelectItem>
                          <SelectItem value="online">Online (Remote)</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.trainingType && <p className="text-sm text-destructive">{form.formState.errors.trainingType.message}</p>}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Experience Level</Label>
                      <Select onValueChange={(val) => form.setValue("experienceLevel", val)}>
                        <SelectTrigger className="h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.experienceLevel && <p className="text-sm text-destructive">{form.formState.errors.experienceLevel.message}</p>}
                    </div>
                    
                    <div className="flex items-center space-x-3 pt-8">
                      <Checkbox 
                        id="housing" 
                        onCheckedChange={(checked) => form.setValue("housingNeeded", checked as boolean)}
                        className="w-6 h-6 rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor="housing" className="text-base font-medium">Housing Needed?</Label>
                        <p className="text-sm text-muted-foreground">Only applicable for physical training</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Additional Notes (Optional)</Label>
                    <Textarea 
                      id="note" 
                      {...form.register("note")} 
                      className="min-h-32 rounded-xl bg-muted/50 border-transparent focus:bg-background resize-none" 
                      placeholder="Tell us about your goals..." 
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-14 rounded-xl text-lg font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
                    disabled={createStudentMutation.isPending}
                  >
                    {createStudentMutation.isPending ? "Submitting..." : "Complete Registration"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
