import { ReactNode, useState, useEffect } from "react";
import { Link } from "wouter";
import { MessageCircle, Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicLayout({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      {/* Header */}
      <header className={`
        fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b
        ${scrolled ? "bg-white/80 dark:bg-black/50 backdrop-blur-xl border-border/50 shadow-sm py-3" : "bg-transparent border-transparent py-5"}
      `}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="GAB SCHOOL" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" />
            <span className="font-display font-bold text-2xl tracking-tight text-foreground">GAB <span className="text-primary">SCHOOL</span></span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">About</a>
            <a href="#trainings" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Trainings</a>
            <a href="#gallery" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Gallery</a>
            <Button asChild className="rounded-full px-6 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all hover:-translate-y-0.5">
              <a href="#register">Register Now</a>
            </Button>
          </nav>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl pt-24 px-6 md:hidden">
          <nav className="flex flex-col gap-6 text-center">
            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="text-xl font-display font-medium">About</a>
            <a href="#trainings" onClick={() => setMobileMenuOpen(false)} className="text-xl font-display font-medium">Trainings</a>
            <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="text-xl font-display font-medium">Gallery</a>
            <a href="#register" onClick={() => setMobileMenuOpen(false)} className="text-xl font-display font-medium text-primary flex items-center justify-center gap-2">
              Register Now <ArrowRight className="w-5 h-5" />
            </a>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-xl tracking-tight text-white">GAB SCHOOL</span>
          </div>
          <p className="text-white/60 text-sm">© {new Date().getFullYear()} GAB SCHOOL. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/admin/login" className="text-sm text-white/40 hover:text-white transition-colors">Staff Login</Link>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <a 
        href="https://wa.me/1234567890" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-xl shadow-[#25D366]/30 hover:scale-110 hover:shadow-2xl hover:shadow-[#25D366]/40 transition-all duration-300"
        aria-label="Contact on WhatsApp"
      >
        <MessageCircle className="w-8 h-8" />
      </a>
    </div>
  );
}
