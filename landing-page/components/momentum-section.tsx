"use client"

import { useEffect, useState, useRef } from "react"
import { TrendingUp, Target, Rocket, Users } from "lucide-react"

function AnimatedProgress({ target, label, color }: { target: number; label: string; color: string }) {
  const [width, setWidth] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setTimeout(() => setWidth(target), 200)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground">{label}</span>
        <span className={`font-[var(--font-bangers)] text-sm sm:text-base ${color}`}>{target}%</span>
      </div>
      <div className="h-3 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${
            color === "text-vibrant-lime" ? "bg-vibrant-lime" :
            color === "text-vibrant-yellow" ? "bg-vibrant-yellow" :
            color === "text-vibrant-coral" ? "bg-vibrant-coral" :
            color === "text-vibrant-lavender" ? "bg-vibrant-lavender" : "bg-vibrant-mint"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export function MomentumSection() {
  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-24" aria-labelledby="momentum-heading">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14 md:mb-16">
          <span className="inline-block font-[var(--font-inter)] text-xs sm:text-sm uppercase tracking-widest text-vibrant-coral mb-3">
            Scaling fast
          </span>
          <h2
            id="momentum-heading"
            className="font-[var(--font-bangers)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-wide text-foreground mb-4"
          >
            CURRENT MOMENTUM
          </h2>
          <p className="font-[var(--font-inter)] text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base md:text-lg">
            We're scaling training and provider onboarding fast. Here's where we stand.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
          {/* Left - Progress indicators */}
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
            <h3 className="font-[var(--font-bangers)] text-xl sm:text-2xl text-foreground">YEAR-1 TARGETS</h3>
            <AnimatedProgress target={72} label="Provider onboarding" color="text-vibrant-lime" />
            <AnimatedProgress target={58} label="Training cohort capacity" color="text-vibrant-yellow" />
            <AnimatedProgress target={45} label="Local hub setup" color="text-vibrant-coral" />
            <AnimatedProgress target={85} label="Platform infrastructure" color="text-vibrant-lavender" />

            <div className="mt-2 pt-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-vibrant-lime flex-shrink-0" />
                <span className="font-[var(--font-inter)] text-sm text-muted-foreground">
                  Year-1 target: <span className="text-vibrant-lime font-semibold">$50B captured</span> (avg $10,000/person)
                </span>
              </div>
            </div>
          </div>

          {/* Right - Key milestones with FOMO */}
          <div className="flex flex-col gap-4">
            {/* Milestone cards */}
            <div className="bg-vibrant-lime/10 border border-vibrant-lime/20 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-vibrant-lime/20 w-10 h-10 rounded-xl flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-vibrant-lime" />
                </div>
                <h3 className="font-[var(--font-bangers)] text-lg sm:text-xl text-vibrant-lime">PILOT COHORTS</h3>
              </div>
              <p className="font-[var(--font-inter)] text-sm text-muted-foreground leading-relaxed">
                Launching now -- spots are limited. Early members shape the platform's direction.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vibrant-lime opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-vibrant-lime" />
                </span>
                <span className="font-[var(--font-inter)] text-xs text-vibrant-lime font-medium">Enrolling now</span>
              </div>
            </div>

            <div className="bg-vibrant-yellow/10 border border-vibrant-yellow/20 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-vibrant-yellow/20 w-10 h-10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-vibrant-yellow" />
                </div>
                <h3 className="font-[var(--font-bangers)] text-lg sm:text-xl text-vibrant-yellow">FIRST EARNING OPS</h3>
              </div>
              <p className="font-[var(--font-inter)] text-sm text-muted-foreground leading-relaxed">
                Waitlist members get priority for initial paid gigs, subscriptions, and marketplace matching.
              </p>
            </div>

            <div className="bg-vibrant-lavender/10 border border-vibrant-lavender/20 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-vibrant-lavender/20 w-10 h-10 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-vibrant-lavender" />
                </div>
                <h3 className="font-[var(--font-bangers)] text-lg sm:text-xl text-vibrant-lavender">SURVIVOR-LED GOVERNANCE</h3>
              </div>
              <p className="font-[var(--font-inter)] text-sm text-muted-foreground leading-relaxed">
                Anti-exploitation protections, mental-health supports, identity & credentialing, and local hubs -- all led by survivors.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
