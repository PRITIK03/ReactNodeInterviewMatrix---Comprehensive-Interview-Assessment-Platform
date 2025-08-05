import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  TextField,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getCodingQuestions, submitCoding } from "../api";
import { useTest } from "../contexts/TestContext";
import GlassCard from "./GlassCard";
import CompanyHeader from "./CompanyHeader";

const LANGUAGES = [
  { label: "Java", id: 62 },
  { label: "Python 3", id: 71 }
];

export default function CodingTest({ user }) {
  const navigate = useNavigate();
  const { company, level } = useTest();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [code, setCode] = useState("");
  const [mcqAnswer, setMcqAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [language, setLanguage] = useState(62); // Default to Java
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!company || !level) { 
      navigate("/company"); 
      return; 
    }
    setLoading(true);
    getCodingQuestions(company, level)
      .then(res => { setQuestions(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [company, level, navigate]);

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
      <CircularProgress size={50} color="primary" />
    </Box>
  );
  if (!questions.length) return (
    <Typography align="center" sx={{ mt: 10 }}>
      No questions found for this company/level.
    </Typography>
  );

  const question = questions[current];
  const questionText = question.question || question.title || question.description || "Untitled Question";
  const isCode = question.type === "code" || (!question.type && question.description && !question.options);
  const isMcq = question.type === "mcq" || (question.options && question.options.length);

  const handleNext = async () => {
    let thisAnswer;
    if (isCode) {
      thisAnswer = { code, language_id: language, question_index: current };
    } else if (isMcq) {
      thisAnswer = { mcq_answer: mcqAnswer, question_index: current };
    }
    const newAnswers = [...answers, thisAnswer];
    setAnswers(newAnswers);
    setCode("");
    setMcqAnswer("");
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      try {
        setSubmitting(true);
        const res = await submitCoding(user.username, newAnswers, company, level);
        setSubmitting(false);
        navigate("/result", { state: { score: res.data.score, total: res.data.total, feedback: res.data.feedback, company } });
      } catch (e) {
        setSubmitting(false);
        alert("Submission failed. Please try again.");
      }
    }
  };

  if (submitting) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="60vh">
        <CircularProgress color="primary" size={50} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          AI is reviewing your code...
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
          This may take a few seconds. Please wait while we analyze your submission.
        </Typography>
      </Box>
    );
  }

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
          Coding Test
        </Typography>
        <Typography
          variant="subtitle1"
          color="primary"
          fontWeight={700}
          align="center"
          sx={{ mt: 2, mb: 2, letterSpacing: 1 }}
        >
          Question {current + 1} of {questions.length}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            mt: 2,
            fontWeight: 700,
            fontSize: "1.15rem",
            color: "#21243D",
            wordBreak: "break-word",
            textAlign: "left"
          }}
        >
          {questionText}
        </Typography>
        {isMcq && (
          <Box sx={{ mt: 3 }}>
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={mcqAnswer}
                onChange={e => setMcqAnswer(e.target.value)}
                sx={{ gap: 1.2 }}
              >
                {question.options?.map((opt, idx) => (
                  <FormControlLabel
                    key={idx}
                    value={opt}
                    control={<Radio color="primary" />}
                    label={
                      <span style={{
                        fontSize: "1.09rem",
                        fontWeight: 600
                      }}>{opt}</span>
                    }
                    sx={{
                      p: 1.2,
                      pl: 2.1,
                      borderRadius: 2.5,
                      mb: 0.7,
                      bgcolor: mcqAnswer === opt ? "rgba(99,102,241,0.11)" : "transparent",
                      transition: "background 0.17s",
                    }}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Box>
        )}
        {isCode && (
          <Box sx={{ mt: 3 }}>
            <FormControl fullWidth>
              <Select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                sx={{
                  mb: 2,
                  maxWidth: 240,
                  borderRadius: 2,
                  background: "rgba(99,102,241,0.07)"
                }}
              >
                {LANGUAGES.map(l => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              value={code}
              onChange={e => setCode(e.target.value)}
              multiline
              minRows={8}
              maxRows={20}
              fullWidth
              placeholder={question.description || "Write your code here..."}
              sx={{
                mt: 1,
                background: "rgba(245,246,255,0.98)",
                borderRadius: 2.5,
                boxShadow: "0 1.5px 6px rgba(99,102,241,0.05)",
                fontFamily: "monospace",
                fontSize: "1.08rem"
              }}
              inputProps={{
                style: { fontFamily: "monospace", fontSize: "1.09rem" }
              }}
            />
          </Box>
        )}
        <Box sx={{ mt: 4 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={
              (isCode && !code.trim()) ||
              (isMcq && !mcqAnswer)
            }
            size="large"
            sx={{
              width: "100%",
              fontWeight: 800,
              fontSize: "1.09rem",
              letterSpacing: 1,
              py: 1.35,
              borderRadius: 3,
              background: "linear-gradient(90deg, #6366f1 0%, #a21caf 100%)",
              boxShadow: "0 4px 18px rgba(76, 29, 149, 0.10)",
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