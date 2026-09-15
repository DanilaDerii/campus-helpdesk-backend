import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  ErrorMessage,
  PageHeader,
  PriorityBadge,
  StatusBadge,
  formatDate,
} from "../components/Ui";
import type { ManagedUser, Ticket, TicketStatus } from "../types";

export function TicketDetailPage() {
  const { ticketId } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [techs, setTechs] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [assignment, setAssignment] = useState("");

  const load = async () => {
    if (!ticketId) return;

    try {
      const result = await api.ticket(ticketId);
      setTicket(result.ticket);
      setAssignment(result.ticket.assignedTechnicianId?.toString() ?? "");

      if (user?.role === "ADMIN") {
        const users = await api.users();
        setTechs(
          users.users.filter(
            (candidate) =>
              candidate.role === "TECHNICIAN" && candidate.isActive,
          ),
        );
      }

      setError(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load ticket.",
      );
    }
  };

  useEffect(() => {
    void load();
  }, [ticketId, user?.role]);

  if (!ticket && !error) {
    return <p className="loading">Loading ticket…</p>;
  }

  if (!ticket) {
    return (
      <>
        <ErrorMessage error={error} />
        <Link to="/">Back to tickets</Link>
      </>
    );
  }

  const loadedTicketId = ticket.id;
  const mayClaim =
    user?.role === "TECHNICIAN" &&
    ticket.assignedTechnicianId === null &&
    ticket.status === "OPEN";
  const mayStatus =
    user?.role === "ADMIN" ||
    (user?.role === "TECHNICIAN" &&
      ticket.assignedTechnicianId === user.id);

  async function commentSubmit(event: FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;

    try {
      await api.addComment(loadedTicketId, comment.trim());
      setComment("");
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not add comment.",
      );
    }
  }

  async function updateStatus(status: TicketStatus) {
    try {
      await api.updateTicketStatus(loadedTicketId, status);
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update status.",
      );
    }
  }

  return (
    <>
      <PageHeader
        title={`Ticket #${ticket.id}`}
        action={
          <Link className="button button-secondary compact" to="/">
            Back to tickets
          </Link>
        }
      />
      <ErrorMessage error={error} />

      <div className="detail-grid">
        <section className="detail-card">
          <div className="detail-title">
            <h2>{ticket.title}</h2>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="ticket-description">
            {ticket.description || "No description provided."}
          </p>
          <dl>
            <dt>Category</dt>
            <dd>{ticket.category.name}</dd>
            <dt>Location</dt>
            <dd>{ticket.location || "Not specified"}</dd>
            <dt>Priority</dt>
            <dd><PriorityBadge priority={ticket.priority} /></dd>
            <dt>Requester</dt>
            <dd>
              {ticket.requester.displayName}{" "}
              <span className="muted">({ticket.requester.email})</span>
            </dd>
            <dt>Assigned technician</dt>
            <dd>
              {ticket.assignedTechnician
                ? `${ticket.assignedTechnician.displayName} (${ticket.assignedTechnician.email})`
                : "Unassigned"}
            </dd>
            <dt>Created</dt>
            <dd>{formatDate(ticket.createdAt)}</dd>
            <dt>Last updated</dt>
            <dd>{formatDate(ticket.updatedAt)}</dd>
          </dl>
        </section>

        <aside className="detail-card">
          <h2>Actions</h2>
          {mayClaim && (
            <button
              className="button button-primary compact"
              onClick={() =>
                void api.claimTicket(ticket.id).then(load).catch((error) => setError(error.message))
              }
            >
              Claim ticket
            </button>
          )}
          {mayStatus && ticket.status !== "RESOLVED" && (
            <div className="stack">
              <p>Change status</p>
              {ticket.status === "OPEN" && (
                <>
                  <button className="button button-secondary compact" onClick={() => void updateStatus("IN_PROGRESS")}>
                    Start work
                  </button>
                  <button className="button button-secondary compact" onClick={() => void updateStatus("RESOLVED")}>
                    Resolve ticket
                  </button>
                </>
              )}
              {ticket.status === "IN_PROGRESS" && (
                <button className="button button-secondary compact" onClick={() => void updateStatus("RESOLVED")}>
                  Resolve ticket
                </button>
              )}
            </div>
          )}
          {user?.role === "ADMIN" && (
            <label>
              Assign technician
              <select value={assignment} onChange={(event) => setAssignment(event.target.value)}>
                <option value="">Select technician</option>
                {techs.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.displayName}
                  </option>
                ))}
              </select>
              <button
                className="button button-secondary compact"
                disabled={!assignment}
                onClick={() =>
                  void api.assignTicket(ticket.id, Number(assignment)).then(load).catch((error) => setError(error.message))
                }
              >
                Save assignment
              </button>
            </label>
          )}
        </aside>
      </div>

      <section className="section-card">
        <h2>Comments</h2>
        {ticket.comments?.length ? (
          <div className="timeline">
            {ticket.comments.map((ticketComment) => (
              <article key={ticketComment.id}>
                <strong>{ticketComment.author.displayName}</strong>
                <time>{formatDate(ticketComment.createdAt)}</time>
                <p>{ticketComment.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No comments yet.</p>
        )}
        <form onSubmit={commentSubmit} className="comment-form">
          <textarea
            maxLength={5000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Add a comment"
            required
          />
          <button className="button button-primary compact">Post comment</button>
        </form>
      </section>
    </>
  );
}
