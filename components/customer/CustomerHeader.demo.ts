import type {
  CustomerHeaderData,
  CustomerHeaderProps,
} from "@/components/customer/CustomerHeader.types";

export const customerHeaderDemoCustomer: CustomerHeaderData = {
  id: "customer-demo-10482",
  name: "Jordan Mitchell",
  initials: "JM",
  status: "Active opportunity",
  temperature: "hot",
  buyingScore: {
    value: 86,
    max: 100,
    explanation: "Strong purchase intent based on recent verified activity.",
    updatedLabel: "Updated 8 minutes ago",
  },
  healthScore: {
    value: 92,
    max: 100,
    explanation: "The customer relationship is currently healthy.",
    updatedLabel: "Updated today",
  },
  leadScore: {
    value: 78,
    max: 100,
    explanation: "High-quality lead with consistent engagement.",
    updatedLabel: "Updated 8 minutes ago",
  },
  assignedSalesperson: {
    name: "Alex Rivera",
    team: "Sales",
  },
  primaryVehicle: {
    label: "2026 Honda CR-V Hybrid Touring",
    detail: "In stock · Platinum White Pearl",
  },
  phone: "(555) 014-8820",
  email: "jordan.mitchell@example.com",
  nextAppointment: {
    dateLabel: "Tomorrow",
    timeLabel: "10:30 AM",
    type: "Test drive",
    status: "Confirmed",
  },
};

export const customerHeaderDemoStates = {
  ready: {
    state: "ready",
    customer: customerHeaderDemoCustomer,
  },
  loading: {
    state: "loading",
  },
  empty: {
    state: "empty",
    title: "Customer details are not available",
    description: "Add customer information to establish identity and next steps.",
  },
  error: {
    state: "error",
    title: "Customer details could not be loaded",
    description: "Try again to restore the latest customer context.",
  },
  offline: {
    state: "offline",
    customer: customerHeaderDemoCustomer,
    lastUpdatedLabel: "Last updated 12 minutes ago",
  },
  restricted: {
    state: "permission-restricted",
    visibleIdentity: {
      name: customerHeaderDemoCustomer.name,
      status: customerHeaderDemoCustomer.status,
    },
    description: "Your role does not include access to this customer workspace.",
  },
  archived: {
    state: "archived",
    customer: {
      ...customerHeaderDemoCustomer,
      status: "Archived",
    },
    actionAvailability: {
      more: true,
    },
  },
} satisfies Record<string, CustomerHeaderProps>;
