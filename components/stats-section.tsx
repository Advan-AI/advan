const stats = [
  { value: "20+", label: "days saved on daily builds", company: "Enterprise clients" },
  { value: "98%", label: "faster time to market", company: "Tech startups" },
  { value: "300%", label: "increase in efficiency", company: "Digital teams" },
  { value: "6x", label: "faster to build + deploy", company: "Growing businesses" },
]

export function StatsSection() {
  return (
    <section className="py-16 border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:divide-x lg:divide-border">
          {stats.map((stat, index) => (
            <div key={index} className="text-center lg:text-left lg:pl-8 first:lg:pl-0">
              <p className="text-3xl md:text-4xl font-semibold text-foreground">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-xs text-muted-foreground/70">{stat.company}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
