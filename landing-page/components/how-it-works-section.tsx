import { ClipboardCheck, Users, Coins, TrendingUp } from "lucide-react"

const steps = [
  {
    number: "01",
    icon: ClipboardCheck,
    title: "JOIN THE WAITLIST",
    description: "Verify identity and skills later during onboarding. Just your email to start.",
    color: "vibrant-lime",
    bgClass: "bg-vibrant-lime/10 border-vibrant-lime/20",
    iconBg: "bg-vibrant-lime/20",
    textColor: "text-vibrant-lime",
    numberBg: "bg-vibrant-lime",
  },
  {
    number: "02",
    icon: Users,
    title: "GET INVITED",
    description: "Get invited to training cohorts and local hubs based on need and fit.",
    color: "vibrant-yellow",
    bgClass: "bg-vibrant-yellow/10 border-vibrant-yellow/20",
    iconBg: "bg-vibrant-yellow/20",
    textColor: "text-vibrant-yellow",
    numberBg: "bg-vibrant-yellow",
  },
  {
    number: "03",
    icon: Coins,
    title: "EARN SERVICECREDITS",
    description: "Earn ServiceCredits for work, subscriptions, and pooled services.",
    color: "vibrant-coral",
    bgClass: "bg-vibrant-coral/10 border-vibrant-coral/20",
    iconBg: "bg-vibrant-coral/20",
    textColor: "text-vibrant-coral",
    numberBg: "bg-vibrant-coral",
  },
  {
    number: "04",
    icon: TrendingUp,
    title: "BUILD INCOME",
    description: "Convert skills to reputation to recurring income via marketplace matches and contracts.",
    color: "vibrant-lavender",
    bgClass: "bg-vibrant-lavender/10 border-vibrant-lavender/20",
    iconBg: "bg-vibrant-lavender/20",
    textColor: "text-vibrant-lavender",
    numberBg: "bg-vibrant-lavender",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-12 sm:py-16 md:py-20 lg:py-24 bg-secondary/50" aria-labelledby="how-it-works-heading">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14 md:mb-16">
          <span className="inline-block font-[var(--font-inter)] text-xs sm:text-sm uppercase tracking-widest text-vibrant-lavender mb-3">
            Simple process
          </span>
          <h2
            id="how-it-works-heading"
            className="font-[var(--font-bangers)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-wide text-foreground mb-4"
          >
            HOW IT WORKS
          </h2>
          <p className="font-[var(--font-inter)] text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base md:text-lg">
            Four simple steps from sign-up to self-sustaining income.
          </p>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line for desktop */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-full w-full h-[2px] bg-border z-0 -translate-x-1/2" aria-hidden="true" />
              )}

              <div className={`${step.bgClass} border rounded-2xl p-5 sm:p-6 relative z-10`}>
                {/* Step number */}
                <div className={`${step.numberBg} w-8 h-8 rounded-lg flex items-center justify-center mb-4`}>
                  <span className="font-[var(--font-bangers)] text-sm text-[#0a0a0a]">{step.number}</span>
                </div>

                <div className={`${step.iconBg} w-12 h-12 rounded-xl flex items-center justify-center mb-4`} aria-hidden="true">
                  <step.icon className={`w-6 h-6 ${step.textColor}`} />
                </div>

                <h3 className={`font-[var(--font-bangers)] text-lg sm:text-xl mb-2 ${step.textColor}`}>
                  {step.title}
                </h3>
                <p className="font-[var(--font-inter)] text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
