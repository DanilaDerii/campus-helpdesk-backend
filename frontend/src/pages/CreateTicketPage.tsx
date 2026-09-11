import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { ErrorMessage, PageHeader } from "../components/Ui";
import type { Category, TicketPriority } from "../types";
const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export function CreateTicketPage() {
  const navigate = useNavigate(); const [categories, setCategories] = useState<Category[]>([]); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ categoryId: "", title: "", description: "", location: "", priority: "MEDIUM" as TicketPriority });
  useEffect(() => { api.categories().then(r => setCategories(r.categories)).catch(e => setError(e instanceof Error ? e.message : "Could not load categories.")); }, []);
  async function submit(e: FormEvent) { e.preventDefault(); if (!form.categoryId || !form.title.trim()) { setError("Category and title are required."); return; } setSaving(true); try { const { ticket } = await api.createTicket({ ...form, categoryId: Number(form.categoryId), title: form.title.trim(), description: form.description.trim(), location: form.location.trim() }); navigate(`/tickets/${ticket.id}`); } catch (e) { setError(e instanceof Error ? e.message : "Could not create ticket."); } finally { setSaving(false); } }
  return <><PageHeader title="Create ticket" /><form className="form-card" onSubmit={submit}><ErrorMessage error={error} /><label>Category<select required value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Select a category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Title<input required maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><label>Location<input maxLength={200} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label><label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TicketPriority })}>{priorities.map(p => <option key={p}>{p}</option>)}</select></label><div className="form-actions"><button className="button button-primary compact" disabled={saving}>{saving ? "Creating…" : "Create ticket"}</button></div></form></>;
}
