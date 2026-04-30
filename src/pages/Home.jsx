import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  Sun, Moon, Atom, Zap, Eye, FlaskConical,
  Magnet, Radio, ChevronRight
} from "lucide-react";

/* ---------------- THEME ---------------- */
function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("physics-lab-theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("physics-lab-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return { isDark, toggleTheme: () => setIsDark(!isDark) };
}

/* ---------------- MAIN ---------------- */
export default function Home() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  /* Cursor glow (disabled mobile) */
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const move = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  /* Parallax */
  const { scrollY } = useScroll();
  const yHero = useTransform(scrollY, [0, 500], [0, -80]);

  const labs = [
    { title: "Optics Lab", tagline: "Light & Vision", icon: <Eye />, path: "/optics" },
    { title: "Circuit Lab", tagline: "Electricity & Power", icon: <Zap />, path: "/circuit" },
    { title: "Lens Lab", tagline: "Optics & Focus", icon: <Atom />, path: "/lens" },
  ];

  const upcoming = [
    { title: "Magnetism", icon: <Magnet /> },
    { title: "Modern Physics", icon: <FlaskConical /> },
    { title: "Wave Motion", icon: <Radio /> },
  ];

  return (
    <div className={`${isDark ? "bg-[#030712] text-white" : "bg-slate-50 text-slate-900"} transition-colors`}>

      {/* Cursor Glow */}
      <div className="hidden md:block pointer-events-none fixed inset-0 z-30"
        style={{
          background: `radial-gradient(600px at ${mouse.x}px ${mouse.y}px, rgba(59,130,246,0.15), transparent 80%)`
        }}
      />

      <Background />

      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-black/40 border-b border-white/10 px-4 md:px-8 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">

          <div>
            <div className="flex items-center gap-2">
              <Atom className="text-blue-500" />
              <h1 className="font-black text-sm md:text-lg">
                Physics<span className="text-blue-500">Lab</span>
              </h1>
            </div>
            <p className="text-[10px] opacity-50">
              An Initiative by Anokhi Pehel • MNNIT
            </p>
          </div>

          <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800">
            <AnimatePresence mode="wait">
              <motion.div
                key={isDark ? "dark" : "light"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </motion.div>
            </AnimatePresence>
          </button>

        </div>
      </header>

      {/* HERO */}
      <motion.section style={{ y: yHero }} className="text-center px-4 py-20 md:py-32">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-7xl font-black mb-6 bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500 bg-clip-text text-transparent"
        >
          Unleash Curiosity
        </motion.h2>

        <p className="max-w-xl mx-auto text-sm md:text-lg opacity-70">
          Making physics intuitive through interactive simulations and real-world learning.
        </p>
      </motion.section>

      {/* ABOUT */}
      <section className="max-w-4xl mx-auto text-center px-4 py-20">
        <h3 className="text-3xl font-bold mb-4">
          About <span className="text-blue-500">Anokhi Pehel</span>
        </h3>
        <p className="opacity-70">
          A student-led initiative from MNNIT bringing science to underprivileged
          students through hands-on experiments and real-world understanding.
        </p>
      </section>

      {/* IMPACT */}
      <section className="max-w-6xl mx-auto px-4 py-20 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {[
          { value: "500+", label: "Students" },
          { value: "20+", label: "Workshops" },
          { value: "10+", label: "Schools" },
          { value: "100%", label: "Practical Learning" }
        ].map((i, idx) => (
          <motion.div key={idx} whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }}>
            <h4 className="text-3xl md:text-4xl font-black text-blue-500">{i.value}</h4>
            <p className="text-xs uppercase opacity-50">{i.label}</p>
          </motion.div>
        ))}
      </section>

      {/* LABS */}
      <section className="max-w-7xl mx-auto px-4 py-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {labs.map((lab, i) => (
          <TiltCard key={i} {...lab} onClick={() => navigate(lab.path)} />
        ))}
      </section>

      {/* ROADMAP */}
      <section className="max-w-7xl mx-auto px-4 py-20 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {upcoming.map((i, idx) => (
          <div key={idx} className="p-6 rounded-xl bg-white/5 backdrop-blur border border-white/10 hover:scale-105 transition">
            {i.icon}
            <h4 className="mt-2">{i.title}</h4>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="text-center py-20">
        <h3 className="text-3xl font-bold mb-6">Join the Movement</h3>
        <button className="px-6 py-3 bg-blue-600 rounded-xl hover:scale-110 transition">
          Join Anokhi Pehel
        </button>
      </section>

    </div>
  );
}

/* ---------------- 3D + MAGNETIC CARD ---------------- */
function TiltCard({ title, tagline, icon, onClick }) {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientY - rect.top) / rect.height - 0.5;
    const y = (e.clientX - rect.left) / rect.width - 0.5;
    setRotate({ x: x * 10, y: y * 10 });
  }

  return (
    <motion.div
      onMouseMove={handleMove}
      onMouseLeave={() => setRotate({ x: 0, y: 0 })}
      style={{
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`
      }}
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      className="cursor-pointer p-6 md:p-8 rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/10 transition"
    >
      <div className="text-blue-500 mb-4">{icon}</div>
      <h3 className="text-lg md:text-xl font-bold">{title}</h3>
      <p className="text-sm opacity-70">{tagline}</p>

      <div className="mt-4 text-blue-400 text-xs flex items-center">
        Start <ChevronRight size={14} />
      </div>
    </motion.div>
  );
}

/* ---------------- BACKGROUND ---------------- */
function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 18, repeat: Infinity }}
        className="absolute w-[70vw] h-[70vw] bg-blue-500 opacity-10 blur-[120px] rounded-full"
      />

      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-30"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight
          }}
          animate={{ y: [null, -80], opacity: [0.3, 0] }}
          transition={{ duration: 6 + Math.random() * 4, repeat: Infinity }}
        />
      ))}
    </div>
  );
}