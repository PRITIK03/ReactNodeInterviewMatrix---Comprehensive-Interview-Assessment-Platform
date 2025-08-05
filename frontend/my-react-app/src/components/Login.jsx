import React, { useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  InputAdornment,
  IconButton,
  Avatar,
  Paper
} from "@mui/material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import PersonIcon from "@mui/icons-material/Person";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import GlassCard from "./GlassCard";

// You can place your logo in /public/logo.svg (or use a company one for effect)
const LOGO_SRC = "/logos/mockinterview.svg"; // fallback, change to your logo if exists

export default function Login({ setUser }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username && password) {
      setUser({ username });
      setError("");
      navigate("/dashboard");
    } else {
      setError("Please enter username and password.");
    }
  };

  return (
    <Container maxWidth="xs" sx={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <GlassCard
        sx={{
          width: "100%",
          mt: { xs: 4, md: 8 },
          borderRadius: 5,
          boxShadow: "0 8px 32px rgba(99,102,241,0.16)",
          background: "rgba(255,255,255,0.85)"
        }}
        component={motion.div}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, type: "spring" }}
      >
        <Box display="flex" flexDirection="column" alignItems="center" mb={2}>
          <motion.div
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 10 }}
          >
            <Avatar
              src={LOGO_SRC}
              alt="Platform Logo"
              sx={{
                width: 80,
                height: 80,
                mb: 1,
                boxShadow: "0 8px 16px 0 rgba(33,150,243,0.08)"
              }}
            >
              <VpnKeyIcon sx={{ fontSize: 38, color: "primary.main" }} />
            </Avatar>
          </motion.div>
          <Typography variant="h4" fontWeight={700} color="primary.main" align="center" mb={1}>
            Welcome Back
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
            Sign in to continue your interview journey
          </Typography>
        </Box>
        <Box component="form" onSubmit={handleSubmit} autoComplete="off">
          <TextField
            label="Username"
            fullWidth
            margin="normal"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon color="primary" />
                </InputAdornment>
              ),
            }}
            autoFocus
            variant="outlined"
          />
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            margin="normal"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <VpnKeyIcon color="primary" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            variant="outlined"
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            sx={{
              mt: 3,
              py: 1.2,
              fontWeight: 700,
              fontSize: "1.1rem",
              background: "linear-gradient(90deg, #6366f1 0%, #a21caf 100%)",
              boxShadow: "0 4px 24px rgba(76, 29, 149, 0.08)",
              '&:hover': {
                background: "linear-gradient(90deg, #a21caf 0%, #6366f1 100%)",
                transform: "scale(1.03)"
              }
            }}
            component={motion.button}
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.04 }}
          >
            Login
          </Button>
        </Box>
      </GlassCard>
    </Container>
  );
}