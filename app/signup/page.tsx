import { redirect } from "next/navigation"

/**
 * Sign-up disabled for the public demo deployment — dashboard is open
 * without login (see proxy.ts). This route now just forwards there instead
 * of showing a form.
 */
export default function SignUpPage() {
  redirect("/dashboard")
}
