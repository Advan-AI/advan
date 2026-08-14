import "@/lib/polyfills/crypto"
import ChatWidgetFrame from "@/app/chat-widget-frame/page"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Live Chat Support - Advan AI",
  description: "Connect with support directly via our live AI chat assistant.",
}

interface DirectChatPageProps {
  params: Promise<{
    widgetKey: string
  }>
}

export default async function DirectChatPage({ params }: DirectChatPageProps) {
  const { widgetKey } = await params

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#0b0f0d] text-zinc-100 flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 font-sans">
      {/* Container card */}
      <div className="w-full max-w-xl h-[100dvh] sm:h-[720px] sm:max-h-[90vh] bg-[#121815] sm:rounded-2xl sm:border sm:border-zinc-800/80 sm:shadow-2xl overflow-hidden flex flex-col relative">
        <ChatWidgetFrame initialKey={widgetKey} />
      </div>
      <div className="hidden sm:flex items-center gap-2 mt-3 text-[11.5px] text-zinc-500 font-medium">
        <span>Powered by Advan AI Support Infrastructure</span>
      </div>
    </div>
  )
}
