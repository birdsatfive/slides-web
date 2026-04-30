import type { LucideIcon } from "lucide-react";
import {
  BookMarked,
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  LineChart,
  Presentation,
  Sparkles,
} from "lucide-react";

export interface BafService {
  id: string;
  name: string;
  description: string;
  url: string;
  icon: LucideIcon;
  accent: string;
  self?: boolean;
}

export const BAF_SERVICES: BafService[] = [
  {
    id: "ops",
    name: "Ops",
    description: "Projects, dashboards, team",
    url: "https://ops.birdsatfive.dk",
    icon: LayoutDashboard,
    accent: "#F58ED3",
  },
  {
    id: "booking",
    name: "Room Booking",
    description: "Meeting rooms at the Garage",
    url: "https://booking.birdsatfive.dk",
    icon: CalendarDays,
    accent: "#D159A3",
  },
  {
    id: "sales",
    name: "Sales CRM",
    description: "Pipeline, deals, accounts",
    url: "https://sales.birdsatfive.dk",
    icon: Briefcase,
    accent: "#A33278",
  },
  {
    id: "analytics",
    name: "Client Analytics",
    description: "Marketing performance dashboards",
    url: "https://analytics.birdsatfive.dk",
    icon: LineChart,
    accent: "#5a8a66",
  },
  {
    id: "slides",
    name: "Slides",
    description: "AI decks & presentations",
    url: "https://slides.birdsatfive.dk",
    icon: Presentation,
    accent: "#C72886",
    self: true,
  },
  {
    id: "birdie-studio",
    name: "Birdie Studio",
    description: "Content generation studios",
    url: "https://baf.birdie.studio",
    icon: Sparkles,
    accent: "#F58ED3",
  },
  {
    id: "skills",
    name: "Skills Library",
    description: "Shared Claude Code skills",
    url: "https://ops.birdsatfive.dk/skills",
    icon: BookMarked,
    accent: "#7c2a6b",
  },
];
