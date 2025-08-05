import React from "react";
import { Paper } from "@mui/material";

export default function GlassCard({ children, sx = {}, ...props }) {
  return (
    <Paper
      elevation={6}
      sx={{
        background: "rgba(255,255,255,0.80)",
        borderRadius: 5,
        backdropFilter: "blur(12px)",
        ...sx
      }}
      {...props}
    >
      {children}
    </Paper>
  );
}