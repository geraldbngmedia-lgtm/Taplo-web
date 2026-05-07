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
        inter: ["Inter", "sans-serif"],
        fraunces: ["Fraunces", "serif"],
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
        pine: "#2878d7",
        plum: "#5b6b84",
        brass: "#F47A5A"
      },
      boxShadow: {
        soft: "0 8px 24px rgba(17, 17, 17, 0.06)",
        lift: "0 24px 70px rgba(17, 17, 17, 0.12)"
      }
    },
  },
  plugins: [],
};

export default config;
