"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      id="theme-toggle-btn"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "36px",
        borderRadius: "6px",
        border: "1.5px solid var(--cy-border)",
        backgroundColor: "var(--cy-surface-container)",
        cursor: "pointer",
        transition: "background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--cy-surface-container-high)";
        e.currentTarget.style.transform = "scale(1.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--cy-surface-container)";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {isDark ? (
        <Sun size={18} style={{ color: "var(--cy-primary)", transition: "color 0.2s ease" }} />
      ) : (
        <Moon size={18} style={{ color: "var(--cy-primary)", transition: "color 0.2s ease" }} />
      )}
    </button>
  );
}
