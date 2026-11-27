// Server-side example using an application-owned SQLite connection.
export function ticketWriter(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS voice_tickets (
    account TEXT NOT NULL, conversation TEXT NOT NULL, call_id TEXT NOT NULL,
    subject TEXT NOT NULL, ticket_id INTEGER PRIMARY KEY,
    UNIQUE(account, conversation, call_id)
  )`);
  const insert = db.prepare(`INSERT INTO voice_tickets(account, conversation, call_id, subject)
    VALUES (?, ?, ?, ?) ON CONFLICT(account, conversation, call_id) DO NOTHING
    RETURNING ticket_id, subject`);
  const existing = db.prepare(`SELECT ticket_id, subject FROM voice_tickets
    WHERE account = ? AND conversation = ? AND call_id = ?`);
  return function openTicket(account, conversation, callId, subject) {
    const scope = [account, conversation, callId];
    const row = insert.get(...scope, subject) ?? existing.get(...scope);
    if (row.subject !== subject) throw new Error('This call already opened a ticket with a different subject.');
    return { ticketId: row.ticket_id };
  };
}
