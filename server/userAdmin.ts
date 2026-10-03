import type Database from 'better-sqlite3'
import { isOwnerEmail, ownerEmailFromEnv } from '../src/shared/owner.ts'

export function ownerEmail() {
  return ownerEmailFromEnv(process.env.ADMIN_EMAIL)
}

export function isOwnerUser(user: { email?: string | null }) {
  return isOwnerEmail(user.email)
}

export function assertCanManageAdminRole(
  actor: { email?: string | null },
  target: { email?: string | null; role?: string },
  nextRole: string,
) {
  const roleChangingToOrFromAdmin =
    (target.role === 'admin' && nextRole !== 'admin') ||
    (target.role !== 'admin' && nextRole === 'admin')
  if (!roleChangingToOrFromAdmin) return
  if (!isOwnerUser(actor)) {
    throw new Error('Vain pääkäyttäjä (Jussi Heimonen) voi lisätä tai poistaa ylläpitäjiä')
  }
  if (isOwnerEmail(target.email) && nextRole !== 'admin') {
    throw new Error('Pääkäyttäjän ylläpito-oikeutta ei voi poistaa')
  }
}

export function assertCanInviteAdmin(actor: { email?: string | null }, role: string) {
  if (role === 'admin' && !isOwnerUser(actor)) {
    throw new Error('Vain pääkäyttäjä (Jussi Heimonen) voi kutsua ylläpitäjiä')
  }
}

export function assertCanDeleteUser(
  actor: { id: string; email?: string | null },
  target: { id: string; email?: string | null; role?: string; active?: number | boolean },
  activeAdminCount: number,
) {
  if (target.id === actor.id) {
    throw new Error('Et voi poistaa omaa tiliäsi')
  }
  if (isOwnerEmail(target.email)) {
    throw new Error('Pääkäyttäjää ei voi poistaa')
  }
  const targetIsAdmin = target.role === 'admin' && (target.active === 1 || target.active === true)
  if (targetIsAdmin && !isOwnerUser(actor)) {
    throw new Error('Vain pääkäyttäjä voi poistaa ylläpitäjän')
  }
  if (targetIsAdmin && activeAdminCount <= 1) {
    throw new Error('Viimeistä ylläpitäjää ei voi poistaa')
  }
}

/** Poistaa käyttäjän ja irrottaa / siivoaa viittaukset. */
export function deleteUserRecord(db: Database.Database, userId: string) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM assignments WHERE user_id = ?').run(userId)
    db.prepare('UPDATE shift_tasks SET assignee_user_id = NULL WHERE assignee_user_id = ?').run(
      userId,
    )
    db.prepare('UPDATE shift_tasks SET done_by_user_id = NULL WHERE done_by_user_id = ?').run(userId)
    db.prepare('DELETE FROM shift_messages WHERE author_user_id = ?').run(userId)

    db.prepare(
      `UPDATE swap_offers SET to_user_id = NULL WHERE to_user_id = ?`,
    ).run(userId)
    db.prepare(
      `UPDATE swap_offers SET accepted_by_user_id = NULL WHERE accepted_by_user_id = ?`,
    ).run(userId)
    db.prepare('DELETE FROM swap_offers WHERE from_user_id = ?').run(userId)

    db.prepare('DELETE FROM extra_task_signups WHERE user_id = ?').run(userId)
    db.prepare(
      `DELETE FROM extra_task_signups WHERE extra_task_id IN (
         SELECT id FROM extra_tasks WHERE created_by_user_id = ?
       )`,
    ).run(userId)
    db.prepare('DELETE FROM extra_tasks WHERE created_by_user_id = ?').run(userId)

    db.prepare('DELETE FROM notice_replies WHERE author_user_id = ?').run(userId)
    db.prepare(
      `DELETE FROM notice_replies WHERE notice_id IN (
         SELECT id FROM notices WHERE author_user_id = ?
       )`,
    ).run(userId)
    db.prepare(
      `UPDATE notices SET acknowledged_by_user_id = NULL WHERE acknowledged_by_user_id = ?`,
    ).run(userId)
    db.prepare('DELETE FROM notices WHERE author_user_id = ?').run(userId)

    db.prepare(
      `UPDATE hub_inspections SET completed_by_user_id = NULL WHERE completed_by_user_id = ?`,
    ).run(userId)
    db.prepare(
      `UPDATE invites SET created_by_user_id = NULL WHERE created_by_user_id = ?`,
    ).run(userId)

    // week_blocks / notifications / push cascade, but delete explicitly for clarity
    db.prepare('DELETE FROM week_blocks WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId)

    const info = db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    if (!info.changes) throw new Error('Käyttäjää ei löydy')
  })
  tx()
}
