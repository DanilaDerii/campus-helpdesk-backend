import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../api";
import { useAuth } from "../auth";
import {
  ErrorMessage,
  PageHeader,
  PriorityBadge,
  StatusBadge,
  formatDate,
} from "../components/Ui";
import type { Ticket, TicketStatus } from "../types";

const statusOrder: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

export function DashboardPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    try {
      setTickets((await api.tickets()).tickets);
      setError(null);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Could not load tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function mayClaim(ticket: Ticket) {
    return user?.role === "TECHNICIAN" &&
      ticket.assignedTechnicianId === null &&
      ticket.status === "OPEN";
  }

  function mayChange(ticket: Ticket) {
    return user?.role === "ADMIN" ||
      (user?.role === "TECHNICIAN" &&
        ticket.assignedTechnicianId === user.id);
  }

  async function claim(ticket: Ticket) {
    try {
      await api.claimTicket(ticket.id);
      await load();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Could not claim ticket.");
    }
  }

  async function changeStatus(ticket: Ticket, status: TicketStatus) {
    try {
      await api.updateTicketStatus(ticket.id, status);
      await load();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Could not update ticket.");
    }
  }

  const createAction = user?.role !== "TECHNICIAN"
    ? <Link className="button button-primary compact" to="/tickets/new">Create ticket</Link>
    : undefined;

  return (
    <>
      <PageHeader title="Tickets" action={createAction} />
      <ErrorMessage error={error} />

      {loading && <p className="loading">Loading tickets…</p>}

      {!loading && tickets.length === 0 && (
        <section className="empty-state">
          <h2>No tickets yet</h2>
          <p>
            {user?.role === "TECHNICIAN"
              ? "No assigned or open tickets are currently available."
              : "Create a ticket when you need campus support."}
          </p>
          {user?.role !== "TECHNICIAN" && (
            <Link className="button button-primary compact" to="/tickets/new">
              Create your first ticket
            </Link>
          )}
        </section>
      )}

      {!loading && tickets.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Category</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link className="ticket-link" to={`/tickets/${ticket.id}`}>
                      #{ticket.id} {ticket.title}
                    </Link>
                    <small>
                      {ticket.assignedTechnician?.displayName ?? "Unassigned"}
                    </small>
                  </td>
                  <td>{ticket.category.name}</td>
                  <td><StatusBadge status={ticket.status} /></td>
                  <td><PriorityBadge priority={ticket.priority} /></td>
                  <td>{formatDate(ticket.createdAt)}</td>
                  <td className="actions">
                    <Link
                      className="button button-secondary compact"
                      to={`/tickets/${ticket.id}`}
                    >
                      View
                    </Link>
                    {mayClaim(ticket) && (
                      <button
                        className="button button-primary compact"
                        onClick={() => void claim(ticket)}
                      >
                        Claim
                      </button>
                    )}
                    {mayChange(ticket) && ticket.status !== "RESOLVED" && (
                      <select
                        aria-label={`Change status for ticket ${ticket.id}`}
                        value={ticket.status}
                        onChange={(event) => void changeStatus(
                          ticket,
                          event.target.value as TicketStatus,
                        )}
                      >
                        <option value={ticket.status}>Change status…</option>
                        {statusOrder
                          .filter((status) =>
                            status !== ticket.status &&
                            (ticket.status === "OPEN"
                              ? status !== "OPEN"
                              : status === "RESOLVED")
                          )
                          .map((status) => (
                            <option key={status} value={status}>
                              {status.replace("_", " ")}
                            </option>
                          ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
