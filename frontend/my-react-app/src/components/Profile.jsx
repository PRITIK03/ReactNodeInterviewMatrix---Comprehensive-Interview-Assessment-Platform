import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Avatar,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Collapse,
  IconButton
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import StarIcon from "@mui/icons-material/Star";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GlassCard from "./GlassCard";
import CompanyLogo from "./CompanyLogo";
import { getProfile } from "../api";

function getBestScore(tests = []) {
  if (!tests.length) return 0;
  return Math.max(...tests.map((t) => (t.total > 0 ? (t.score / t.total) * 100 : 0)));
}
function getAvgScore(tests = []) {
  if (!tests.length) return 0;
  const valid = tests.filter((t) => t.total > 0);
  if (!valid.length) return 0;
  return Math.round(
    valid.reduce((sum, t) => sum + (t.score / t.total) * 100, 0) / valid.length
  );
}
function getFavoriteCompany(tests = []) {
  if (!tests.length) return "";
  const counts = {};
  tests.forEach(t => { if (t.company) counts[t.company] = (counts[t.company] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}
function getFavoriteLevel(tests = []) {
  if (!tests.length) return "";
  const counts = {};
  tests.forEach(t => { if (t.level) counts[t.level] = (counts[t.level] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

export default function Profile({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openReviewIdx, setOpenReviewIdx] = useState(null); // For collapsible reviews

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

  if (loading)
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
        <CircularProgress />
      </Box>
    );

  const tests = profile?.tests || [];
  const bestScore = getBestScore(tests);
  const avgScore = getAvgScore(tests);
  const favoriteCompany = getFavoriteCompany(tests);
  const favoriteLevel = getFavoriteLevel(tests);

  // Badges logic
  const badges = [];
  if (tests.length >= 10) badges.push({ label: "10 Tests", icon: <StarIcon color="warning" /> });
  if (bestScore >= 90) badges.push({ label: "90%+ Best", icon: <WorkspacePremiumIcon color="secondary" /> });
  if (avgScore >= 80) badges.push({ label: "Avg 80%+", icon: <EmojiEventsIcon color="success" /> });

  return (
    <Container maxWidth="md">
      <GlassCard
        sx={{
          mt: 8,
          p: { xs: 2.5, md: 5 },
          borderRadius: 5,
          background: "linear-gradient(120deg, #f5f7fa 60%, #e0e7ff 100%)",
          boxShadow: "0 10px 36px rgba(99,102,241,0.13)"
        }}
      >
        {/* Identity */}
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar
            sx={{
              width: 72, height: 72, fontSize: 34,
              fontWeight: 700, bgcolor: "primary.light", color: "#222",
              boxShadow: "0 5px 12px 0 rgba(99,102,241,0.08)"
            }}
            src="/avatars/user.svg"
          >
            {user?.username?.[0]?.toUpperCase() || "U"}
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight={800}>
              {user?.username ? user.username : "Profile"}
            </Typography>
            <Button
              startIcon={<EditIcon />}
              size="small"
              variant="outlined"
              sx={{ mt: 1, fontWeight: 700 }}
              onClick={() => alert("This would open a 'Change Username' dialog.")}
            >
              Edit Profile
            </Button>
          </Box>
        </Box>
        {/* Achievements */}
        {badges.length > 0 && (
          <Box mb={3}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Achievements
            </Typography>
            <Box display="flex" gap={1.5} flexWrap="wrap">
              {badges.map(badge => (
                <Chip
                  key={badge.label}
                  icon={badge.icon}
                  label={badge.label}
                  color="secondary"
                  variant="outlined"
                  sx={{ fontWeight: 700, fontSize: "1rem" }}
                />
              ))}
            </Box>
          </Box>
        )}
        {/* Stats & Favorite */}
        <Grid container spacing={3} mb={1}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#e3f2fd", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} color="primary">
                  Total Tests
                </Typography>
                <Typography variant="h4" fontWeight={800}>
                  {tests.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#e8f5e9", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} color="success.main">
                  Best Score
                </Typography>
                <Typography variant="h4" fontWeight={800}>
                  {bestScore.toFixed(0)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#ede7f6", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} color="secondary">
                  Avg Score
                </Typography>
                <Typography variant="h4" fontWeight={800}>
                  {avgScore}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#f9fafb", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} color="text.secondary">
                  Favorite
                </Typography>
                {favoriteCompany ? (
                  <Box display="flex" alignItems="center" gap={1}>
                    <CompanyLogo company={favoriteCompany.toLowerCase().replace(/\s+/g, "")} size={30} />
                    <span style={{ fontWeight: 700 }}>{favoriteCompany}</span>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">None</Typography>
                )}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="primary" fontWeight={700}>
                  {favoriteLevel ? `Level: ${favoriteLevel}` : ""}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        <Divider sx={{ my: 2 }} />
        {/* Test history */}
        <Typography variant="h6" sx={{ mt: 2, mb: 2, fontWeight: 800 }}>
          Test History
        </Typography>
        <Grid container spacing={3}>
          {tests.map((test, idx) => (
            <Grid item xs={12} md={6} key={idx}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  position: "relative",
                  overflow: "visible",
                  minHeight: 173,
                  boxShadow: "0 2px 12px rgba(99,102,241,0.09)",
                  borderWidth: 2,
                  borderColor: "#e0e7ff",
                  background: "rgba(245,246,255,0.97)",
                  transition: "box-shadow 0.22s, background 0.22s, border-color 0.21s",
                  mb: 1
                }}
              >
                {test.company && (
                  <Box sx={{
                    position: "absolute",
                    top: -32,
                    left: 24,
                    zIndex: 2,
                    background: "none"
                  }}>
                    <CompanyLogo
                      company={test.company.toLowerCase().replace(/\s+/g, "")}
                      size={54}
                      style={{
                        background: "rgba(99,102,241,0.12)",
                        border: "none",
                        borderRadius: 12,
                        boxShadow: "0 2px 8px rgba(99,102,241,0.07)"
                      }}
                    />
                  </Box>
                )}
                <CardContent sx={{ pt: test.company ? 6 : undefined }}>
                  <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                    <Chip
                      color={test.score / test.total > 0.7 ? "success" : test.score / test.total > 0.4 ? "warning" : "error"}
                      label={`Score: ${test.score}/${test.total}`}
                      sx={{ fontWeight: 700, fontSize: "1.03rem", px: 1.2 }}
                    />
                    <Typography variant="subtitle1" fontWeight={600}>
                      <span style={{ fontWeight: 400, fontSize: 13 }}>{test.type}, {test.level}</span>
                    </Typography>
                  </Box>
                  {/* Collapsible AI Review */}
                  {test.feedback && (
                    <Box>
                      <Button
                        endIcon={
                          <ExpandMoreIcon
                            sx={{
                              transform: openReviewIdx === idx ? "rotate(180deg)" : "rotate(0)",
                              transition: ".2s"
                            }}
                          />
                        }
                        size="small"
                        sx={{
                          fontWeight: 700,
                          mb: 1,
                          textTransform: "none",
                        }}
                        onClick={() => setOpenReviewIdx(openReviewIdx === idx ? null : idx)}
                      >
                        {openReviewIdx === idx ? "Hide AI Review" : "View AI Review"}
                      </Button>
                      <Collapse in={openReviewIdx === idx} timeout="auto" unmountOnExit>
                        <Box
                          sx={{
                            background: "#f4f7fa",
                            p: 2,
                            borderRadius: 2,
                            border: "1px solid #e0e7ff",
                            fontSize: "1rem",
                            color: "#374151",
                            whiteSpace: "pre-line",
                            mt: 1
                          }}
                        >
                          {test.feedback}
                        </Box>
                      </Collapse>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </GlassCard>
    </Container>
  );
}