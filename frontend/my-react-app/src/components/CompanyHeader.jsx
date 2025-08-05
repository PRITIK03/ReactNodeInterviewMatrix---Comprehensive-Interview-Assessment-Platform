import React from "react";
import { Avatar, Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import BusinessIcon from "@mui/icons-material/Business";

export default function CompanyHeader({ company }) {
  // logo files: public/logos/accenture.svg, amazon.svg, etc.
  const logoSrc = company
    ? `/logos/${company.toLowerCase().replace(/\s+/g, "")}.svg`
    : "";
  return (
    <Box display="flex" alignItems="center" gap={2} mb={3}>
      <motion.div initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
        <Avatar
          src={logoSrc}
          alt={company}
          sx={{ width: 56, height: 56, bgcolor: "#fff", boxShadow: 2 }}
        >
          <BusinessIcon color="primary" />
        </Avatar>
      </motion.div>
      <Typography variant="h4" fontWeight={700} color="primary.dark">{company}</Typography>
    </Box>
  );
}