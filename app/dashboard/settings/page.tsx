"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  User,
  Shield,
  Building,
  Users as UsersIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  UserPlus,
  Trash2,
  Info,
  Check,
  Eye,
  EyeOff,
  UserCheck,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"

type Tab = "profile" | "security" | "organization" | "team"

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const utils = api.useUtils()

  // Tab State
  const defaultTab = (searchParams?.get("tab") as Tab) || "profile"
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab)

  // Sync tab state with URL parameter for shareability and direct links
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    router.push(`/dashboard/settings?tab=${tab}`)
  }

  // ─── 1. FETCH DATA ─────────────────────────────────────────────────────────
  const { data: profile, isLoading: loadingProfile } = api.user.getProfile.useQuery()
  const { data: orgSettings, isLoading: loadingOrg } = api.user.getOrgSettings.useQuery()
  const { data: teamMembers, isLoading: loadingTeam } = api.team.listMembers.useQuery()

  // ─── 2. FORM STATES & MUTATIONS ───────────────────────────────────────────

  // -- Profile Form --
  const [profileName, setProfileName] = useState("")
  const [profileEmail, setProfileEmail] = useState("")
  const [profileChatAvailable, setProfileChatAvailable] = useState(true)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setProfileName(profile.name || "")
      setProfileEmail(profile.email || "")
      setProfileChatAvailable(profile.chatAvailable)
    }
  }, [profile])

  const updateProfileMutation = api.user.updateProfile.useMutation({
    onSuccess: () => {
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
      void utils.user.getProfile.invalidate()
    },
    onError: (err) => {
      setProfileError(err.message || "Failed to update profile.")
    },
  })

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(false)
    try {
      await updateProfileMutation.mutateAsync({
        name: profileName,
        email: profileEmail,
        chatAvailable: profileChatAvailable,
      })
    } catch (err) {}
  }

  // -- Security Form --
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [securitySuccess, setSecuritySuccess] = useState(false)
  const [securityError, setSecurityError] = useState<string | null>(null)
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, text: "Weak", color: "bg-red-500" })

  // Calculate simple password strength
  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength({ score: 0, text: "Empty", color: "bg-gray-200" })
      return
    }
    let score = 0
    if (newPassword.length >= 8) score++
    if (/[A-Z]/.test(newPassword)) score++
    if (/[0-9]/.test(newPassword)) score++
    if (/[^A-Za-z0-9]/.test(newPassword)) score++

    if (score <= 1) {
      setPasswordStrength({ score, text: "Weak", color: "bg-rose-500" })
    } else if (score === 2 || score === 3) {
      setPasswordStrength({ score, text: "Medium", color: "bg-amber-500" })
    } else {
      setPasswordStrength({ score, text: "Strong", color: "bg-emerald-500" })
    }
  }, [newPassword])

  const changePasswordMutation = api.user.changePassword.useMutation({
    onSuccess: () => {
      setSecuritySuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setSecuritySuccess(false), 3000)
    },
    onError: (err) => {
      setSecurityError(err.message || "Failed to change password.")
    },
  })

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSecurityError(null)
    setSecuritySuccess(false)

    if (newPassword !== confirmPassword) {
      setSecurityError("New passwords do not match.")
      return
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      })
    } catch (err) {}
  }

  // -- Organization Form --
  const [orgName, setOrgName] = useState("")
  const [orgSlug, setOrgSlug] = useState("")
  const [orgSuccess, setOrgSuccess] = useState(false)
  const [orgError, setOrgError] = useState<string | null>(null)

  useEffect(() => {
    if (orgSettings) {
      setOrgName(orgSettings.name || "")
      setOrgSlug(orgSettings.slug || "")
    }
  }, [orgSettings])

  const updateOrgMutation = api.user.updateOrgSettings.useMutation({
    onSuccess: () => {
      setOrgSuccess(true)
      setTimeout(() => setOrgSuccess(false), 3000)
      void utils.user.getOrgSettings.invalidate()
    },
    onError: (err) => {
      setOrgError(err.message || "Failed to update organization settings.")
    },
  })

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setOrgError(null)
    setOrgSuccess(false)
    try {
      await updateOrgMutation.mutateAsync({
        name: orgName,
        slug: orgSlug,
      })
    } catch (err) {}
  }

  // -- Team Form (Add/Remove) --
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member")
  const [invitePassword, setInvitePassword] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)

  const addMemberMutation = api.team.addMember.useMutation({
    onSuccess: () => {
      setInviteSuccess(true)
      setInviteName("")
      setInviteEmail("")
      setInvitePassword("")
      setTimeout(() => setInviteSuccess(false), 3000)
      void utils.team.listMembers.invalidate()
    },
    onError: (err) => {
      setInviteError(err.message || "Failed to add team member.")
    },
  })

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(false)

    if (!invitePassword || invitePassword.length < 6) {
      setInviteError("Please provide an initial password of at least 6 characters.")
      return
    }

    try {
      await addMemberMutation.mutateAsync({
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        password: invitePassword,
      })
    } catch (err) {}
  }

  const removeMemberMutation = api.team.removeMember.useMutation({
    onSuccess: () => {
      setRemovingUserId(null)
      void utils.team.listMembers.invalidate()
    },
    onError: (err) => {
      alert(err.message || "Failed to remove team member.")
      setRemovingUserId(null)
    },
  })

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you absolutely sure you want to remove this team member? They will lose access immediately.")) {
      return
    }
    setRemovingUserId(userId)
    try {
      await removeMemberMutation.mutateAsync({ userId })
    } catch (err) {}
  }

  // Loading indicator for main container
  const loadingInitial = loadingProfile || loadingOrg || loadingTeam

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-[var(--dash-accent)]" />
        <p className="text-[13.5px] text-[var(--dash-ink-soft)] font-medium">Loading settings pane...</p>
      </div>
    )
  }

  const isAdmin = profile?.role === "admin"

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <DashPageHeader
        eyebrow="System Configuration"
        title="Settings & Profile"
        subtitle="Manage your personal profile, security credentials, organization subdomains, and invite team members."
      />

      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {/* Navigation Tabs - Vertical on Desktop, Horizontal Scroll on Mobile */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-none border-b lg:border-b-0 dash-border-soft lg:dash-bg-card lg:border lg:dash-border lg:rounded-xl lg:p-2">
            <button
              onClick={() => handleTabChange("profile")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-semibold transition-all whitespace-nowrap lg:w-full ${
                activeTab === "profile"
                  ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                  : "text-[var(--dash-ink-soft)] hover:bg-black/[0.03] hover:text-[var(--dash-ink)]"
              }`}
            >
              <User className="w-4 h-4" />
              <span>User Profile</span>
            </button>
            <button
              onClick={() => handleTabChange("security")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-semibold transition-all whitespace-nowrap lg:w-full ${
                activeTab === "security"
                  ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                  : "text-[var(--dash-ink-soft)] hover:bg-black/[0.03] hover:text-[var(--dash-ink)]"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Security</span>
            </button>
            <button
              onClick={() => handleTabChange("organization")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-semibold transition-all whitespace-nowrap lg:w-full ${
                activeTab === "organization"
                  ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                  : "text-[var(--dash-ink-soft)] hover:bg-black/[0.03] hover:text-[var(--dash-ink)]"
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Organization Settings</span>
              {!isAdmin && (
                <span className="ml-auto inline-block lg:block scale-75 opacity-50">
                  <Shield className="w-3.5 h-3.5 text-gray-500" />
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange("team")}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13.5px] font-semibold transition-all whitespace-nowrap lg:w-full ${
                activeTab === "team"
                  ? "bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                  : "text-[var(--dash-ink-soft)] hover:bg-black/[0.03] hover:text-[var(--dash-ink)]"
              }`}
            >
              <UsersIcon className="w-4 h-4" />
              <span>Team Members</span>
              {teamMembers && (
                <span className="ml-auto bg-black/[0.05] text-[10.5px] px-1.5 py-0.5 rounded font-bold text-[var(--dash-ink-soft)]">
                  {teamMembers.length}
                </span>
              )}
            </button>
          </nav>
        </aside>

        {/* Dynamic Content Panel */}
        <div className="flex-1 min-w-0">
          {/* TAB 1: USER PROFILE */}
          {activeTab === "profile" && (
            <div className="flex flex-col gap-6">
              <DashCard title="Personal Details" icon={<User className="w-4 h-4" />}>
                <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b dash-border-soft mb-6">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-bold text-white shadow-md relative group shrink-0"
                    style={{
                      background: "linear-gradient(135deg,#8E80E5,#5C4DC1)",
                    }}
                  >
                    {(profile?.name || "SJ")
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="text-center sm:text-left min-w-0">
                    <h3 className="text-[15px] font-bold text-[var(--dash-ink)] truncate">{profile?.name}</h3>
                    <p className="text-[12px] text-[var(--dash-ink-faint)] mt-0.5 truncate">{profile?.email}</p>
                    <span className="inline-block mt-2 text-[10.5px] font-bold uppercase tracking-wider bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)] px-2.5 py-0.5 rounded-md border border-[var(--dash-accent)]/10">
                      {profile?.role} Role
                    </span>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  {profileError && (
                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 text-[12.5px]">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{profileError}</span>
                    </div>
                  )}

                  {profileSuccess && (
                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-[12.5px]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Profile details saved successfully.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="p-name" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                        Full Name
                      </label>
                      <input
                        id="p-name"
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        required
                        placeholder="e.g. Sarah Johnson"
                        className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="p-email" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                        Email Address
                      </label>
                      <input
                        id="p-email"
                        type="email"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        required
                        placeholder="e.g. sarah@acme.co"
                        className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t dash-border-soft flex items-center justify-between mt-6">
                    <div className="flex items-center gap-3">
                      <input
                        id="p-chat"
                        type="checkbox"
                        checked={profileChatAvailable}
                        onChange={(e) => setProfileChatAvailable(e.target.checked)}
                        className="w-4 h-4 accent-[var(--dash-accent)] rounded border-gray-300 focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="p-chat" className="text-[13px] text-[var(--dash-ink-soft)] cursor-pointer select-none">
                        Include me in live chat routing allocations (Available)
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={updateProfileMutation.isPending}
                      className="h-9 px-4.5 rounded-lg bg-[var(--dash-accent)] hover:bg-[var(--dash-accent-deep)] text-white text-[13px] font-semibold transition flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {updateProfileMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : profileSuccess ? (
                        <Check className="w-4 h-4" />
                      ) : null}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </DashCard>
            </div>
          )}

          {/* TAB 2: SECURITY & PASSWORD */}
          {activeTab === "security" && (
            <div className="flex flex-col gap-6">
              <DashCard title="Security Credentials" icon={<Shield className="w-4 h-4" />}>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {securityError && (
                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 text-[12.5px]">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{securityError}</span>
                    </div>
                  )}

                  {securitySuccess && (
                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-[12.5px]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Password changed successfully.</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 max-w-md">
                    <label htmlFor="curr-pass" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        id="curr-pass"
                        type={showCurrent ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="h-9.5 w-full pl-3 pr-10 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink)] transition"
                      >
                        {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="new-pass" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          id="new-pass"
                          type={showNew ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          placeholder="At least 6 characters"
                          className="h-9.5 w-full pl-3 pr-10 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--dash-ink-faint)] hover:text-[var(--dash-ink)] transition"
                        >
                          {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {/* Password strength visual indicator */}
                      {newPassword && (
                        <div className="mt-1.5 space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold text-[var(--dash-ink-faint)]">
                            <span>Password Strength:</span>
                            <span className="uppercase tracking-wider">{passwordStrength.text}</span>
                          </div>
                          <div className="h-1 w-full bg-black/[0.05] rounded-full overflow-hidden flex gap-0.5">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className={`h-full flex-1 transition-colors ${
                                  i <= passwordStrength.score ? passwordStrength.color : "bg-black/[0.05]"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="conf-pass" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                        Confirm New Password
                      </label>
                      <input
                        id="conf-pass"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="Repeat new password"
                        className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t dash-border-soft flex justify-end mt-6">
                    <button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      className="h-9 px-4.5 rounded-lg bg-[var(--dash-accent)] hover:bg-[var(--dash-accent-deep)] text-white text-[13px] font-semibold transition flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {changePasswordMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <KeyRound className="w-4 h-4" />
                      )}
                      <span>Update Password</span>
                    </button>
                  </div>
                </form>
              </DashCard>
            </div>
          )}

          {/* TAB 3: ORGANIZATION SETTINGS */}
          {activeTab === "organization" && (
            <div className="flex flex-col gap-6">
              <DashCard title="Workspace Identity" icon={<Building className="w-4 h-4" />}>
                {!isAdmin ? (
                  <div className="p-4 rounded-xl bg-orange-50/50 border border-orange-100 flex gap-3 text-orange-900 text-[13px] leading-[1.6]">
                    <Shield className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Administrator access required.</span> You are currently logged in as a{" "}
                      <span className="font-bold">{profile?.role}</span>. Only organization owners and administrators have
                      permissions to adjust the workspace name, subdomain, and direct configurations.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateOrg} className="space-y-4">
                    {orgError && (
                      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 text-[12.5px]">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{orgError}</span>
                      </div>
                    )}

                    {orgSuccess && (
                      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-[12.5px]">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Organization profile saved.</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="o-name" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                          Organization / Company Name
                        </label>
                        <input
                          id="o-name"
                          type="text"
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          required
                          placeholder="e.g. Acme Inc."
                          className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="o-slug" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                          Workspace Subdomain (URL Slug)
                        </label>
                        <div className="relative flex items-center">
                          <input
                            id="o-slug"
                            type="text"
                            value={orgSlug}
                            onChange={(e) => setOrgSlug(e.target.value)}
                            required
                            placeholder="acme"
                            className="h-9.5 w-full pl-3 pr-24 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                          />
                          <span className="absolute right-2 text-[10.5px] font-bold text-[var(--dash-ink-faint)] dash-bg-deep rounded-md px-1.5 py-1 select-none pointer-events-none border border-black/[0.03]">
                            .advan.ai
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl border dash-border-soft bg-[var(--dash-bg-deep)]/40 flex gap-3 text-[12px] text-[var(--dash-ink-soft)] leading-[1.6]">
                      <Info className="w-4 h-4 text-[var(--dash-accent)] shrink-0 mt-0.5" />
                      <div>
                        Modifying the workspace URL slug updates your organization subdomain. Shared assets, public feedback, and
                        live widget URLs will dynamically route to the new location.
                      </div>
                    </div>

                    <div className="pt-4 border-t dash-border-soft flex justify-end mt-6">
                      <button
                        type="submit"
                        disabled={updateOrgMutation.isPending}
                        className="h-9 px-4.5 rounded-lg bg-[var(--dash-accent)] hover:bg-[var(--dash-accent-deep)] text-white text-[13px] font-semibold transition flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {updateOrgMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : null}
                        <span>Save Workspace Settings</span>
                      </button>
                    </div>
                  </form>
                )}
              </DashCard>
            </div>
          )}

          {/* TAB 4: TEAM MEMBERS */}
          {activeTab === "team" && (
            <div className="flex flex-col gap-6">
              {/* Invite Member Section - Admins only */}
              {isAdmin && (
                <DashCard title="Invite Team Member" icon={<UserPlus className="w-4 h-4" />}>
                  <form onSubmit={handleAddMember} className="space-y-4">
                    {inviteError && (
                      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 text-[12.5px]">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{inviteError}</span>
                      </div>
                    )}

                    {inviteSuccess && (
                      <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-[12.5px]">
                        <UserCheck className="w-4 h-4 shrink-0" />
                        <span>Team member invited and credentials generated.</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="i-name" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                          Full Name
                        </label>
                        <input
                          id="i-name"
                          type="text"
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          required
                          placeholder="e.g. David Miller"
                          className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="i-email" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                          Email Address
                        </label>
                        <input
                          id="i-email"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          required
                          placeholder="e.g. david@acme.co"
                          className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="i-role" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                          Workspace Role
                        </label>
                        <select
                          id="i-role"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as any)}
                          className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition cursor-pointer"
                        >
                          <option value="member">Member (Read/Write)</option>
                          <option value="admin">Administrator (Full Access)</option>
                          <option value="viewer">Viewer (Read-Only)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="i-pass" className="text-[12px] font-bold text-[var(--dash-ink-soft)]">
                          Initial Temp Password
                        </label>
                        <input
                          id="i-pass"
                          type="text"
                          value={invitePassword}
                          onChange={(e) => setInvitePassword(e.target.value)}
                          required
                          placeholder="Min. 6 characters"
                          className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t dash-border-soft flex justify-end mt-4">
                      <button
                        type="submit"
                        disabled={addMemberMutation.isPending}
                        className="h-9 px-4.5 rounded-lg bg-[var(--dash-accent)] hover:bg-[var(--dash-accent-deep)] text-white text-[13px] font-semibold transition flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {addMemberMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        <span>Invite Agent</span>
                      </button>
                    </div>
                  </form>
                </DashCard>
              )}

              {/* Active Workspace Directory */}
              <DashCard title="Active Workspace Directory" icon={<UsersIcon className="w-4 h-4" />} padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b dash-border-soft bg-[var(--dash-bg-deep)]/40 text-[10.5px] font-bold uppercase tracking-[0.11em] text-[var(--dash-ink-faint)]">
                        <th className="px-5 py-3">Agent</th>
                        <th className="px-5 py-3">Role</th>
                        <th className="px-5 py-3">Joined Date</th>
                        {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y dash-border-soft">
                      {teamMembers?.map((member) => {
                        const isSelf = member.id === profile?.id
                        const initials = member.name
                          ?.split(" ")
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "M"

                        return (
                          <tr key={member.id} className="hover:bg-black/[0.01] transition-colors text-[13px] text-[var(--dash-ink)]">
                            <td className="px-5 py-3.5 flex items-center gap-3 min-w-0">
                              <span
                                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-sm"
                                style={{
                                  background: "linear-gradient(135deg,#8E80E5,#5C4DC1)",
                                }}
                              >
                                {initials}
                              </span>
                              <div className="min-w-0 leading-tight">
                                <div className="font-bold flex items-center gap-1.5 truncate">
                                  <span>{member.name}</span>
                                  {isSelf && (
                                    <span className="text-[9.5px] font-bold bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)] border border-[var(--dash-accent)]/15 rounded-md px-1.5 py-0.5">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[var(--dash-ink-faint)] truncate mt-0.5">{member.email}</div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-block text-[11px] font-semibold uppercase tracking-wider rounded px-2 py-0.5 border ${
                                member.role === "admin"
                                  ? "text-purple-700 bg-purple-50 border-purple-100"
                                  : member.role === "member"
                                  ? "text-blue-700 bg-blue-50 border-blue-100"
                                  : "text-gray-600 bg-gray-50 border-gray-100"
                              }`}>
                                {member.role}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-[var(--dash-ink-soft)]">
                              {member.createdAt ? new Date(member.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric"
                              }) : "N/A"}
                            </td>
                            {isAdmin && (
                              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                <button
                                  onClick={() => handleRemoveMember(member.id)}
                                  disabled={isSelf || removingUserId === member.id}
                                  title={isSelf ? "You cannot remove yourself" : "Remove user from organization"}
                                  className="p-1.5 rounded-md text-[var(--dash-ink-faint)] hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--dash-ink-faint)] transition-colors"
                                >
                                  {removingUserId === member.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </DashCard>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
