import Link from "next/link"
import { AlertCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-24">
      <div className="relative w-full max-w-md rounded-3xl glass-strong p-10 text-center">
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-[#6B5CD6]/25 to-transparent -z-10 blur-sm" aria-hidden />
        <div className="w-12 h-12 mx-auto mb-5 rounded-2xl bg-[#ECE9FB] flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-[#4E3FB6]" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Page not found</h1>
        <p className="text-sm text-foreground/60 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button
          asChild
          className="mt-7 group rounded-full bg-[#171a17] text-white hover:bg-[#29332f] h-10 px-5"
        >
          <Link href="/">
            <ArrowLeft className="mr-1.5 w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back home
          </Link>
        </Button>
      </div>
    </div>
  )
}
