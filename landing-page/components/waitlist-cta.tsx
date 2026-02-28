"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Lock, Shield, Eye, Zap, CheckCircle2, ArrowRight } from "lucide-react"

export function WaitlistCTA() {
  const [formState, setFormState] = useState<"idle" | "submitting" | "success">("idle")
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    skills: "",
    country: "",
    state: "",
    city: "",
    quoraUrl: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormState("submitting")
    // Simulate submission
    setTimeout(() => {
      setFormState("success")
    }, 1500)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <section id="waitlist-form" className="py-12 sm:py-16 md:py-20 lg:py-24 relative overflow-hidden" aria-label="Join the waitlist">
      {/* Background accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-vibrant-lime/5 blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Why sign up today - FOMO block */}
          <div className="bg-vibrant-coral/10 border border-vibrant-coral/20 rounded-2xl p-6 sm:p-8 mb-8 sm:mb-10">
            <h3 className="font-[var(--font-bangers)] text-xl sm:text-2xl md:text-3xl text-vibrant-coral mb-3">
              WHY SIGN UP TODAY?
            </h3>
            <p className="font-[var(--font-inter)] text-sm sm:text-base text-muted-foreground leading-relaxed mb-4">
              Early members capture the highest-value onboarding slots, first earning opportunities, and influence over
              governance and pricing. Limited pilot capacity -- once cohorts fill, waits lengthen.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-vibrant-coral animate-pulse" />
              <span className="font-[var(--font-inter)] text-xs sm:text-sm text-vibrant-coral font-medium">
                Don't miss the chance to be among the founders shaping pay rates, certification standards, and community protections.
              </span>
            </div>
          </div>

          {/* Main form card */}
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 md:p-10 lg:p-12 relative">
            {/* Header */}
            <div className="text-center mb-8 sm:mb-10">
              <span className="inline-block font-[var(--font-inter)] text-xs sm:text-sm uppercase tracking-widest text-vibrant-lime mb-3">
                Secure your spot
              </span>
              <h2 className="font-[var(--font-bangers)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-foreground mb-3 leading-tight">
                JOIN THE WAITLIST
              </h2>
              <p className="font-[var(--font-inter)] text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
                Secure an early invite and priority access to training, gigs, and ServiceCredits.
              </p>
            </div>

            {formState === "success" ? (
              <div className="text-center py-8 sm:py-12">
                <div className="bg-vibrant-lime/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-vibrant-lime" />
                </div>
                <h3 className="font-[var(--font-bangers)] text-2xl sm:text-3xl text-vibrant-lime mb-3">
                  YOU'RE ON THE LIST!
                </h3>
                <p className="font-[var(--font-inter)] text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
                  We'll notify you as soon as the app is restored and openings are available. When they interfere, we keep going.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="firstName" className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground">
                      First Name <span className="text-vibrant-coral">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                      className="bg-secondary border border-border rounded-xl px-4 py-3 font-[var(--font-inter)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-vibrant-lime/50 focus:border-vibrant-lime transition-all"
                      placeholder="Your first name"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="lastName" className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground">
                      Last Name <span className="text-vibrant-coral">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                      className="bg-secondary border border-border rounded-xl px-4 py-3 font-[var(--font-inter)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-vibrant-lime/50 focus:border-vibrant-lime transition-all"
                      placeholder="Your last name"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground">
                    Email <span className="text-vibrant-coral">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="bg-secondary border border-border rounded-xl px-4 py-3 font-[var(--font-inter)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-vibrant-lime/50 focus:border-vibrant-lime transition-all"
                    placeholder="your@email.com"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="skills" className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground">
                    Skills
                  </label>
                  <input
                    type="text"
                    id="skills"
                    name="skills"
                    value={formData.skills}
                    onChange={handleChange}
                    className="bg-secondary border border-border rounded-xl px-4 py-3 font-[var(--font-inter)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-vibrant-lime/50 focus:border-vibrant-lime transition-all"
                    placeholder="e.g., counseling, design, coding"
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="country" className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground">
                      Country
                    </label>
                    <input
                      type="text"
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="bg-secondary border border-border rounded-xl px-4 py-3 font-[var(--font-inter)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-vibrant-lime/50 focus:border-vibrant-lime transition-all"
                      placeholder="Country"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="state" className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground">
                      State
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="bg-secondary border border-border rounded-xl px-4 py-3 font-[var(--font-inter)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-vibrant-lime/50 focus:border-vibrant-lime transition-all"
                      placeholder="State"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="city" className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground">
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="bg-secondary border border-border rounded-xl px-4 py-3 font-[var(--font-inter)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-vibrant-lime/50 focus:border-vibrant-lime transition-all"
                      placeholder="City"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="quoraUrl" className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground">
                    Quora Profile URL
                  </label>
                  <input
                    type="url"
                    id="quoraUrl"
                    name="quoraUrl"
                    value={formData.quoraUrl}
                    onChange={handleChange}
                    className="bg-secondary border border-border rounded-xl px-4 py-3 font-[var(--font-inter)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-vibrant-lime/50 focus:border-vibrant-lime transition-all"
                    placeholder="https://quora.com/profile/..."
                  />
                </div>

                {/* Trust indicators */}
                <div className="flex flex-wrap justify-center gap-4 sm:gap-6 py-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Lock className="w-3.5 h-3.5 text-vibrant-lime flex-shrink-0" />
                    <span className="font-[var(--font-inter)] text-xs">Complete Data Control</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Shield className="w-3.5 h-3.5 text-vibrant-lime flex-shrink-0" />
                    <span className="font-[var(--font-inter)] text-xs">No Data Selling</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Eye className="w-3.5 h-3.5 text-vibrant-lime flex-shrink-0" />
                    <span className="font-[var(--font-inter)] text-xs">Transparent Policies</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={formState === "submitting"}
                  className="font-[var(--font-bangers)] text-lg sm:text-xl md:text-2xl px-8 py-5 sm:py-6 bg-vibrant-lime text-[#0a0a0a] hover:bg-vibrant-yellow rounded-xl transition-all shadow-lg shadow-vibrant-lime/20 w-full disabled:opacity-50"
                >
                  {formState === "submitting" ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin" />
                      SECURING YOUR SPOT...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      JOIN THE WAITLIST NOW
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </Button>
              </form>
            )}
          </div>

          {/* Bottom reassurance */}
          <p className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground text-center mt-6 sm:mt-8 max-w-lg mx-auto leading-relaxed">
            We will notify you as soon as the app is restored and openings are available.
            When they interfere, we keep going. Exit their economy -- build ours.
          </p>
        </div>
      </div>
    </section>
  )
}
