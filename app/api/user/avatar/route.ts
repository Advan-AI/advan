import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { uploadAvatar, getAvatarUrl } from "@/lib/storage/s3-client"

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Basic type validation
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 })
    }

    // Basic size validation (5MB limit)
    const limit = 5 * 1024 * 1024
    if (file.size > limit) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to S3
    const s3Key = await uploadAvatar(session.user.id, buffer, file.type)

    // Update the database
    await db
      .update(users)
      .set({ image: s3Key })
      .where(eq(users.id, session.user.id))

    // Generate a fresh signed URL for immediate preview
    const signedUrl = await getAvatarUrl(s3Key)

    return NextResponse.json({
      success: true,
      imageUrl: signedUrl,
      s3Key,
    })
  } catch (error: any) {
    console.error("Avatar upload error:", error)
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 })
  }
}
