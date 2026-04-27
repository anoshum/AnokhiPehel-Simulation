import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Optics from "./pages/Optics";
import Circuit from "./pages/Circuit";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/optics" element={<Optics />} />
      <Route path="/circuit" element={<Circuit />} />
    </Routes>
  );
}

export default App;