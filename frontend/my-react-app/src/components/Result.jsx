import React from "react";
import {
  Container,
  Typography,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import StarIcon from "@mui/icons-material/Star";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import GlassCard from "./GlassCard";
import CompanyLogo from "./CompanyLogo";

// Helper: Extract the first meaningful summary line from Gemini's review
function extractSummary(aiReview) {
  if (!aiReview) return "No summary available.";
  const lines = aiReview.split("\n");
  for (let line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      trimmed.toLowerCase() !== "ai review:" &&
      trimmed !== "<details>" &&
      !trimmed.toLowerCase().startsWith("expand for more details")
    ) {
      return trimmed;
    }
  }
  return "No summary available.";
}

// Helper: Parse feedback string to sections (for professional feedback from backend)
function parseFeedback(feedback) {
  const lines = feedback.split("\n").map((l) => l.trim()).filter(Boolean);
  let summary = "", score = "", details = {
    performance: "",
    review: "",
    sections: "",
    improve: "",
    recommendations: [],
    summaryLine: "",
    raw: feedback
  };

  let curSection = "summary";
  for (let line of lines) {
    if (line.startsWith("**Section Performance:**")) {
      curSection = "sections";
      details.sections = line.replace("**Section Performance:**", "").trim();
    } else if (line.startsWith("**Areas to Improve:**")) {
      curSection = "improve";
      details.improve = line.replace("**Areas to Improve:**", "").trim();
    } else if (line.startsWith("**Recommendations:**")) {
      curSection = "recommendations";
    } else if (line.startsWith("**Your Aptitude Test Results**")) {
      curSection = "summary";
    } else if (line.startsWith("Score:")) {
      details.score = line.replace("Score:", "").trim();
    } else if (line.startsWith("Questions to review:")) {
      details.review = line.replace("Questions to review:", "").trim();
    } else if (line.startsWith("*") && line.endsWith("*") && line.length > 2) {
      details.summaryLine = line.replace(/\*/g, "").trim();
    } else if (curSection === "recommendations" && line.startsWith("- ")) {
      details.recommendations.push(line.replace("- ", "").trim());
    } else if (curSection === "summary" && !line.startsWith("**")) {
      summary += (summary ? " " : "") + line;
    }
  }

  return { ...details, summary: summary.trim() };
}

export default function Result({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state || {};
  const score = typeof state.score === "number" ? state.score : 0;
  const total = typeof state.total === "number" ? state.total : 0;
  const feedback = typeof state.feedback === "string" ? state.feedback : "No feedback available.";
  const company = state.company;

  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (
      feedback &&
      feedback.startsWith("# 🎉 Test Complete!") &&
      feedback.includes("## AI Feedback")
    ) {
      setLoading(false);
    } else if (feedback && feedback !== "No feedback available.") {
      setLoading(false);
    }
  }, [feedback]);

  const parsed = parseFeedback(feedback);

  function renderMarkdownFeedback() {
    if (
      feedback.startsWith("# 🎉 Test Complete!") &&
      feedback.includes("## AI Feedback")
    ) {
      const parts = feedback
        .split(/(### [^\n]+)/g)
        .filter(Boolean)
        .map((part, idx, arr) => {
          if (part.startsWith("### ")) {
            const review = arr[idx + 1] && !arr[idx + 1].startsWith("### ") ? arr[idx + 1] : "";
            const aiReviewText = review || part;
            const summaryLine = extractSummary(aiReviewText);
            const detailsMatch = aiReviewText.match(/<details>[\s\S]*?<\/details>/);
            return (
              <Box key={idx} sx={{
                p: 2,
                mb: 2,
                background: "#f9fafb",
                borderRadius: 2,
                boxShadow: 1,
                border: "1px solid #e0e7ef"
              }}>
                <Box sx={{ fontWeight: 700, display: "flex", alignItems: "center", mb: 0.5 }}>
                  <span>{part.replace("###", "").trim()}</span>
                  <ArrowRightAltIcon sx={{ mx: 1, fontSize: 22, color: "#1976d2" }} />
                  <span style={{ fontWeight: 400 }}>{summaryLine}</span>
                </Box>
                {detailsMatch ? (
                  <Box sx={{ mt: 1 }}>
                    <details>
                      <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                        Expand for full review
                      </summary>
                      <Box
                        sx={{
                          background: "#f3f4f7",
                          borderRadius: 1,
                          p: 1,
                          fontFamily: "monospace",
                          mt: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ whiteSpace: "pre-line", color: "#555" }}
                          component="div"
                          dangerouslySetInnerHTML={{
                            __html: detailsMatch[0]
                              .replace(/<details>|<\/details>/g, "")
                              .replace(/<summary>.*?<\/summary>/gs, ""),
                          }}
                        />
                      </Box>
                    </details>
                  </Box>
                ) : (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      For a more detailed review, please view your results in your profile.
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          }
          if (part.startsWith("# 🎉 Test Complete!")) {
            const scoreMatch = part.match(/\*\*Your (?:Score|Submissions):\*\* `(\d+) ?\/? ?(\d+)?`/);
            return (
              <Box key={idx} sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={900} gutterBottom>
                  Test Complete!
                </Typography>
                <Typography variant="h6" sx={{ mt: 2, fontWeight: 800 }}>
                  {scoreMatch
                    ? scoreMatch[2]
                      ? `Your Score: ${scoreMatch[1]} / ${scoreMatch[2]}`
                      : `Your Submissions: ${scoreMatch[1]}`
                    : total
                    ? `Your Score: ${score} / ${total}`
                    : ""}
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 700 }}>
                  AI Feedback
                </Typography>
              </Box>
            );
          }
          return null;
        });
      return <Box>{parts}</Box>;
    }
    // Fallback: render old parsed format (aptitude, etc)
    return (
      <>
        {parsed.summary && (
          <Typography variant="body1" sx={{ mt: 1, mb: 2 }}>
            {parsed.summary}
          </Typography>
        )}
        {parsed.score && (
          <Chip
            icon={<StarIcon color="warning" />}
            label={`Score: ${parsed.score}`}
            sx={{ mb: 2, fontWeight: 600, fontSize: "1.11rem" }}
            color="warning"
            variant="outlined"
          />
        )}
        {parsed.review && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
              <ReportProblemIcon fontSize="small" sx={{ mr: 1, mb: "-4px" }} />
              Questions to Review: {parsed.review}
            </Typography>
          </Box>
        )}
        {parsed.sections && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Section Performance
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {parsed.sections}
            </Typography>
          </Box>
        )}
        {parsed.improve && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Areas to Improve
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {parsed.improve.split(",").map((area, idx) => (
                <Chip
                  key={area + idx}
                  icon={<ErrorOutlineIcon color="error" />}
                  label={area.trim()}
                  color="error"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 500 }}
                />
              ))}
            </Box>
          </Box>
        )}
        {parsed.recommendations.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Recommendations
            </Typography>
            <List dense>
              {parsed.recommendations.map((rec, idx) => (
                <ListItem key={rec + idx} sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <TipsAndUpdatesIcon color="info" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={rec} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        {parsed.summaryLine && (
          <Box sx={{ mt: 2 }}>
            <Typography
              variant="body2"
              sx={{
                fontStyle: "italic",
                color: "success.main",
                fontWeight: 600,
                fontSize: "1.05rem"
              }}
            >
              {parsed.summaryLine}
            </Typography>
          </Box>
        )}
      </>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="sm">
        <GlassCard sx={{ p: 4, mt: 8, textAlign: "center" }}>
          <CircularProgress color="primary" size={50} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            AI is reviewing your code...
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
            This may take a few seconds. Please wait while we analyze your submission.
          </Typography>
        </GlassCard>
      </Container>
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
      >
        {company && (
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2, mt: 1 }}>
            <CompanyLogo
              company={company.toLowerCase().replace(/\s+/g, "")}
              size={62}
              style={{
                maxWidth: 110,
                maxHeight: 62,
                objectFit: "contain",
                margin: "0 auto",
                background: "none",
                border: "none",
                boxShadow: "none",
                borderRadius: 0,
                padding: 0,
              }}
            />
          </Box>
        )}
        {renderMarkdownFeedback()}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ mt: 4, display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            size="large"
            sx={{
              fontWeight: 800,
              letterSpacing: 0.6,
              borderRadius: 3,
              background: "linear-gradient(90deg, #6366f1 0%, #a21caf 100%)",
              '&:hover': {
                background: "linear-gradient(90deg, #a21caf 0%, #6366f1 100%)",
                transform: "scale(1.03)"
              }
            }}
            onClick={() => navigate("/dashboard")}
          >
            Go to Dashboard
          </Button>
          <Button
            variant="outlined"
            size="large"
            sx={{
              fontWeight: 800,
              letterSpacing: 0.6,
              borderRadius: 3,
              border: "2px solid #6366f1",
              color: "#6366f1",
              background: "rgba(99,102,241,0.06)",
              '&:hover': {
                borderColor: "#a21caf",
                color: "#a21caf",
                background: "rgba(162,28,175,0.07)",
                transform: "scale(1.03)"
              }
            }}
            onClick={() => navigate("/profile")}
          >
            View Profile
          </Button>
        </Box>
      </GlassCard>
    </Container>
  );
}