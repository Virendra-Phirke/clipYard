"use client";

import { useTheme } from "./ThemeProvider";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <AnimatedThemeToggler
      id="theme-toggle-btn"
      variant="circle"
      theme={theme}
      onThemeChange={toggleTheme}
      className="flex items-center justify-center w-9 h-9 rounded-md border-[1.5px] border-border bg-secondary cursor-pointer transition-all hover:bg-muted hover:scale-[1.08] text-primary shrink-0"
    />
  );
}
