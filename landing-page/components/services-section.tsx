import {
  Home,
  Car,
  Briefcase,
  Users,
  BookOpen,
  Radio,
  Headphones,
  Mic,
} from "lucide-react"

const services = [
  { icon: Home, name: "LightHouse", category: "Housing", color: "vibrant-lime" },
  { icon: Car, name: "TrustTransport", category: "Transportation", color: "vibrant-yellow" },
  { icon: Briefcase, name: "Workforce Recruiter", category: "Job Search", color: "vibrant-coral" },
  { icon: Users, name: "SupportMatch", category: "Accountability", color: "vibrant-lavender" },
  { icon: BookOpen, name: "Directory", category: "Skill Sharing", color: "vibrant-mint" },
  { icon: Radio, name: "SocketRelay", category: "Mutual Aid", color: "vibrant-lime" },
  { icon: Headphones, name: "GentlePulse", category: "Wellness", color: "vibrant-yellow" },
  { icon: Mic, name: "Chyme", category: "Social Audio", color: "vibrant-coral" },
]

const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  "vibrant-lime": {
    bg: "bg-vibrant-lime/10",
    text: "text-vibrant-lime",
    border: "border-vibrant-lime/20",
    iconBg: "bg-vibrant-lime/20",
  },
  "vibrant-yellow": {
    bg: "bg-vibrant-yellow/10",
    text: "text-vibrant-yellow",
    border: "border-vibrant-yellow/20",
    iconBg: "bg-vibrant-yellow/20",
  },
  "vibrant-coral": {
    bg: "bg-vibrant-coral/10",
    text: "text-vibrant-coral",
    border: "border-vibrant-coral/20",
    iconBg: "bg-vibrant-coral/20",
  },
  "vibrant-lavender": {
    bg: "bg-vibrant-lavender/10",
    text: "text-vibrant-lavender",
    border: "border-vibrant-lavender/20",
    iconBg: "bg-vibrant-lavender/20",
  },
  "vibrant-mint": {
    bg: "bg-vibrant-mint/10",
    text: "text-vibrant-mint",
    border: "border-vibrant-mint/20",
    iconBg: "bg-vibrant-mint/20",
  },
}

export function ServicesSection() {
  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-secondary/50" aria-labelledby="services-heading">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14 md:mb-16">
          <span className="inline-block font-[var(--font-inter)] text-xs sm:text-sm uppercase tracking-widest text-vibrant-yellow mb-3">
            Your all-in-one platform
          </span>
          <h2
            id="services-heading"
            className="font-[var(--font-bangers)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-wide text-foreground mb-4"
          >
            8+ MINI-APPS
          </h2>
          <p className="font-[var(--font-inter)] text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base md:text-lg">
            Operating like WeChat's mini-app ecosystem. Access multiple essential services through a single secure account.
          </p>
        </div>

        {/* Services grid - vibrant colored cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-5" role="list" aria-label="Available services">
          {services.map((service) => {
            const colors = colorMap[service.color]
            return (
              <div
                key={service.name}
                className={`${colors.bg} ${colors.border} border rounded-2xl p-4 sm:p-5 md:p-6 transition-all hover:scale-[1.03] group cursor-default`}
                role="listitem"
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`${colors.iconBg} w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-3`} aria-hidden="true">
                    <service.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text}`} />
                  </div>
                  <span className={`font-[var(--font-bangers)] text-sm sm:text-base md:text-lg ${colors.text} mb-1`}>
                    {service.name}
                  </span>
                  <span className="font-[var(--font-inter)] text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">
                    {service.category}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Scale indicator */}
        <div className="mt-10 sm:mt-12 text-center">
          <p className="font-[var(--font-inter)] text-sm text-muted-foreground">
            <span className="text-vibrant-lime font-semibold">$210B</span> in services at full scale -- that's{" "}
            <span className="text-vibrant-yellow font-semibold">$42,000</span> per person, per year.
          </p>
        </div>
      </div>
    </section>
  )
}
