import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Avatar,
  useScrollTrigger,
  Slide,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import { Logout, AccountCircle, Dashboard, Menu as MenuIcon } from "@mui/icons-material";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

// Hide AppBar on scroll down for modern effect
function HideOnScroll({ children }) {
  const trigger = useScrollTrigger();
  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children}
    </Slide>
  );
}

const logoSrc = "/logos/mockinterview.svg"; // Place your logo SVG here

function Navbar({ user, setUser }) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleLogout = () => {
    setUser(null);
    navigate("/");
  };

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  return (
    <HideOnScroll>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={3}
        component={motion.header}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
        sx={{
          backdropFilter: "blur(14px)",
          background: "rgba(255,255,255,0.90)",
          borderBottom: "1px solid #e5e7eb",
          zIndex: 1201,
        }}
      >
        <Toolbar>
          <Box
            component={Link}
            to={user ? "/dashboard" : "/"}
            sx={{
              display: "flex",
              alignItems: "center",
              flexGrow: 1,
              gap: 1.5,
              textDecoration: "none",
            }}
          >
            <Avatar
              src={logoSrc}
              alt="Logo"
              sx={{
                width: 38,
                height: 38,
                bgcolor: "#e0e7ff",
                mr: 1,
                boxShadow: "0 2px 8px rgba(99,102,241,0.11)",
              }}
              variant="rounded"
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 900,
                color: "primary.main",
                letterSpacing: 0.7,
                textTransform: "uppercase",
                fontSize: "1.25rem",
                mr: 1,
                userSelect: "none",
              }}
              component="span"
            >
              Mock Interview
            </Typography>
          </Box>
          {/* Desktop Nav */}
          {user ? (
            <>
              <Box
                display={{ xs: "none", md: "flex" }}
                alignItems="center"
                gap={1}
              >
                <Tooltip title="Dashboard" arrow>
                  <IconButton color="primary" component={Link} to="/dashboard">
                    <Dashboard />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Profile" arrow>
                  <IconButton color="primary" component={Link} to="/profile">
                    <AccountCircle />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Logout" arrow>
                  <Button
                    color="primary"
                    startIcon={<Logout />}
                    onClick={handleLogout}
                    sx={{
                      fontWeight: 700,
                      ml: 1,
                      letterSpacing: 1,
                      textTransform: "none",
                      px: 2.5,
                    }}
                    component={motion.button}
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ scale: 1.04 }}
                  >
                    Logout
                  </Button>
                </Tooltip>
                <Avatar
                  sx={{
                    width: 38,
                    height: 38,
                    ml: 2,
                    fontWeight: 700,
                    bgcolor: "#6366f1",
                    color: "#fff",
                    border: "2.5px solid #e0e7ff",
                    fontSize: 18,
                    boxShadow: "0 2px 8px rgba(99,102,241,0.13)",
                  }}
                  alt={user?.username || "U"}
                  src="/avatars/user.svg"
                >
                  {user?.username?.[0]?.toUpperCase() || "U"}
                </Avatar>
              </Box>
              {/* Mobile Nav: Hamburger */}
              <Box display={{ xs: "flex", md: "none" }}>
                <IconButton
                  color="primary"
                  onClick={handleMenuOpen}
                  aria-label="menu"
                  size="large"
                  sx={{ ml: 1 }}
                >
                  <MenuIcon />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                  PaperProps={{
                    elevation: 3,
                    sx: { minWidth: 180, borderRadius: 2, mt: 1, p: 0.5 },
                  }}
                >
                  <MenuItem
                    component={Link}
                    to="/dashboard"
                    onClick={handleMenuClose}
                  >
                    <Dashboard sx={{ mr: 1.5 }} /> Dashboard
                  </MenuItem>
                  <MenuItem
                    component={Link}
                    to="/profile"
                    onClick={handleMenuClose}
                  >
                    <AccountCircle sx={{ mr: 1.5 }} /> Profile
                  </MenuItem>
                  <Divider sx={{ my: 0.5 }} />
                  <MenuItem
                    onClick={() => {
                      handleMenuClose();
                      handleLogout();
                    }}
                  >
                    <Logout sx={{ mr: 1.5 }} /> Logout
                  </MenuItem>
                </Menu>
              </Box>
            </>
          ) : (
            <Button
              color="primary"
              component={Link}
              to="/"
              sx={{
                fontWeight: 800,
                fontSize: "1.10rem",
                px: 3,
                letterSpacing: 0.7,
                borderRadius: 3,
              }}
              components={motion.button}
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.045 }}
            >
              Login
            </Button>
          )}
        </Toolbar>
      </AppBar>
    </HideOnScroll>
  );
}

export default Navbar;