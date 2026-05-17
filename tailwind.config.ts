import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ["var(--font-inter)", "sans-serif"],
        fraunces: ["var(--font-fraunces)", "serif"],
      },
      colors: {
        ink: "#171717",
        carbon: "#0f0f10",
        line: "#EEEAE3",
        mist: "#F7F4F0",
        panel: "#ffffff",
        taploCanvas: "#FAFAF8",
        taploWarm: "#F4F0EA",
        taploCoralSoft: "#FEF0EB",
        taploBorder: "#EEEAE3",
        taploBlue: "#4e9ff3",
        taploBlueDark: "#2878d7",
        taploCoral: "#F47A5A",
        taploCoralDark: "#e8694a",
        taploSidebar: "#FAFAF7",
        pine: "#2878d7",
        plum: "#5b6b84",
        brass: "#F47A5A",
        success: "#22c55e",
        warning: "#f59e0b",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(30,20,10,0.04), 0 8px 24px rgba(30,20,10,0.06)",
        lift: "0 12px 40px rgba(30,20,10,0.14)",
        float: "0 12px 40px rgba(30,20,10,0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
