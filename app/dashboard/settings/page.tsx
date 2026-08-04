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
  Camera,
  Pencil,
} from "lucide-react"
import { DashPageHeader, DashCard } from "@/components/dashboard/page-header"
import { api } from "@/lib/api/trpc-client"
import { TEAM_PERMISSION_CATALOG } from "@/lib/team-permissions"

type Tab = "profile" | "security" | "organization" | "team"
type TeamPanelTab = "roles" | "add-user" | "directory"

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
  const { data: teamRoles, isLoading: loadingRoles } = api.team.listRoles.useQuery()

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

  // -- Avatar Upload --
  const [avatarUploading, setAvatarUploading] = useState(false)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarUploading(true)
    setProfileError(null)
    setProfileSuccess(false)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload profile picture.")
      }

      setProfileSuccess(true)
      await utils.user.getProfile.invalidate()
    } catch (err: any) {
      setProfileError(err.message || "Something went wrong uploading picture.")
    } finally {
      setAvatarUploading(false)
    }
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
  const [inviteRoleKey, setInviteRoleKey] = useState("member")
  const [invitePassword, setInvitePassword] = useState("")
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null)
  const [teamPanelTab, setTeamPanelTab] = useState<TeamPanelTab>("roles")

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [roleName, setRoleName] = useState("")
  const [roleDescription, setRoleDescription] = useState("")
  const [roleBaseRole, setRoleBaseRole] = useState<"admin" | "member" | "viewer">("member")
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [roleError, setRoleError] = useState<string | null>(null)
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null)
  const [previewMember, setPreviewMember] = useState<{
    name: string
    roleName: string
    permissions: string[]
  } | null>(null)

  const permissionByKey = new Map(TEAM_PERMISSION_CATALOG.map((item) => [item.key, item]))

  const customRoles = (teamRoles || []).filter((role) => !role.isSystem)
  const editableRole = customRoles.find((role) => role.id === selectedRoleId) || null

  useEffect(() => {
    if (teamRoles?.length && !teamRoles.some((role) => role.key === inviteRoleKey)) {
      setInviteRoleKey(teamRoles[0].key)
    }
  }, [teamRoles, inviteRoleKey])

  useEffect(() => {
    if (!editableRole) {
      return
    }
    setRoleName(editableRole.name)
    setRoleDescription(editableRole.description || "")
    setRoleBaseRole(editableRole.baseRole)
    setRolePermissions(editableRole.permissions)
  }, [editableRole?.id])

  const resetRoleComposer = () => {
    setSelectedRoleId(null)
    setRoleName("")
    setRoleDescription("")
    setRoleBaseRole("member")
    setRolePermissions([])
    setRoleError(null)
  }

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
        role: "member",
        roleKey: inviteRoleKey,
        password: invitePassword,
      })
    } catch (err) {}
  }

  const createRoleMutation = api.team.createRole.useMutation({
    onSuccess: () => {
      setRoleSuccess("Custom role created.")
      setTimeout(() => setRoleSuccess(null), 3000)
      resetRoleComposer()
      void utils.team.listRoles.invalidate()
    },
    onError: (err) => {
      setRoleError(err.message || "Failed to create role.")
    },
  })

  const updateRoleMutation = api.team.updateRole.useMutation({
    onSuccess: () => {
      setRoleSuccess("Role updated.")
      setTimeout(() => setRoleSuccess(null), 3000)
      void utils.team.listRoles.invalidate()
      void utils.team.listMembers.invalidate()
    },
    onError: (err) => {
      setRoleError(err.message || "Failed to update role.")
    },
  })

  const deleteRoleMutation = api.team.deleteRole.useMutation({
    onSuccess: () => {
      setRoleSuccess("Role deleted.")
      setTimeout(() => setRoleSuccess(null), 3000)
      resetRoleComposer()
      void utils.team.listRoles.invalidate()
      void utils.team.listMembers.invalidate()
    },
    onError: (err) => {
      setRoleError(err.message || "Failed to delete role.")
    },
  })

  const updateMemberRoleMutation = api.team.updateMemberRole.useMutation({
    onSuccess: () => {
      setUpdatingRoleUserId(null)
      void utils.team.listMembers.invalidate()
    },
    onError: (err) => {
      alert(err.message || "Failed to update member role.")
      setUpdatingRoleUserId(null)
    },
  })

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault()
    setRoleError(null)
    if (!roleName.trim()) {
      setRoleError("Role name is required.")
      return
    }
    if (rolePermissions.length === 0) {
      setRoleError("Choose at least one permission.")
      return
    }
    try {
      if (selectedRoleId) {
        await updateRoleMutation.mutateAsync({
          roleId: selectedRoleId,
          name: roleName,
          description: roleDescription,
          baseRole: roleBaseRole,
          permissions: rolePermissions,
        })
      } else {
        await createRoleMutation.mutateAsync({
          name: roleName,
          description: roleDescription,
          baseRole: roleBaseRole,
          permissions: rolePermissions,
        })
      }
    } catch (err) {}
  }

  const handleDeleteRole = async () => {
    if (!selectedRoleId) return
    const fallback = inviteRoleKey || "member"
    if (!confirm("Delete this custom role? Members currently using it will be reassigned.")) {
      return
    }
    try {
      await deleteRoleMutation.mutateAsync({
        roleId: selectedRoleId,
        replacementRoleKey: fallback,
      })
    } catch (err) {}
  }

  const togglePermission = (permissionKey: string) => {
    setRolePermissions((prev) =>
      prev.includes(permissionKey) ? prev.filter((item) => item !== permissionKey) : [...prev, permissionKey],
    )
  }

  const handleUpdateMemberRole = async (userId: string, roleKey: string) => {
    setUpdatingRoleUserId(userId)
    try {
      await updateMemberRoleMutation.mutateAsync({ userId, roleKey })
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
  const loadingInitial = loadingProfile || loadingOrg || loadingTeam || loadingRoles

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[500px] gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-[var(--dash-accent)]" />
        <p className="text-[13.5px] text-[var(--dash-ink-soft)] font-medium">Loading settings pane...</p>
      </div>
    )
  }

  const isAdmin = profile?.role === "admin"
  const visibleTeamTab: TeamPanelTab = isAdmin ? teamPanelTab : "directory"

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
                  <div className="relative shrink-0">
                    <label
                      htmlFor="avatar-input"
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-bold text-white shadow-md relative group shrink-0 overflow-hidden cursor-pointer ${
                        avatarUploading ? "opacity-75" : ""
                      }`}
                      style={{
                        background: profile?.image ? "none" : "linear-gradient(135deg,#8E80E5,#5C4DC1)",
                      }}
                    >
                      {profile?.image ? (
                        <img
                          src={profile.image}
                          alt={profile?.name || "Avatar"}
                          className="w-full h-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        (profile?.name || "SJ")
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200">
                        {avatarUploading ? (
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : (
                          <Camera className="w-5 h-5 text-white" />
                        )}
                        <span className="text-[8px] text-white/90 font-medium mt-0.5">Upload</span>
                      </div>

                      {avatarUploading && (
                        <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </label>
                    <input
                      id="avatar-input"
                      type="file"
                      accept="image/*"
                      disabled={avatarUploading}
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
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

                  <div className="pt-4 border-t dash-border-soft flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-6">
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
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => isAdmin && setTeamPanelTab("roles")}
                  className={`h-9 px-3.5 rounded-lg border text-[12.5px] font-semibold whitespace-nowrap transition ${
                    visibleTeamTab === "roles"
                      ? "border-[var(--dash-accent)] bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                      : "dash-border text-[var(--dash-ink-soft)] hover:text-[var(--dash-ink)] hover:bg-black/[0.02]"
                  } ${!isAdmin ? "opacity-45 cursor-not-allowed" : ""}`}
                >
                  Roles & Permissions Studio
                </button>
                <button
                  type="button"
                  onClick={() => isAdmin && setTeamPanelTab("add-user")}
                  className={`h-9 px-3.5 rounded-lg border text-[12.5px] font-semibold whitespace-nowrap transition ${
                    visibleTeamTab === "add-user"
                      ? "border-[var(--dash-accent)] bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                      : "dash-border text-[var(--dash-ink-soft)] hover:text-[var(--dash-ink)] hover:bg-black/[0.02]"
                  } ${!isAdmin ? "opacity-45 cursor-not-allowed" : ""}`}
                >
                  Add New Team Member
                </button>
                <button
                  type="button"
                  onClick={() => setTeamPanelTab("directory")}
                  className={`h-9 px-3.5 rounded-lg border text-[12.5px] font-semibold whitespace-nowrap transition ${
                    visibleTeamTab === "directory"
                      ? "border-[var(--dash-accent)] bg-[var(--dash-accent-wash)] text-[var(--dash-accent-deep)]"
                      : "dash-border text-[var(--dash-ink-soft)] hover:text-[var(--dash-ink)] hover:bg-black/[0.02]"
                  }`}
                >
                  Active Workspace Directory
                </button>
              </div>

              {visibleTeamTab === "roles" && (isAdmin ? (
                <DashCard title="Roles & Permissions Studio" icon={<Shield className="w-4 h-4" />}>
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                    <div className="xl:col-span-1">
                      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--dash-ink-faint)] mb-2">Role Library</div>
                      <div className="flex flex-col gap-2">
                        {(teamRoles || []).map((role) => {
                          const selected = selectedRoleId === role.id
                          return (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => {
                                if (role.isSystem) return
                                setSelectedRoleId(role.id)
                                setRoleError(null)
                              }}
                              className={`text-left rounded-lg border px-3 py-2.5 transition ${
                                selected
                                  ? "border-[var(--dash-accent)] bg-[var(--dash-accent-wash)]"
                                  : "dash-border hover:border-[var(--dash-accent)]/40 hover:bg-black/[0.02]"
                              } ${role.isSystem ? "cursor-default" : "cursor-pointer"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[13px] font-semibold text-[var(--dash-ink)] truncate">{role.name}</span>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                  role.isSystem
                                    ? "text-slate-600 bg-slate-50 border-slate-200"
                                    : "text-emerald-700 bg-emerald-50 border-emerald-100"
                                }`}>
                                  {role.isSystem ? "System" : "Custom"}
                                </span>
                              </div>
                              <div className="text-[11px] text-[var(--dash-ink-faint)] mt-1">
                                {role.baseRole} baseline · {role.permissions.length} permissions
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <form onSubmit={handleSaveRole} className="xl:col-span-2 space-y-4">
                      {roleError && (
                        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 text-[12.5px]">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{roleError}</span>
                        </div>
                      )}
                      {roleSuccess && (
                        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-[12.5px]">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{roleSuccess}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-[15px] font-semibold text-[var(--dash-ink)]">
                            {selectedRoleId ? "Edit custom role" : "Create custom role"}
                          </h3>
                          <p className="text-[12px] text-[var(--dash-ink-faint)] mt-0.5">
                            Build least-privilege access profiles for specific support responsibilities.
                          </p>
                        </div>
                        {selectedRoleId && (
                          <button
                            type="button"
                            onClick={resetRoleComposer}
                            className="h-8 px-3 rounded-md border dash-border text-[12px] text-[var(--dash-ink-soft)] hover:text-[var(--dash-ink)]"
                          >
                            New role
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[12px] font-bold text-[var(--dash-ink-soft)]">Role Name</label>
                          <input
                            type="text"
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            placeholder="e.g. QA Escalation Lead"
                            className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[12px] font-bold text-[var(--dash-ink-soft)]">Base Access Tier</label>
                          <select
                            value={roleBaseRole}
                            onChange={(e) => setRoleBaseRole(e.target.value as "admin" | "member" | "viewer")}
                            className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition cursor-pointer"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="member">Member</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-[var(--dash-ink-soft)]">Role Description</label>
                        <input
                          type="text"
                          value={roleDescription}
                          onChange={(e) => setRoleDescription(e.target.value)}
                          placeholder="Describe when this role should be used."
                          className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition"
                        />
                      </div>

                      <div>
                        <div className="text-[12px] font-bold text-[var(--dash-ink-soft)] mb-2">Permission Matrix</div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                          {TEAM_PERMISSION_CATALOG.map((perm) => {
                            const active = rolePermissions.includes(perm.key)
                            return (
                              <button
                                key={perm.key}
                                type="button"
                                onClick={() => togglePermission(perm.key)}
                                className={`text-left rounded-lg border p-3 transition ${
                                  active
                                    ? "border-[var(--dash-accent)] bg-[var(--dash-accent-wash)]"
                                    : "dash-border hover:bg-black/[0.02]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[12.5px] font-semibold text-[var(--dash-ink)]">{perm.label}</span>
                                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                    active
                                      ? "text-[var(--dash-accent-deep)] border-[var(--dash-accent)]/30"
                                      : "text-[var(--dash-ink-faint)] border-black/[0.08]"
                                  }`}>
                                    {perm.category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[var(--dash-ink-faint)] mt-1">{perm.description}</p>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="pt-3 border-t dash-border-soft flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] text-[var(--dash-ink-faint)]">
                          {rolePermissions.length} permission{rolePermissions.length === 1 ? "" : "s"} selected
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedRoleId && (
                            <button
                              type="button"
                              onClick={handleDeleteRole}
                              disabled={deleteRoleMutation.isPending}
                              className="h-9 px-3.5 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-[12.5px] font-semibold disabled:opacity-60"
                            >
                              {deleteRoleMutation.isPending ? "Deleting..." : "Delete Role"}
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                            className="h-9 px-4.5 rounded-lg bg-[var(--dash-accent)] hover:bg-[var(--dash-accent-deep)] text-white text-[13px] font-semibold transition flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {createRoleMutation.isPending || updateRoleMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : selectedRoleId ? (
                              <Pencil className="w-4 h-4" />
                            ) : (
                              <UserPlus className="w-4 h-4" />
                            )}
                            <span>{selectedRoleId ? "Save Role" : "Create Role"}</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </DashCard>
              ) : (
                <DashCard title="Team Access" icon={<Shield className="w-4 h-4" />}>
                  <div className="p-4 rounded-xl bg-orange-50/50 border border-orange-100 flex gap-3 text-orange-900 text-[13px] leading-[1.6]">
                    <Shield className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      You can view team assignments and active permissions. Administrator access is required to create roles,
                      invite users, or change seat permissions.
                    </div>
                  </div>
                </DashCard>
              ))}

              {visibleTeamTab === "add-user" && (isAdmin ? (
                <DashCard title="Add New Team Member" icon={<UserPlus className="w-4 h-4" />}>
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
                        <span>New user created and assigned to the selected role.</span>
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
                          Access Role
                        </label>
                        <select
                          id="i-role"
                          value={inviteRoleKey}
                          onChange={(e) => setInviteRoleKey(e.target.value)}
                          className="h-9.5 px-3 rounded-lg border dash-border bg-transparent text-[13px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition cursor-pointer"
                        >
                          {(teamRoles || []).map((role) => (
                            <option key={role.id} value={role.key}>
                              {role.name} ({role.baseRole})
                            </option>
                          ))}
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
                        {addMemberMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        <span>Add User</span>
                      </button>
                    </div>
                  </form>
                </DashCard>
              ) : (
                <DashCard title="Team Access" icon={<Shield className="w-4 h-4" />}>
                  <div className="p-4 rounded-xl bg-orange-50/50 border border-orange-100 flex gap-3 text-orange-900 text-[13px] leading-[1.6]">
                    <Shield className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      Administrator access is required to add new team members.
                    </div>
                  </div>
                </DashCard>
              ))}

              {visibleTeamTab === "directory" && (
              <DashCard title="Active Workspace Directory" icon={<UsersIcon className="w-4 h-4" />} padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b dash-border-soft bg-[var(--dash-bg-deep)]/40 text-[10.5px] font-bold uppercase tracking-[0.11em] text-[var(--dash-ink-faint)]">
                        <th className="px-5 py-3">Agent</th>
                        <th className="px-5 py-3">Role & Permissions</th>
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
                              <div className="space-y-1.5">
                                {isAdmin && !isSelf ? (
                                  <select
                                    value={member.roleKey || member.role}
                                    onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                                    disabled={updatingRoleUserId === member.id}
                                    className="h-8.5 min-w-[190px] px-2.5 rounded-lg border dash-border bg-transparent text-[12px] text-[var(--dash-ink)] focus:border-[var(--dash-accent)] focus:ring-1 focus:ring-[var(--dash-accent)] outline-none transition cursor-pointer"
                                  >
                                    {(teamRoles || []).map((role) => (
                                      <option key={role.id} value={role.key}>
                                        {role.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={`inline-block text-[11px] font-semibold uppercase tracking-wider rounded px-2 py-0.5 border ${
                                    member.role === "admin"
                                      ? "text-purple-700 bg-purple-50 border-purple-100"
                                      : member.role === "member"
                                      ? "text-blue-700 bg-blue-50 border-blue-100"
                                      : "text-gray-600 bg-gray-50 border-gray-100"
                                  }`}>
                                    {member.roleName || member.role}
                                  </span>
                                )}
                                <div className="flex flex-wrap items-center gap-1">
                                  {(member.permissions || []).slice(0, 3).map((permission: string) => (
                                    <span
                                      key={permission}
                                      className="text-[10px] px-1.5 py-0.5 rounded border border-black/[0.08] text-[var(--dash-ink-faint)]"
                                    >
                                      {permission}
                                    </span>
                                  ))}
                                  {(member.permissions || []).length > 3 && (
                                    <span className="text-[10px] text-[var(--dash-ink-faint)]">+{member.permissions.length - 3} more</span>
                                  )}
                                  {(member.permissions || []).length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewMember({
                                          name: member.name || member.email,
                                          roleName: member.roleName || member.role,
                                          permissions: member.permissions,
                                        })
                                      }
                                      className="text-[10px] font-semibold text-[var(--dash-accent-deep)] hover:underline"
                                    >
                                      View all
                                    </button>
                                  )}
                                </div>
                              </div>
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
                                <div className="inline-flex items-center gap-1">
                                  {updatingRoleUserId === member.id && <Loader2 className="w-4 h-4 animate-spin text-[var(--dash-accent)]" />}
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
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </DashCard>
              )}

              {previewMember && (
                <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
                  <div className="w-full max-w-xl rounded-2xl dash-bg-card border dash-border shadow-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b dash-border-soft flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-[15px] font-semibold text-[var(--dash-ink)]">Effective Permissions</h3>
                        <p className="text-[12px] text-[var(--dash-ink-faint)] mt-0.5">
                          {previewMember.name} · {previewMember.roleName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewMember(null)}
                        className="h-8 px-3 rounded-md border dash-border text-[12px] text-[var(--dash-ink-soft)] hover:text-[var(--dash-ink)]"
                      >
                        Close
                      </button>
                    </div>

                    <div className="p-5 max-h-[70vh] overflow-y-auto space-y-2">
                      {previewMember.permissions.map((permissionKey) => {
                        const meta = permissionByKey.get(permissionKey as any)
                        return (
                          <div key={permissionKey} className="rounded-lg border dash-border px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12.5px] font-semibold text-[var(--dash-ink)]">
                                {meta?.label || permissionKey}
                              </p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded border border-black/[0.08] text-[var(--dash-ink-faint)]">
                                {meta?.category || "Custom"}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--dash-ink-faint)] mt-1">
                              {meta?.description || permissionKey}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
