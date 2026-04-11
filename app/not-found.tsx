import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F7F4]">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-[#E85D04]" />
            <h1 className="text-2xl font-bold text-[#1a1a1a]">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-[#666]">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>

          <Button asChild className="mt-6 bg-[#E85D04] hover:bg-[#D45A04]">
            <Link href="/">Return Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
