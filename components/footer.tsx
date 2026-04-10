import Link from "next/link"

const footerLinks = {
  services: [
    { name: "AI & Automation", href: "#" },
    { name: "Quality Assurance", href: "#" },
    { name: "Digital Transformation", href: "#" },
    { name: "Data & Analytics", href: "#" },
    { name: "Team Augmentation", href: "#" },
    { name: "Cloud Solutions", href: "#" },
  ],
  company: [
    { name: "About us", href: "#about" },
    { name: "Team", href: "#team" },
    { name: "Careers", href: "#" },
    { name: "News", href: "#" },
  ],
  legal: [
    { name: "Privacy Policy", href: "#" },
    { name: "Terms of Service", href: "#" },
  ],
}

export function Footer() {
  return (
    <footer className="bg-background border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-xl font-semibold tracking-tight text-foreground">
              .collective
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Where innovation meets human connection.
            </p>
            <div className="mt-6">
              <p className="text-sm text-muted-foreground">hello@collective.com</p>
              <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Services</h3>
            <ul className="space-y-3">
              {footerLinks.services.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} .collective. All rights reserved.
          </p>
          <div className="text-6xl md:text-7xl font-bold text-foreground/5 select-none">
            .collective
          </div>
        </div>
      </div>
    </footer>
  )
}
