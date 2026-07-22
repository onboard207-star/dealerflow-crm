export type CustomerTemperature = "hot" | "warm" | "cool";

export type CustomerHeaderAction =
  | "call"
  | "text"
  | "email"
  | "appointment"
  | "notes"
  | "more";

export interface CustomerScore {
  value: number;
  max: number;
  explanation: string;
  updatedLabel?: string;
}

export interface CustomerOwner {
  name: string;
  team?: string;
}

export interface CustomerVehicle {
  label: string;
  detail?: string;
}

export interface CustomerAppointment {
  dateLabel: string;
  timeLabel: string;
  type: string;
  status?: string;
}

export interface CustomerHeaderData {
  id: string;
  name: string;
  initials?: string;
  status: string;
  temperature: CustomerTemperature;
  buyingScore?: CustomerScore;
  healthScore?: CustomerScore;
  leadScore?: CustomerScore;
  assignedSalesperson?: CustomerOwner | null;
  primaryVehicle?: CustomerVehicle | null;
  phone?: string | null;
  email?: string | null;
  nextAppointment?: CustomerAppointment | null;
}

export type CustomerActionAvailability = Partial<Record<CustomerHeaderAction, boolean>>;

interface CustomerHeaderBaseProps {
  className?: string;
  onAction?: (action: CustomerHeaderAction) => void;
}

export interface CustomerHeaderReadyProps extends CustomerHeaderBaseProps {
  state?: "ready";
  customer: CustomerHeaderData;
  actionAvailability?: CustomerActionAvailability;
}

export interface CustomerHeaderOfflineProps extends CustomerHeaderBaseProps {
  state: "offline";
  customer: CustomerHeaderData;
  lastUpdatedLabel?: string;
}

export interface CustomerHeaderArchivedProps extends CustomerHeaderBaseProps {
  state: "archived";
  customer: CustomerHeaderData;
  actionAvailability?: Pick<CustomerActionAvailability, "more">;
}

export interface CustomerHeaderLoadingProps extends CustomerHeaderBaseProps {
  state: "loading";
}

export interface CustomerHeaderEmptyProps extends CustomerHeaderBaseProps {
  state: "empty";
  title?: string;
  description?: string;
}

export interface CustomerHeaderErrorProps extends CustomerHeaderBaseProps {
  state: "error";
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export interface CustomerHeaderRestrictedProps extends CustomerHeaderBaseProps {
  state: "permission-restricted";
  visibleIdentity?: Pick<CustomerHeaderData, "name" | "status">;
  description?: string;
}

export type CustomerHeaderProps =
  | CustomerHeaderReadyProps
  | CustomerHeaderOfflineProps
  | CustomerHeaderArchivedProps
  | CustomerHeaderLoadingProps
  | CustomerHeaderEmptyProps
  | CustomerHeaderErrorProps
  | CustomerHeaderRestrictedProps;
