import React from "react";
import {
  Container,
  Typography,
  Box,
  Button,
  Stack,
  ToggleButton,
} from "@mui/material";
import { GiGraduateCap, GiLaurelsTrophy } from "react-icons/gi";
import { MdSchool } from "react-icons/md";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTest } from "../contexts/TestContext";
import GlassCard from "./GlassCard";

const levels = [
  {
    value: "beginner",
    label: "Beginner",
    color: "#65c3e6",
    icon: <MdSchool size={32} />,
    desc: "Basic concepts, easy questions. Great for practice!",
    shadow: "0 4px 24px 0 rgba(101,195,230,0.19)",
    border: "2px solid #65c3e6"
  },
  {
    value: "intermediate",
    label: "Intermediate",
    color: "#ffb833",
    icon: <GiGraduateCap size={32} />,
    desc: "Good mix of conceptual and practical problems.",
    shadow: "0 4px 24px 0 rgba(255,184,51,0.16)",
    border: "2px solid #ffb833"
  },
  {
    value: "advanced",
    label: "Advanced",
    color: "#e86e8a",
    icon: <GiLaurelsTrophy size={32} />,
    desc: "Challenging questions for the ambitious!",
    shadow: "0 4px 24px 0 rgba(232,110,138,0.18)",
    border: "2px solid #e86e8a"
  },
];

export default function LevelSelect({ user }) {
  const { level, setLevel } = useTest();
  const navigate = useNavigate();

  const handleNext = () => {
    navigate("/type");
  };

  return (
    <Container maxWidth="sm">
      <GlassCard
        sx={{
          mt: 8,
          p: { xs: 2, md: 5 },
          borderRadius: 5,
          background: "rgba(255,255,255,0.95)",
          boxShadow: "0 10px 36px rgba(99,102,241,0.13)"
        }}
        component={motion.div}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <Typography
          variant="h4"
          fontWeight={900}
          color="primary.main"
          align="center"
          gutterBottom
          sx={{ letterSpacing: 0.5 }}
        >
          Select Difficulty Level
        </Typography>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={4}
          justifyContent="center"
          alignItems="stretch"
          mt={4}
        >
          {levels.map((item) => (
            <motion.div
              key={item.value}
              whileHover={{
                scale: 1.09,
                boxShadow: item.shadow,
                zIndex: 2,
              }}
              whileTap={{ scale: 0.97 }}
              style={{ flex: 1, minWidth: 0 }}
            >
              <ToggleButton
                value={item.value}
                selected={level === item.value}
                onChange={() => setLevel(item.value)}
                sx={{
                  p: 4,
                  width: "100%",
                  minHeight: 180,
                  borderRadius: 5,
                  border: level === item.value ? item.border : "2px solid #e0e7ff",
                  background: level === item.value
                    ? `linear-gradient(120deg, ${item.color}1F 55%, #fff 100%)`
                    : "rgba(255,255,255,0.97)",
                  boxShadow: level === item.value
                    ? item.shadow
                    : "0 2px 10px rgba(99,102,241,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  fontWeight: 700,
                  fontSize: "1.13rem",
                  textTransform: "none",
                  transition: "box-shadow 0.23s, background 0.21s, border-color 0.21s",
                  "&:hover": {
                    background: `linear-gradient(120deg, ${item.color}22 65%, #f8fafc 100%)`,
                    boxShadow: item.shadow,
                  },
                  color: "#21243D",
                  outline: "none",
                }}
              >
                <Box mb={1.2} color={item.color}>{item.icon}</Box>
                <Box fontWeight={900}>{item.label}</Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1.2, fontWeight: 500, textAlign: "center" }}
                >
                  {item.desc}
                </Typography>
              </ToggleButton>
            </motion.div>
          ))}
        </Stack>
        <Box sx={{ mt: 6 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={!level}
            size="large"
            sx={{
              width: "100%",
              fontWeight: 800,
              letterSpacing: 1,
              py: 1.4,
              fontSize: "1.13rem",
              borderRadius: 3,
              background:
                "linear-gradient(90deg, #6366f1 0%, #a21caf 100%)",
              boxShadow: "0 4px 24px rgba(76, 29, 149, 0.11)",
              '&:hover': {
                background: "linear-gradient(90deg, #a21caf 0%, #6366f1 100%)",
                transform: "scale(1.03)"
              }
            }}
            component={motion.button}
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.045 }}
          >
            Next
          </Button>
        </Box>
      </GlassCard>
    </Container>
  );
}