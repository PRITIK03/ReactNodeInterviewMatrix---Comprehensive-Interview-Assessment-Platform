import axios from "axios";
const API = axios.create({ baseURL: "http://localhost:8000/api", withCredentials: true });

export const login = (username, password) => API.post("/login", { username, password });
export const logout = () => API.post("/logout");
export const getCompanies = () => API.get("/companies");
export const getAptitudeQuestions = (company, level) => API.post("/aptitude", { company, level });
export const submitAptitude = (username, answers, questions, company, level) =>
  API.post("/aptitude/submit", { username, answers, questions, company, level });
export const getCodingQuestions = (company, level) => API.post("/coding", { company, level });
export const submitCoding = (username, answers, company, level) =>
  API.post("/coding/submit", { username, answers, company, level });
export const getProfile = (username) => API.get("/profile", { params: { username } });