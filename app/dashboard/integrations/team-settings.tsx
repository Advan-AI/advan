"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Trash2, Users, Lock, UserPlus } from "lucide-react"
import { DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"
import { useBillingRestriction } from "@/hooks/use-billing-restriction"

const FIELD =
  "h-10 w-full rounded-lg border dash-border bg-white px-3 text-[13px] text-[var(--dash-ink)] outline-none transition placeholder:text-[var(--dash-ink-faint)] focus:border-[#9D91EA] focus:ring-2 focus:ring-[#6B5CD6]/15"

const ROLES = ["admin", "member", "viewer"] as const
type Role = (typeof ROLES)[number]

export function TeamSettings() {
  const utils = api.useUtils()
  const { isRestricted } = useBillingRestriction()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("member")
  const [password, setPassword] = useState("")
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)

  const { data: members, isLoading } = api.team.listMembers.useQuery(undefined, {
    staleTime: 30_000,
  })

  const addMember = api.team.addMember.useMutation({
    onSuccess: async (user) => {
      toast.success(`${user.name} added to the team`)
      setOpen(false)
      setName("")
      setEmail("")
      setPassword("")
      setRole("member")
      await utils.team.listMembers.invalidate()
    },
    onError: (err) => toast.error(err.message || "Could not add member"),
  })

  const removeMember = api.team.removeMember.useMutation({
    onSuccess: async () => {
      toast.success("Member removed")
      setRemoveTarget(null)
      await utils.team.listMembers.invalidate()
    },
    onError: (err) => toast.error(err.message || "Could not remove member"),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password) {
      toast.error("Name, email, and password are required")
      return
    }
    addMember.mutate({ name: name.trim(), email: email.trim(), role, password })
  }

  return (
    <DashCard
      title="Team members"
      icon={<Users className="h-[18px] w-[18px]" />}
      right={
        <button
          type="button"
          disabled={isRestricted}
          onClick={() => {
            if (isRestricted) {
              toast.error("Team invites are locked due to billing issue. Update billing to invite members.")
            } else {
              setOpen(true)
            }
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-3 text-[12.5px] font-semibold text-white transition hover:-translate-y-px disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRestricted ? <Lock className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
          Invite member
        </button>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--dash-accent)]" />
        </div>
      ) : !members?.length ? (
        <p className="py-6 text-center text-[13px] text-[var(--dash-ink-faint)]">No team members yet.</p>
      ) : (
        <div className="divide-y dash-border-soft">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ECE9FB] text-[13px] font-bold text-[var(--dash-accent-deep)]">
                {m.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-[var(--dash-ink)]">{m.name}</div>
                <div className="truncate text-[11.5px] text-[var(--dash-ink-faint)]">{m.email}</div>
              </div>
              <span className="rounded-md bg-[var(--dash-bg)] px-2 py-0.5 text-[11px] font-bold capitalize text-[var(--dash-ink-soft)]">
                {m.role}
              </span>
              <button
                type="button"
                onClick={() => setRemoveTarget(m.id)}
                disabled={removeMember.isPending}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--dash-ink-faint)] transition hover:bg-white hover:text-[var(--dash-rose)] disabled:opacity-50"
                aria-label={`Remove ${m.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Invite modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onMouseDown={() => setOpen(false)}
        >
          <form
            onSubmit={submit}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] overflow-hidden rounded-2xl border dash-border bg-[var(--dash-card)] shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)]"
          >
            <div className="flex items-center gap-3 border-b dash-border-soft px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECE9FB] text-[var(--dash-accent)]">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[15px] font-bold text-[var(--dash-ink)]">Invite team member</div>
                <div className="text-[12px] text-[var(--dash-ink-faint)]">Seat limits are enforced by your plan.</div>
              </div>
            </div>
            <div className="grid gap-3 p-5">
              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Name *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Jane Smith" className={FIELD} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Email *</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" className={FIELD} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Role</span>
                  <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={FIELD}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-[var(--dash-ink-faint)]">Temp password *</span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 chars" className={FIELD} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t dash-border-soft px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]">
                Cancel
              </button>
              <button type="submit" disabled={addMember.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#6B5CD6] to-[#4E3FB6] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60">
                {addMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add member
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Remove confirm */}
      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onMouseDown={() => setRemoveTarget(null)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] rounded-2xl border dash-border bg-[var(--dash-card)] p-5 shadow-[0_30px_90px_-45px_rgba(23,26,23,0.55)]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dash-rose-wash)] text-[var(--dash-rose)]">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[15px] font-bold text-[var(--dash-ink)]">Remove member?</div>
                <p className="mt-1 text-[12.5px] leading-5 text-[var(--dash-ink-soft)]">
                  This will revoke their dashboard access immediately.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setRemoveTarget(null)} className="h-9 rounded-lg border dash-border bg-white px-3.5 text-[13px] font-semibold text-[var(--dash-ink-soft)] transition hover:text-[var(--dash-ink)]">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeMember.mutate({ userId: removeTarget })}
                disabled={removeMember.isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--dash-rose)] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removeMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </DashCard>
  )
}
