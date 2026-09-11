import type { ReactNode } from "react";
import type { TicketPriority, TicketStatus } from "../types";

export function ErrorMessage({ error }: { error: string | null }) { return error ? <p className="error-message" role="alert">{error}</p> : null; }
export function StatusBadge({ status }: { status: TicketStatus }) { return <span className={`badge status-${status.toLowerCase()}`}>{status.replace("_", " ")}</span>; }
export function PriorityBadge({ priority }: { priority: TicketPriority }) { return <span className={`badge priority-${priority.toLowerCase()}`}>{priority}</span>; }
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) { return <div className="page-header"><div><h1>{title}</h1></div>{action}</div>; }
export function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
