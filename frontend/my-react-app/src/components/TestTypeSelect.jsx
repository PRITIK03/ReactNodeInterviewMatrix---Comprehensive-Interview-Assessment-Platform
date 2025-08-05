import React from "react";
import {
  Container,
  Typography,
  Grid,
  Box,
  Paper,
  Button,
} from "@mui/material";
import { motion } from "framer-motion";
import { Code, Calculate } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useTest } from "../contexts/TestContext";
import GlassCard from "./GlassCard";

const testTypes = [
  {
    type: "aptitude",
    label: "Aptitude",
    icon: <Calculate sx={{ fontSize: 38, color: "#ff4081" }} />,
    desc: "Quantitative, logical, and reasoning skills.",
    color: "linear-gradient(90deg,#fb7185,#fcd34d)",
    shadow: "0 8px 32px 0 rgba(251,113,133,0.15)",
  },
  {
    type: "coding",
    label: "Coding",
    icon: <Code sx={{ fontSize: 38, color: "#6366f1" }} />,
    desc: "Programming and problem-solving questions.",
    color: "linear-gradient(90deg,#6366f1,#38bdf8)",
    shadow: "0 8px 32px 0 rgba(99,102,241,0.13)",
  },
];

export default function TestTypeSelect({ user }) {
  const navigate = useNavigate();
  const { setTestType } = useTest();

  const handleTypeSelect = (type) => {
    setTestType(type);
    if (type === "aptitude") {
      navigate("/aptitude");
    } else {
      navigate("/coding");
    }
  };

  return (
    <Container maxWidth="sm">
      <GlassCard
        sx={{
          mt: 8,
          p: { xs: 2, md: 4 },
          borderRadius: 5,
          background: "rgba(255,255,255,0.92)",
        }}
        component={motion.div}
        initial={{ opacity: 0, scale: 0.97, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, type: "spring" }}
      >
        <Typography
          variant="h4"
          fontWeight={700}
          color="primary.main"
          align="center"
          gutterBottom
        >
          Choose Test Type
        </Typography>
        <Grid container spacing={3} mt={0.5} justifyContent="center">
          {testTypes.map((t, idx) => (
            <Grid item xs={12} sm={6} key={t.type}>
              <motion.div
                whileHover={{
                  scale: 1.045,
                  boxShadow: t.shadow,
                }}
                whileTap={{ scale: 0.97 }}
              >
                <Box
                  sx={{
                    borderRadius: 4,
                    p: 3,
                    background: t.color,
                    color: "#fff",
                    boxShadow: t.shadow,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    minHeight: 160,
                    transition:
                      "box-shadow 0.22s, background 0.22s, transform 0.19s",
                  }}
                  onClick={() => handleTypeSelect(t.type)}
                >
                  {t.icon}
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    sx={{
                      mt: 1.2,
                      letterSpacing: 0.5,
                      textShadow: "0 1px 4px rgba(0,0,0,0.10)",
                    }}
                  >
                    {t.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#fff",
                      opacity: 0.86,
                      mt: 1,
                      textAlign: "center",
                      textShadow: "0 1px 6px rgba(0,0,0,0.09)",
                    }}
                  >
                    {t.desc}
                  </Typography>
                </Box>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </GlassCard>
    </Container>
  );
}