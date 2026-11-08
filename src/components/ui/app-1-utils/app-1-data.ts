export const app1User = {
  name: "Dr. Elena Vance",
  initials: "EV",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  email: "elena.vance@atmosiq.org",
  role: "Lead Climate Analyst",
};

export const app1Chart = [
  { week: "W1", opened: 32, completed: 28 },
  { week: "W2", opened: 45, completed: 41 },
  { week: "W3", opened: 38, completed: 35 },
  { week: "W4", opened: 52, completed: 48 },
  { week: "W5", opened: 48, completed: 54 },
  { week: "W6", opened: 60, completed: 58 },
  { week: "W7", opened: 55, completed: 62 },
  { week: "W8", opened: 42, completed: 67 },
];

export const app1ChartConfig = {
  opened: {
    label: "Tasks Opened",
    color: "#eab308",
  },
  completed: {
    label: "Tasks Completed",
    color: "#10b981",
  },
};

export const app1Projects = [
  {
    id: "proj-1",
    name: "Amazon Canopy Deforestation Surveillance",
    description: "High-frequency Sentinel & Landsat delta tracking over Cerrado buffer.",
    progress: 78,
    status: "In progress" as const,
    dueDate: "Nov 24",
    team: [
      {
        name: "Marcus Aurel",
        initials: "MA",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      },
      {
        name: "Dr. Elena Vance",
        initials: "EV",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      },
    ],
  },
  {
    id: "proj-2",
    name: "Boreal Thermal Anomaly Calibration",
    description: "NASA VIIRS FRP validation vs ground-truth station observations.",
    progress: 92,
    status: "In review" as const,
    dueDate: "Nov 18",
    team: [
      {
        name: "Aria Chen",
        initials: "AC",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80",
      },
    ],
  },
  {
    id: "proj-3",
    name: "South Asia CAMS AQI Pipeline v2",
    description: "Multi-pollutant PM2.5 dispersion model with hourly Open-Meteo ingestion.",
    progress: 45,
    status: "Planning" as const,
    dueDate: "Dec 05",
    team: [
      {
        name: "Devon Thorne",
        initials: "DT",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      },
      {
        name: "Aria Chen",
        initials: "AC",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80",
      },
    ],
  },
];

export const app1Activity = [
  {
    id: "act-1",
    person: {
      name: "Marcus Aurel",
      initials: "MA",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    },
    action: "verified 14 active fire clusters in Sumatra",
    time: "12m ago",
  },
  {
    id: "act-2",
    person: {
      name: "Aria Chen",
      initials: "AC",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80",
    },
    action: "updated CAMS PM2.5 calibration thresholds for Delhi NCR",
    time: "48m ago",
  },
  {
    id: "act-3",
    person: {
      name: "Dr. Elena Vance",
      initials: "EV",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    },
    action: "generated AI Synthesis briefing for Gran Chaco ecosystem",
    time: "2h ago",
  },
  {
    id: "act-4",
    person: {
      name: "Devon Thorne",
      initials: "DT",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
    },
    action: "cleared sensor anomaly alert on Station #419",
    time: "5h ago",
  },
];

