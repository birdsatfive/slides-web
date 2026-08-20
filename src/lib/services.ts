import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  LineChart,
  Link2,
  Sparkles,
  SquareKanban,
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
    name: "Operations",
    description: "Projects, dashboards, team",
    url: "https://ops.birdsatfive.dk",
    icon: SquareKanban,
    accent: "#F58ED3",
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
    id: "share",
    name: "Share",
    description: "Files behind a link",
    url: "https://share.birdsatfive.dk",
    icon: Link2,
    accent: "#F58ED3",
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
];
