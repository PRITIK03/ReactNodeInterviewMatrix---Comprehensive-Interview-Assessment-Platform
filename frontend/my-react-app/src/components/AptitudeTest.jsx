import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getAptitudeQuestions, submitAptitude } from "../api";
import { useTest } from "../contexts/TestContext";
import GlassCard from "./GlassCard";
import CompanyHeader from "./CompanyHeader";

export default function AptitudeTest({ user }) {
  const navigate = useNavigate();
  const { company, level } = useTest();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState("");
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!company || !level) { navigate("/company"); return; }
    setLoading(true);
    getAptitudeQuestions(company, level)
      .then(res => { setQuestions(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [company, level, navigate]);

  const handleNext = async () => {
    const newAnswers = [...answers, selected];
    setAnswers(newAnswers);
    setSelected("");
    setError("");
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      setSubmitting(true);
      try {
        const res = await submitAptitude(user.username, newAnswers, questions, company, level);
        if (
          res &&
          res.data &&
          typeof res.data.score !== "undefined" &&
          typeof res.data.total !== "undefined"
        ) {
          navigate("/result", {
            state: {
              score: res.data.score,
              total: res.data.total,
              feedback: res.data.feedback || "",
              company,
            },
          });
        } else {
          setError("Submission failed. Please try again.");
        }
      } catch (e) {
        setError("Submission failed. Please check your internet connection and try again.");
      }
      setSubmitting(false);
    }
  };

  if (loading || submitting)
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        height="60vh"
      >
        <CircularProgress color="primary" size={50} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          {submitting ? "AI is grading your answers..." : "Loading questions..."}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mt: 1, color: "text.secondary" }}
        >
          {submitting
            ? "This may take a few seconds. Please wait while we analyze your submission."
            : ""}
        </Typography>
      </Box>
    );
  if (!questions.length)
    return (
      <Typography align="center" sx={{ mt: 10 }}>
        No questions found for this company/level.
      </Typography>
    );

  // Stepper for question progress
  const stepperActive = Math.min(current, questions.length - 1);

  return (
    <Container maxWidth="sm">
      <GlassCard
        sx={{
          mt: 8,
          p: { xs: 2.5, md: 5 },
          borderRadius: 5,
          background: "rgba(255,255,255,0.97)",
          boxShadow: "0 10px 36px rgba(99,102,241,0.13)",
        }}
        component={motion.div}
        initial={{ opacity: 0, scale: 0.97, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.65, type: "spring" }}
      >
        <CompanyHeader company={company} />
        <Typography
          variant="h5"
          fontWeight={900}
          align="center"
          gutterBottom
          color="primary.main"
          sx={{ letterSpacing: 0.5 }}
        >
          Aptitude Test
        </Typography>
        <Stepper
          activeStep={stepperActive}
          alternativeLabel
          sx={{
            mb: 2,
            maxWidth: 420,
            mx: "auto",
            '.MuiStep-root': { maxWidth: 50 },
            '.MuiStepLabel-label': { display: "none" },
            '.MuiStepIcon-root': { color: "#e0e7ff" },
            '.MuiStepIcon-root.Mui-active': { color: "#6366f1" },
            '.MuiStepIcon-root.Mui-completed': { color: "#4ade80" },
          }}
        >
          {questions.map((_, idx) => (
            <Step key={idx}>
              <StepLabel />
            </Step>
          ))}
        </Stepper>
        <Box
          sx={{
            my: 3,
            background: "rgba(99,102,241,0.06)",
            borderRadius: 3,
            p: { xs: 2, md: 3.2 },
            boxShadow: "0 2px 12px rgba(99,102,241,0.06)",
          }}
          component={motion.div}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          key={current}
        >
          <Typography
            variant="subtitle2"
            color="primary"
            fontWeight={700}
            gutterBottom
            sx={{ letterSpacing: 1 }}
          >
            Question {current + 1} of {questions.length}
          </Typography>
          <Typography
            variant="body1"
            sx={{ mt: 2, fontWeight: 700, fontSize: "1.15rem", color: "#21243D" }}
          >
            {questions[current].question}
          </Typography>
          <RadioGroup
            value={selected}
            onChange={e => setSelected(e.target.value)}
            sx={{ mt: 2, gap: 2 }}
          >
            {questions[current].options.map(opt => (
              <FormControlLabel
                key={opt}
                value={opt}
                control={<Radio color="primary" />}
                label={<span style={{ fontSize: "1.09rem" }}>{opt}</span>}
                sx={{
                  p: 1.1,
                  pl: 2.1,
                  borderRadius: 2.5,
                  mb: 0.7,
                  bgcolor: selected === opt ? "rgba(99,102,241,0.12)" : "transparent",
                  transition: "background 0.17s",
                  fontWeight: 600,
                }}
              />
            ))}
          </RadioGroup>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ mt: 4 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={!selected}
            size="large"
            sx={{
              width: "100%",
              fontWeight: 800,
              fontSize: "1.09rem",
              letterSpacing: 1,
              py: 1.35,
              background:
                "linear-gradient(90deg, #6366f1 0%, #a21caf 100%)",
              boxShadow: "0 4px 18px rgba(76, 29, 149, 0.10)",
              borderRadius: 3,
              '&:hover': {
                background: "linear-gradient(90deg, #a21caf 0%, #6366f1 100%)",
                transform: "scale(1.03)"
              }
            }}
            component={motion.button}
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.045 }}
          >
            {current < questions.length - 1 ? "Next" : "Submit"}
          </Button>
        </Box>
      </GlassCard>
    </Container>
  );
}