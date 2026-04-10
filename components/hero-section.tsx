import Image from "next/image"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-end">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/diverse-team.jpg"
          alt="Diverse team collaborating in modern office"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-32 lg:px-8 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 items-end">
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-tight text-balance">
              Where innovation meets{" "}
              <span className="text-muted-foreground">human connection.</span>
            </h1>
          </div>
          <div className="lg:pl-8">
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              We are a collective of passionate professionals bound together by deep expertise, 
              a human-centric mindset, and a passion for using technology and collaboration 
              to drive business transformation.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
