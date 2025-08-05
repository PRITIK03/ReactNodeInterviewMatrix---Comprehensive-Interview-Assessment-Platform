import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  ButtonBase,
} from "@mui/material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTest } from "../contexts/TestContext";
import { getCompanies } from "../api";
import CompanyLogo from "./CompanyLogo";

export default function CompanySelect({ user }) {
  const navigate = useNavigate();
  const { setCompany } = useTest();
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    getCompanies()
      .then((res) => setCompanies(res.data))
      .catch(() =>
        setCompanies(["Wipro", "TCS", "Infosys", "Accenture", "Amazon"])
      );
  }, []);

  const handleCompanyClick = (company) => {
    setCompany(company);
    navigate("/level");
  };

  // Animations for logo buttons
  const buttonVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.96 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { delay: i * 0.08 },
    }),
    hover: { scale: 1.13, boxShadow: "0 10px 36px 0 rgba(99,102,241,0.17)" },
    tap: { scale: 0.96 },
  };

  return (
    <Container maxWidth="md">
      <Paper
        elevation={6}
        sx={{
          p: { xs: 2, md: 5 },
          mt: 8,
          borderRadius: 5,
          background: "rgba(248,250,255,0.94)",
          boxShadow: "0 8px 32px rgba(99,102,241,0.16)",
        }}
        component={motion.div}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, type: "spring" }}
      >
        <Typography
          variant="h4"
          fontWeight={700}
          color="primary.main"
          align="center"
          gutterBottom
        >
          {user ? `Welcome, ${user.username}!` : "Welcome!"}
        </Typography>
        <Typography
          variant="subtitle1"
          color="text.secondary"
          align="center"
          gutterBottom
        >
          Select a company to proceed
        </Typography>
        <Box mt={5}>
          <Grid container spacing={{ xs: 3, sm: 5 }} justifyContent="center">
            {companies.map((company, idx) => (
              <Grid key={company} item xs={6} sm={4} md={3}>
                <motion.div
                  custom={idx}
                  variants={buttonVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  whileTap="tap"
                  style={{ borderRadius: 18, width: "100%" }}
                >
                  <ButtonBase
                    onClick={() => handleCompanyClick(company)}
                    focusRipple
                    sx={{
                      width: "100%",
                      height: 140,
                      borderRadius: 3,
                      background: "linear-gradient(180deg, #fff 80%, #EEF1FA 100%)",
                      boxShadow:
                        "0 2px 10px 0 rgba(99,102,241,0.05), 0 1.5px 6px rgba(0,0,0,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "box-shadow 0.3s, transform 0.15s",
                      "&:hover": {
                        boxShadow:
                          "0 10px 36px 0 rgba(99,102,241,0.17), 0 1.5px 8px rgba(0,0,0,0.07)",
                        background: "linear-gradient(180deg, #F5F7FF 80%, #E6EAF9 100%)",
                      },
                    }}
                  >
                    <CompanyLogo
                      company={company.toLowerCase().replace(/\s+/g, "")}
                      size={70}
                      style={{
                        maxWidth: 84,
                        height: 70,
                        objectFit: "contain",
                        background: "none",
                        border: "none",
                        borderRadius: 0,
                        boxShadow: "none",
                        transition: "box-shadow 0.3s, transform 0.16s",
                      }}
                    />
                  </ButtonBase>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
}