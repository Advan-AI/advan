import { Button } from "@/components/ui/button"

export function CTASection() {
  return (
    <section id="contact" className="py-24 lg:py-32 bg-secondary">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Join us</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-6 text-balance">
              Want to be part of the collective?
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-4">
              We are the tech artisans helping countless organizations succeed in their 
              most important and strategic transformations.
            </p>
            <p className="text-base text-muted-foreground leading-relaxed mb-8">
              In our collective, there is always room for more people with that delicious 
              combination of curiosity and infectious energy.
            </p>
            <Button 
              size="lg" 
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Join the collective
            </Button>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
              <div className="text-center">
                <p className="text-6xl md:text-8xl font-bold text-foreground/10">+</p>
                <p className="text-sm text-muted-foreground mt-2">Your opportunity awaits</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
