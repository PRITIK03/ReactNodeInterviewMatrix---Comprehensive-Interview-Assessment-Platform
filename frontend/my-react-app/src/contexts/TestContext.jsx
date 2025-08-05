import React, { createContext, useContext, useState } from "react";
const TestContext = createContext();
export function TestProvider({ children }) {
  const [company, setCompany] = useState(null);
  const [level, setLevel] = useState("beginner");
  const [testType, setTestType] = useState(null);
  return (
    <TestContext.Provider value={{ company, setCompany, level, setLevel, testType, setTestType }}>
      {children}
    </TestContext.Provider>
  );
}
export function useTest() { return useContext(TestContext); }