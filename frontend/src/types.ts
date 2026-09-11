export type Role = "STUDENT" | "FACULTY" | "TECHNICIAN" | "ADMIN";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface User {
  id: number;
  email: string;
  displayName: string;
  role: Role;
}

export interface ManagedUser extends User {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
}

export interface TicketComment {
  id: number;
  ticketId: number;
  authorId: number;
  message: string;
  createdAt: string;
  author: User;
}

export interface TicketHistoryItem {
  id: number;
  ticketId: number;
  changedById: number | null;
  action: string;
  oldValue: string;
  newValue: string;
  createdAt: string;
  changedBy: User | null;
}

export interface Ticket {
  id: number;
  requesterId: number;
  assignedTechnicianId: number | null;
  categoryId: number;
  title: string;
  description: string;
  location: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  requester: User;
  assignedTechnician: User | null;
  category: Category;
  comments?: TicketComment[];
  history?: TicketHistoryItem[];
}
