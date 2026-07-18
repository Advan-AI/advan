import { create } from "zustand"

export interface NotificationItem {
  id: string
  conversationId: string
  channel: "email" | "chat" | "voice" | "slack" | "portal"
  customerName: string
  customerEmail: string | null
  content: string
  timestamp: string
  read: boolean
}

interface NotificationsState {
  notifications: NotificationItem[]
  activeToast: NotificationItem | null
  unreadCount: number
  addNotification: (d: {
    conversationId: string
    channel?: "email" | "chat" | "voice" | "slack" | "portal"
    content: string
    customerName?: string
    customerEmail?: string | null
  }) => void
  markAsRead: (conversationId: string) => void
  dismissToast: () => void
  clearAll: () => void
}

let titleFlashInterval: ReturnType<typeof setInterval> | null = null
let originalTitle = "Advan"

function flashBrowserTab(titleText: string) {
  if (typeof window === "undefined") return
  if (titleFlashInterval) clearInterval(titleFlashInterval)

  // Grab the baseline title only if we are not already flashing
  if (document.title && !document.title.includes("New Message")) {
    originalTitle = document.title
  }

  let isOriginal = true
  titleFlashInterval = setInterval(() => {
    document.title = isOriginal ? titleText : originalTitle
    isOriginal = !isOriginal
  }, 1000)
}

export function stopFlashingBrowserTab() {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval)
    titleFlashInterval = null
  }
  if (typeof document !== "undefined" && originalTitle) {
    document.title = originalTitle
  }
}

export function playSocialAlertSound() {
  if (typeof window === "undefined") return
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime

    // Resume if suspended (browser security autoplays fallback)
    if (ctx.state === "suspended") {
      void ctx.resume()
    }

    // Crisp bubble-pop sound start
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = "sine"
    osc1.frequency.setValueAtTime(320, now)
    osc1.frequency.exponentialRampToValueAtTime(640, now + 0.08)

    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.01)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.12)

    // Sparkling ping release
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = "sine"
    osc2.frequency.setValueAtTime(880, now + 0.05)
    osc2.frequency.exponentialRampToValueAtTime(1100, now + 0.12)

    gain2.gain.setValueAtTime(0, now + 0.05)
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.07)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.05)
    osc2.stop(now + 0.3)
  } catch (e) {
    console.error("Audio synth failed:", e)
  }
}

export const useNotifications = create<NotificationsState>((set) => ({
  notifications: [],
  activeToast: null,
  unreadCount: 0,

  addNotification: (d) => {
    set((s) => {
      // Check if we already have a matching unread notification to update
      const existingIdx = s.notifications.findIndex((n) => n.conversationId === d.conversationId)
      const newItem: NotificationItem = {
        id: Math.random().toString(36).substring(7),
        conversationId: d.conversationId,
        channel: d.channel ?? "chat",
        customerName: d.customerName || (d.channel === "email" ? "Email Customer" : "Web Visitor"),
        customerEmail: d.customerEmail || null,
        content: d.content,
        timestamp: new Date().toISOString(),
        read: false,
      }

      let updatedList = [...s.notifications]
      if (existingIdx > -1) {
        // Remove old and put the new one at the top of the stack (Facebook style)
        updatedList.splice(existingIdx, 1)
      }
      updatedList = [newItem, ...updatedList]

      // Play alert chime and flash browser tab
      playSocialAlertSound()
      flashBrowserTab(`[${newItem.channel === "email" ? "Email" : "Chat"}] New message from ${newItem.customerName}!`)

      return {
        notifications: updatedList,
        activeToast: newItem,
        unreadCount: updatedList.filter((n) => !n.read).length,
      }
    })
  },

  markAsRead: (conversationId) => {
    stopFlashingBrowserTab()
    set((s) => {
      const updatedList = s.notifications.map((n) =>
        n.conversationId === conversationId ? { ...n, read: true } : n
      )
      
      const nextToast = s.activeToast?.conversationId === conversationId ? null : s.activeToast

      return {
        notifications: updatedList,
        activeToast: nextToast,
        unreadCount: updatedList.filter((n) => !n.read).length,
      }
    })
  },

  dismissToast: () => {
    set({ activeToast: null })
  },

  clearAll: () => {
    stopFlashingBrowserTab()
    set({ notifications: [], activeToast: null, unreadCount: 0 })
  },
}))
