import { Gift, DollarSign, GraduationCap, BarChart3, Users, ShieldCheck } from "lucide-react"

const benefits = [
  {
    icon: Gift,
    title: "FIRST ACCESS",
    description: "First access to the marketplace and ServiceCredits ledger when we launch.",
    color: "vibrant-lime",
    bgClass: "bg-vibrant-lime/10 border-vibrant-lime/20",
    iconBg: "bg-vibrant-lime/20",
    textColor: "text-vibrant-lime",
  },
  {
    icon: GraduationCap,
    title: "PRIORITY TRAINING",
    description: "Priority invites to training cohorts and certification pipelines.",
    color: "vibrant-yellow",
    bgClass: "bg-vibrant-yellow/10 border-vibrant-yellow/20",
    iconBg: "bg-vibrant-yellow/20",
    textColor: "text-vibrant-yellow",
  },
  {
    icon: Users,
    title: "LOCAL HUBS",
    description: "Early access to local hubs, pooled services (health/education), and subscription supports.",
    color: "vibrant-lavender",
    bgClass: "bg-vibrant-lavender/10 border-vibrant-lavender/20",
    iconBg: "bg-vibrant-lavender/20",
    textColor: "text-vibrant-lavender",
  },
  {
    icon: BarChart3,
    title: "GDP TRACKER",
    description: "Transparent public GDP tracker so you can see how our community is performing.",
    color: "vibrant-mint",
    bgClass: "bg-vibrant-mint/10 border-vibrant-mint/20",
    iconBg: "bg-vibrant-mint/20",
    textColor: "text-vibrant-mint",
  },
  {
    icon: DollarSign,
    title: "FIRST EARNINGS",
    description: "Early waitlist members get priority for initial paid gigs, subscriptions, and matching.",
    color: "vibrant-coral",
    bgClass: "bg-vibrant-coral/10 border-vibrant-coral/20",
    iconBg: "bg-vibrant-coral/20",
    textColor: "text-vibrant-coral",
  },
  {
    icon: ShieldCheck,
    title: "GOVERNANCE",
    description: "Early members get influence over governance, pricing standards, and community protections.",
    color: "vibrant-lime",
    bgClass: "bg-vibrant-lime/10 border-vibrant-lime/20",
    iconBg: "bg-vibrant-lime/20",
    textColor: "text-vibrant-lime",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-24" aria-labelledby="features-heading">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-10 sm:mb-14 md:mb-16">
          <span className="inline-block font-[var(--font-inter)] text-xs sm:text-sm uppercase tracking-widest text-vibrant-lime mb-3">
            What you get by joining
          </span>
          <h2
            id="features-heading"
            className="font-[var(--font-bangers)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-wide text-foreground mb-4"
          >
            EARLY ACCESS BENEFITS
          </h2>
          <p className="font-[var(--font-inter)] text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base md:text-lg leading-relaxed">
            The first wave of members capture the highest-value onboarding slots. Here's what's waiting for you.
          </p>
        </div>

        {/* Benefits grid - vibrant color block cards like the music app */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6" role="list">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className={`${benefit.bgClass} border rounded-2xl p-5 sm:p-6 md:p-7 transition-all hover:scale-[1.02] group`}
              role="listitem"
            >
              <div className={`${benefit.iconBg} w-12 h-12 rounded-xl flex items-center justify-center mb-4`} aria-hidden="true">
                <benefit.icon className={`w-6 h-6 ${benefit.textColor}`} />
              </div>
              <h3 className={`font-[var(--font-bangers)] text-xl sm:text-2xl mb-2 ${benefit.textColor}`}>
                {benefit.title}
              </h3>
              <p className="font-[var(--font-inter)] text-muted-foreground text-xs sm:text-sm leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        {/* FOMO urgency bar */}
        <div className="mt-10 sm:mt-12 bg-secondary rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-vibrant-coral animate-pulse-glow" />
            <span className="font-[var(--font-inter)] text-sm sm:text-base text-foreground font-medium">
              Limited pilot capacity -- once cohorts fill, waits lengthen.
            </span>
          </div>
          <a href="#waitlist-form">
            <span className="font-[var(--font-bangers)] text-sm sm:text-base text-vibrant-lime hover:text-vibrant-yellow transition-colors cursor-pointer whitespace-nowrap">
              DON'T MISS OUT →
            </span>
          </a>
        </div>
      </div>
    </section>
  )
}
