import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black text-white flex flex-col">

      {/* 🔷 HEADER */}
      <header className="w-full p-6 flex justify-between items-center border-b border-slate-700 backdrop-blur-lg bg-white/5">
        <h1 className="text-2xl font-bold tracking-wide">
          ⚛️ Physics Lab
        </h1>

        <span className="text-sm text-gray-300">
          Inspired by Anokhi Pehel • MNNIT
        </span>
      </header>

      {/* 🔷 MAIN CONTENT */}
      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 text-center">

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
        >
          Virtual Physics Lab 🚀
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-xl text-gray-300"
        >
          Explore physics concepts through interactive simulations — inspired by
          initiatives like <span className="text-blue-400 font-semibold">Anokhi Pehel</span>,
          empowering students through education and innovation.
        </motion.p>

        {/* 🔷 CARDS */}
        <div className="flex flex-wrap justify-center gap-8">

          {/* Optics Card */}
          <motion.div
            whileHover={{ scale: 1.1, rotate: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/optics")}
            className="w-64 p-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-xl cursor-pointer transition-all"
          >
            <h2 className="text-2xl font-bold mb-2">🔍 Optics</h2>
            <p className="text-sm text-gray-200">
              Light, reflection, refraction simulations
            </p>
          </motion.div>

          {/* Circuit Card */}
          <motion.div
            whileHover={{ scale: 1.1, rotate: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/circuit")}
            className="w-64 p-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-xl cursor-pointer transition-all"
          >
            <h2 className="text-2xl font-bold mb-2">⚡ Circuits</h2>
            <p className="text-sm text-gray-200">
              Build and test electrical circuits
            </p>
          </motion.div>

        </div>

        {/* 🔷 INFO SECTION */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="max-w-2xl mt-10 p-6 bg-white/5 border border-slate-700 rounded-xl backdrop-blur-md"
        >
          <h3 className="text-xl font-semibold mb-2 text-blue-400">
            🌱 About Anokhi Pehel
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            A student-led initiative at MNNIT that provides free education to 
            underprivileged children. Beyond academics, it nurtures creativity, 
            confidence, and real-world skills — making a meaningful impact on society.
          </p>
        </motion.div>

      </div>

      {/* 🔷 FOOTER */}
      <footer className="text-center text-gray-400 text-sm p-4 border-t border-slate-700">
        Built with ❤️ | Inspired by student innovation @ MNNIT
      </footer>

    </div>
  );
}