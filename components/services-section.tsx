import { ArrowRight, Sparkles, Shield, BarChart3, Users, Code, Zap } from "lucide-react"
import Link from "next/link"

const services = [
  {
    icon: Sparkles,
    title: "AI & Automation",
    description:
      "Building conversational AI strategies, chatbots, voicebots, and language AI solutions that drive massive value creation.",
  },
  {
    icon: Shield,
    title: "Quality Assurance",
    description:
      "We ensure quality from business ideation to IT operations and end-user value delivery across all aspects of testing and DevOps.",
  },
  {
    icon: Code,
    title: "Digital Transformation",
    description:
      "As your next-generation partner, we stand out by our ability to deliver projects with impact using cutting-edge technology.",
  },
  {
    icon: BarChart3,
    title: "Data & Analytics",
    description:
      "We unlock the immense potential of data, AI, and analytics, ensuring your organization is fit for the digital future.",
  },
  {
    icon: Users,
    title: "Team Augmentation",
    description:
      "Our expert consultants integrate seamlessly with your existing teams to accelerate delivery and share knowledge.",
  },
  {
    icon: Zap,
    title: "Cloud Solutions",
    description:
      "Modern cloud architecture and migration services to help your business scale efficiently and securely.",
  },
]

export function ServicesSection() {
  return (
    <section id="services" className="py-24 lg:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-16">
          <p className="text-sm font-medium text-muted-foreground mb-3">What we do</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground max-w-3xl text-balance">
            Our services span every stage of the transformation process.{" "}
            <span className="text-muted-foreground">Explore how we help businesses transform.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => (
            <div
              key={service.title}
              className="group p-6 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
            >
              <div className="mb-4">
                <service.icon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">{service.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {service.description}
              </p>
              <Link
                href="#"
                className="inline-flex items-center text-sm font-medium text-foreground hover:text-accent transition-colors"
              >
                Read more
                <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
