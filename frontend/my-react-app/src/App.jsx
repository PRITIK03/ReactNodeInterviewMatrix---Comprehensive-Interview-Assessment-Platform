import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./components/Login.jsx";
import CompanySelect from "./components/CompanySelect.jsx";
import LevelSelect from "./components/LevelSelect.jsx";
import TestTypeSelect from "./components/TestTypeSelect.jsx";
import AptitudeTest from "./components/AptitudeTest.jsx";
import CodingTest from "./components/CodingTest.jsx";
import Profile from "./components/Profile.jsx";
import Navbar from "./components/Navbar.jsx";
import Result from "./components/Result.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { AnimatePresence } from "framer-motion";
import { TestProvider } from "./contexts/TestContext.jsx";
import DynamicBackground from "./components/DynamicBackground.jsx";

const theme = createTheme({
  palette: { mode: "light", primary: { main: "#1976d2" }, secondary: { main: "#ff4081" }, background: { default: "#f4f6f8" } },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: [
      "Inter", "Poppins", "Roboto", "Arial", "sans-serif"
    ].join(",")
  }
});

function App() {
  const [user, setUser] = useState(() => {
    const saved = window.localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const setUserAndPersist = (u) => {
    setUser(u);
    if (u) window.localStorage.setItem("user", JSON.stringify(u));
    else window.localStorage.removeItem("user");
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DynamicBackground />
      <TestProvider>
        <Router>
          <Navbar user={user} setUser={setUserAndPersist} />
          <main style={{ paddingTop: 32, minHeight: "80vh" }}>
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Login setUser={setUserAndPersist} />} />
                <Route path="/dashboard" element={<Dashboard user={user} />} />
                <Route path="/company" element={<CompanySelect user={user} />} />
                <Route path="/level" element={<LevelSelect user={user} />} />
                <Route path="/type" element={<TestTypeSelect user={user} />} />
                <Route path="/aptitude" element={<AptitudeTest user={user} />} />
                <Route path="/coding" element={<CodingTest user={user} />} />
                <Route path="/profile" element={<Profile user={user} />} />
                <Route path="/result" element={<Result user={user} setUser={setUserAndPersist} />} />
              </Routes>
            </AnimatePresence>
          </main>
        </Router>
      </TestProvider>
    </ThemeProvider>
  );
}
export default App;