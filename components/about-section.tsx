import { Lightbulb, Heart, Target } from "lucide-react"

const values = [
  {
    icon: Lightbulb,
    title: "Innovation First",
    description: "We embrace cutting-edge technology and creative solutions to solve complex business challenges.",
  },
  {
    icon: Heart,
    title: "Human-Centric",
    description: "People are at the heart of everything we do. We build solutions that empower teams and delight users.",
  },
  {
    icon: Target,
    title: "Results Driven",
    description: "We measure success by the tangible impact we create for our clients and their customers.",
  },
]

export function AboutSection() {
  return (
    <section id="about" className="py-24 lg:py-32 bg-card">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">About us</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-6 text-balance">
              Faster iteration. More innovation.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-6">
              The platform for rapid progress. Let your team focus on shipping features 
              instead of managing infrastructure with automated CI/CD, built-in testing, 
              and integrated collaboration.
            </p>
            <p className="text-base text-muted-foreground leading-relaxed">
              Make teamwork seamless. Tools for your team and stakeholders to share 
              feedback and iterate faster than ever before.
            </p>
          </div>

          <div className="space-y-8">
            {values.map((value) => (
              <div key={value.title} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                    <value.icon className="h-6 w-6 text-foreground" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
