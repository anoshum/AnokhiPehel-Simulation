import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sun, Moon, Atom, Zap, Eye, FlaskConical, 
  Magnet, Radio, ChevronRight 
} from "lucide-react";

/**
 * 🎨 Custom Hook for Theme Management
 */
function useTheme() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", isDark);
  }, [isDark]);

  return { isDark, toggleTheme: () => setIsDark(!isDark) };
}

export default function Home() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  // 📝 Configuration for Lab Sections
  const labs = [
    { title: "Optics Lab", tagline: "Light & Vision", icon: <Eye />, color: "blue", path: "/optics" },
    { title: "Circuit Lab", tagline: "Electricity & Power", icon: <Zap />, color: "amber", path: "/circuit" },
    { title: "Lens Lab", tagline: "Optics & Focus", icon: <Atom />, color: "blue", path: "/lens" },
  ];

  const upcoming = [
    { title: "Magnetism", icon: <Magnet /> },
    { title: "Modern Physics", icon: <FlaskConical /> },
    { title: "Wave Motion", icon: <Radio />, wide: true },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-700 font-sans selection:bg-blue-500/30 overflow-x-hidden
      ${isDark ? "bg-[#030712] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      
      {/* 🌌 Ambient Background */}
      <BackgroundBlobs isDark={isDark} />

      {/* 🔷 HEADER */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-[#030712]/40 px-4 md:px-8 py-4">
        <nav className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-md opacity-50 animate-pulse" />
              <Atom className="w-8 h-8 text-blue-500 relative z-10" />
            </div>
            <h1 className="text-lg md:text-xl font-black tracking-tight uppercase">
              Physics<span className="text-blue-500 ml-1">Lab</span>
            </h1>
          </div>
          
          <button 
            onClick={toggleTheme}
            aria-label="Toggle Dark Mode"
            className="relative p-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 hover:scale-105 active:scale-95 transition-transform"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isDark ? "dark" : "light"}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-600" />}
              </motion.div>
            </AnimatePresence>
          </button>
        </nav>
      </header>

      {/* 🔷 HERO */}
      <section className="relative px-6 py-16 md:py-32 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full bg-blue-500/10 border border-blue-500/20">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span className="text-[10px] md:text-xs font-bold tracking-[0.1em] uppercase text-blue-500">MNNIT • Anokhi Pehel</span>
          </div>
          <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-6 bg-gradient-to-b from-slate-900 to-slate-500 dark:from-white dark:to-slate-500 bg-clip-text text-transparent">
            Unleash Your <br /> Curiosity.
          </h2>
          <p className="text-base md:text-xl text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed font-medium">
            Hands-on physics simulations designed to bridge the gap between 
            complex equations and real-world intuition.
          </p>
        </motion.div>
      </section>

      {/* 🔷 LAB GRID */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {labs.map((lab, index) => (
            <LabCard key={index} {...lab} onClick={() => navigate(lab.path)} />
          ))}
        </div>
      </section>

      {/* 🔷 ROADMAP */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-20">
        <div className="flex items-center gap-4 mb-12">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">Roadmap 2026</h3>
          <div className="h-px w-full bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-800" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {upcoming.map((item, idx) => (
            <ComingSoonCard key={idx} {...item} />
          ))}
        </div>
      </section>

      <footer className="py-16 text-center border-t border-slate-200 dark:border-white/5 opacity-50 text-[10px] uppercase tracking-[0.3em] font-bold">
        Designed for Excellence • {new Date().getFullYear()}
      </footer>
    </div>
  );
}

/**
 * 🏮 Separated Background component to reduce main component clutter
 */
function BackgroundBlobs({ isDark }) {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <motion.div 
        animate={{ scale: [1, 1.1, 1], x: [0, 20, 0] }}
        transition={{ duration: 10, repeat: Infinity }}
        className={`absolute -top-20 -left-20 w-[60vw] h-[60vw] rounded-full bg-blue-600 mix-blend-screen blur-[120px] 
          ${isDark ? "opacity-20" : "opacity-10"}`} 
      />
      <motion.div 
        animate={{ scale: [1.1, 1, 1.1], x: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity }}
        className={`absolute top-1/3 -right-20 w-[50vw] h-[50vw] rounded-full bg-purple-600 mix-blend-screen blur-[120px] 
          ${isDark ? "opacity-15" : "opacity-5"}`} 
      />
    </div>
  );
}

function LabCard({ title, tagline, icon, color, onClick }) {
  const isBlue = color === "blue";
  
  return (
    <motion.div
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative h-full cursor-pointer"
    >
      <div className={`absolute -inset-1 rounded-[2.5rem] bg-gradient-to-br 
        ${isBlue ? 'from-blue-600 to-cyan-500' : 'from-amber-500 to-orange-600'} 
        opacity-0 group-hover:opacity-25 blur-2xl transition duration-500`} />
      
      <div className="relative h-full p-8 md:p-10 rounded-[2rem] bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 flex flex-col">
        <div className={`inline-flex w-fit p-4 rounded-2xl mb-8 
          ${isBlue ? 'bg-blue-600 shadow-blue-500/40' : 'bg-amber-500 shadow-amber-500/40'} 
          text-white shadow-xl group-hover:rotate-6 transition-all duration-500`}>
          {icon}
        </div>
        
        <div className="flex-grow">
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isBlue ? 'text-blue-500' : 'text-amber-500'}`}>
            {tagline}
          </span>
          <h2 className="text-3xl font-black mt-2 mb-4">{title}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
            Dive into interactive {title.toLowerCase()} experiments with real-time feedback.
          </p>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-white/5">
          <span className="flex items-center gap-2 font-black text-[10px] uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0">
            Start Now <ChevronRight className="w-4 h-4" />
          </span>
          <div className={`h-1.5 w-12 rounded-full ${isBlue ? 'bg-blue-500' : 'bg-amber-500'}`} />
        </div>
      </div>
    </motion.div>
  );
}

function ComingSoonCard({ title, icon, wide = false }) {
  return (
    <div className={`relative p-6 rounded-2xl bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 group 
      hover:border-blue-500/40 transition-all duration-500 ${wide ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-white dark:bg-slate-800 text-slate-400 group-hover:text-blue-500 shadow-sm transition-colors">
          {icon}
        </div>
        <div>
          <h4 className="font-bold text-sm tracking-tight">{title}</h4>
          <span className="text-[8px] font-black uppercase text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
            In Development
          </span>
        </div>
      </div>
    </div>
  );
}