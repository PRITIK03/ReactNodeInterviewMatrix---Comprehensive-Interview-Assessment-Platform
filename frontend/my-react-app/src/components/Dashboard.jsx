import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Avatar,
  Divider,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
} from "@mui/material";
import { motion } from "framer-motion";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import { useNavigate } from "react-router-dom";
import { getProfile } from "../api";
import GlassCard from "./GlassCard";
import CompanyLogo from "./CompanyLogo";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

// Helpers
function groupStats(tests, groupBy = "company") {
  const groups = {};
  for (const test of tests) {
    const key = groupBy === "company"
      ? test.company || "Unknown"
      : test.level || "Unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(test);
  }
  return groups;
}

function buildChartData(tests) {
  return {
    labels: tests.map((_, i) => `#${i + 1}`),
    datasets: [
      {
        label: "Score (%)",
        data: tests.map((t) => t.total > 0 ? Math.round((t.score / t.total) * 100) : 0),
        fill: false,
        borderColor: "#6366f1",
        backgroundColor: "#a5b4fc",
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#a21caf",
      },
    ],
  };
}

const chartOptions = {
  responsive: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => ` Score: ${ctx.raw}%`,
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      ticks: { stepSize: 20 }
    }
  }
};

function statSummary(tests) {
  if (!tests.length) return { best: 0, avg: 0, total: 0 };
  let best = Math.max(...tests.map(t => t.total > 0 ? (t.score / t.total) * 100 : 0));
  let avg = tests.reduce((sum, t) => sum + (t.total > 0 ? (t.score / t.total) * 100 : 0), 0) / tests.length;
  return {
    best: Math.round(best),
    avg: Math.round(avg),
    total: tests.length
  };
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.username) return;
    setLoading(true);
    getProfile(user.username)
      .then((res) => {
        setProfile(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const tests = profile?.tests || [];
  const companyGroups = groupStats(tests, "company");
  const levelGroups = groupStats(tests, "level");

  // Recent activity: last 3 tests (most recent first)
  const recentTests = [...tests].slice(-3).reverse();

  return (
    <Container maxWidth="md" sx={{ minHeight: "100vh", py: { xs: 2, md: 6 } }}>
      <GlassCard
        sx={{
          p: { xs: 2, md: 5 },
          mt: { xs: 5, md: 8 },
          borderRadius: 5,
          minHeight: "60vh",
          background: "rgba(255,255,255,0.98)",
          boxShadow: "0 10px 36px rgba(99,102,241,0.10)",
        }}
        component={motion.div}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, type: "spring" }}
      >
        {/* Header */}
        <Box display="flex" alignItems="center" gap={3} mb={2}>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: "primary.light",
              fontSize: 32,
              fontWeight: 700,
              boxShadow: "0 4px 16px 0 rgba(33,150,243,0.08)",
            }}
            src="/avatars/user.svg"
            alt={user?.username || "U"}
          >
            {user?.username ? user.username[0].toUpperCase() : "U"}
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={800} color="primary.main" sx={{ lineHeight: 1.15 }}>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {user?.username && `Welcome, ${user.username}`}
            </Typography>
          </Box>
        </Box>
        <Divider sx={{ my: 2 }} />

        {/* Collapsible stats: Company-wise */}
        <Typography variant="subtitle1" fontWeight={700} color="primary" sx={{ mb: 2 }}>
          Company-wise Stats
        </Typography>
        {Object.keys(companyGroups).length === 0 && (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No tests yet. Take your first test!
          </Typography>
        )}
        {Object.entries(companyGroups).map(([company, companyTests]) => {
          const summary = statSummary(companyTests);
          return (
            <Accordion key={company} sx={{ mb: 1, borderRadius: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={2}>
                  <CompanyLogo company={company.toLowerCase().replace(/\s+/g, "")} size={32} />
                  <Typography fontWeight={700}>{company}</Typography>
                  <Chip label={`Tests: ${summary.total}`} size="small" sx={{fontWeight:700, ml:1}} />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" gap={2} mb={2} flexWrap="wrap">
                  <Chip label={`Best: ${summary.best}%`} size="small" color="success" sx={{ fontWeight: 700 }} />
                  <Chip label={`Avg: ${summary.avg}%`} size="small" color="primary" sx={{ fontWeight: 700 }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                  {companyTests.length > 1 && (
                    <Box sx={{ maxWidth: 600, mx: "auto" }}>
                      <Line data={buildChartData(companyTests)} options={chartOptions} height={180} />
                    </Box>
                  )}
                  {companyTests.length === 1 && (
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                      Only one test attempted at {company}.
                    </Typography>
                  )}
                </Box>
                <Grid container spacing={2}>
                  {companyTests.map((test, i) => (
                    <Grid item xs={12} sm={6} md={4} key={i}>
                      <Card variant="outlined" sx={{ borderRadius: 2, px: 1.5, py: 1 }}>
                        <CardContent sx={{ p: 0 }}>
                          <Typography fontWeight={700} fontSize={15}>
                            {test.type}, {test.level}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <Chip
                              label={`Score: ${test.score}/${test.total}`}
                              size="small"
                              color={
                                test.score / test.total > 0.7
                                  ? "success"
                                  : test.score / test.total > 0.4
                                  ? "warning"
                                  : "error"
                              }
                              sx={{ fontWeight: 700 }}
                            />
                            <Chip
                              label={`${test.total > 0 ? ((test.score / test.total) * 100).toFixed(0) : "--"}%`}
                              size="small"
                              sx={{
                                bgcolor: "#ede7f6",
                                color: "#7c3aed",
                                fontWeight: 700,
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* Collapsible stats: Level-wise */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="subtitle1" fontWeight={700} color="primary" sx={{ mb: 2 }}>
          Level-wise Stats
        </Typography>
        {Object.entries(levelGroups).map(([level, levelTests]) => {
          const summary = statSummary(levelTests);
          return (
            <Accordion key={level} sx={{ mb: 1, borderRadius: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Typography fontWeight={700}>{level}</Typography>
                  <Chip label={`Tests: ${summary.total}`} size="small" sx={{ fontWeight: 700, ml: 1 }} />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box display="flex" gap={2} mb={2} flexWrap="wrap">
                  <Chip label={`Best: ${summary.best}%`} size="small" color="success" sx={{ fontWeight: 700 }} />
                  <Chip label={`Avg: ${summary.avg}%`} size="small" color="primary" sx={{ fontWeight: 700 }} />
                </Box>
                <Box sx={{ mb: 2 }}>
                  {levelTests.length > 1 && (
                    <Box sx={{ maxWidth: 600, mx: "auto" }}>
                      <Line data={buildChartData(levelTests)} options={chartOptions} height={180} />
                    </Box>
                  )}
                  {levelTests.length === 1 && (
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                      Only one test attempted at this level.
                    </Typography>
                  )}
                </Box>
                <Grid container spacing={2}>
                  {levelTests.map((test, i) => (
                    <Grid item xs={12} sm={6} md={4} key={i}>
                      <Card variant="outlined" sx={{ borderRadius: 2, px: 1.5, py: 1 }}>
                        <CardContent sx={{ p: 0 }}>
                          <Typography fontWeight={700} fontSize={15}>
                            {test.company}, {test.type}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <Chip
                              label={`Score: ${test.score}/${test.total}`}
                              size="small"
                              color={
                                test.score / test.total > 0.7
                                  ? "success"
                                  : test.score / test.total > 0.4
                                  ? "warning"
                                  : "error"
                              }
                              sx={{ fontWeight: 700 }}
                            />
                            <Chip
                              label={`${test.total > 0 ? ((test.score / test.total) * 100).toFixed(0) : "--"}%`}
                              size="small"
                              sx={{
                                bgcolor: "#ede7f6",
                                color: "#7c3aed",
                                fontWeight: 700,
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* Recent Activity */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="subtitle1" color="primary" sx={{ mb: 2, fontWeight: 700 }}>
          Recent Activity
        </Typography>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="30vh">
            <CircularProgress />
          </Box>
        ) : recentTests.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "row", gap: 3, flexWrap: "wrap", justifyContent: "flex-start" }}>
            {recentTests.map((test, idx) => (
              <Card
                key={idx}
                sx={{
                  minWidth: 220,
                  borderRadius: 3,
                  px: 2,
                  py: 1.5,
                  bgcolor: "#f8faff",
                  border: "1.5px solid #e0e7ff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "start",
                  boxShadow: "0 2px 8px #6366f11a",
                }}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <CompanyLogo
                    company={test.company?.toLowerCase().replace(/\s+/g, "")}
                    size={28}
                    style={{
                      background: "rgba(99,102,241,0.10)",
                      border: "none",
                      borderRadius: 8,
                    }}
                  />
                  <Typography variant="body1" fontWeight={700}>{test.company}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {test.type}, {test.level}
                </Typography>
                <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                  <Box
                    sx={{
                      fontSize: "0.93rem",
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1.5,
                      bgcolor: "#e3f2fd",
                      color: "#1565c0",
                      fontWeight: 700,
                    }}
                  >
                    Score: {test.score}/{test.total}
                  </Box>
                  <Box
                    sx={{
                      fontSize: "0.93rem",
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1.5,
                      bgcolor: "#ede7f6",
                      color: "#7c3aed",
                      fontWeight: 700,
                    }}
                  >
                    {test.total > 0 ? `${((test.score / test.total) * 100).toFixed(0)}%` : "--"}
                  </Box>
                </Box>
              </Card>
            ))}
          </Box>
        ) : (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight="30vh"
            gap={2}
            sx={{ mt: 3 }}
          >
            <Typography variant="body1" align="center" sx={{ fontWeight: 700 }}>
              No tests taken yet.
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Start your first test to see your progress here.
            </Typography>
          </Box>
        )}

        {/* Action Buttons */}
        <Divider sx={{ my: 3 }} />
        <Box sx={{ textAlign: "right" }}>
          <Button
            variant="contained"
            onClick={() => navigate("/company")}
            sx={{
              fontWeight: 700,
              borderRadius: 2,
              mr: 1,
              background: "linear-gradient(90deg,#6366f1 0%,#a21caf 100%)",
            }}
          >
            Take New Test
          </Button>
          <Button
            onClick={() => navigate("/profile")}
            sx={{
              fontWeight: 700,
              color: "#6366f1"
            }}
          >
            View Profile
          </Button>
        </Box>
      </GlassCard>
    </Container>
  );
}