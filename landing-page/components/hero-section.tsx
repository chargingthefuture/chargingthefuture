"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Shield, Lock, Users, Clock, TrendingUp, Zap } from "lucide-react"

function LiveCounter({ target, label, prefix = "" }: { target: number; label: string; prefix?: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const duration = 2000
    const steps = 60
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [target])

  return (
    <div className="flex flex-col items-center">
      <span className="font-[var(--font-bangers)] text-3xl sm:text-4xl md:text-5xl text-vibrant-lime">
        {prefix}{count.toLocaleString()}
      </span>
      <span className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mt-1">
        {label}
      </span>
    </div>
  )
}

function UrgencyBanner() {
  const [spotsLeft, setSpotsLeft] = useState(47)

  useEffect(() => {
    const timer = setInterval(() => {
      setSpotsLeft((prev) => {
        if (prev <= 12) return 47
        return prev - 1
      })
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-vibrant-coral/10 border border-vibrant-coral/30">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vibrant-coral opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-vibrant-coral" />
      </span>
      <span className="font-[var(--font-inter)] text-xs sm:text-sm text-vibrant-coral font-semibold">
        Only {spotsLeft} pilot spots remaining
      </span>
    </div>
  )
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden" aria-label="Hero section">
      {/* Scrolling urgency banner at very top */}
      <div className="relative bg-vibrant-lime overflow-hidden py-2" role="region" aria-label="Announcement banner">
        <div className="flex animate-marquee whitespace-nowrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="font-[var(--font-bangers)] text-sm md:text-base text-[#0a0a0a] mx-6 sm:mx-8"
            >
              LIMITED EARLY ACCESS -- PILOT COHORTS LAUNCHING NOW -- 5M SURVIVORS -- $300B VISION -- JOIN THE WAITLIST --
            </span>
          ))}
        </div>
      </div>

      {/* Main hero grid */}
      <div className="grid lg:grid-cols-2 min-h-[calc(100vh-40px)]">
        {/* Left panel - Hero image with vibrant overlay */}
        <div className="relative h-[40vh] sm:h-[50vh] lg:h-auto overflow-hidden bg-secondary">
          <Image
            src="/images/dara014634-comic-book-panel-in-robert-kirkmans-walking-dead-s-81524c71-3ea6-4499-a1b8-6b92cf353928-0.png"
            alt="Comic book panel illustration representing survivor resilience"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          {/* Vibrant color accent strip */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-vibrant-lime" aria-hidden="true" />

          {/* Comic caption box */}
          <div className="absolute inset-0 flex items-start justify-start z-10 p-3 sm:p-4 md:p-6">
            <div className="bg-vibrant-yellow text-[#0a0a0a] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-[var(--font-inter)] text-xs sm:text-sm max-w-[200px] shadow-lg">
              <p className="font-bold">CHAPTER ONE:</p>
              <p className="text-[10px] sm:text-xs">The people around us changed. But we survived.</p>
            </div>
          </div>

          {/* FOMO live badge */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className="bg-[#0a0a0a]/90 backdrop-blur-sm rounded-xl p-3 sm:p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-vibrant-mint animate-pulse" />
                <span className="font-[var(--font-inter)] text-xs sm:text-sm text-vibrant-mint font-medium">
                  4,821 people on the waitlist
                </span>
              </div>
              <span className="font-[var(--font-inter)] text-[10px] sm:text-xs text-muted-foreground">
                Updated live
              </span>
            </div>
          </div>
        </div>

        {/* Right panel - Content */}
        <div className="relative flex flex-col justify-center p-4 sm:p-6 md:p-8 lg:p-12 xl:p-16">
          {/* Urgency badge */}
          <div className="mb-4 sm:mb-6">
            <UrgencyBanner />
          </div>

          <div className="relative mb-4 sm:mb-6">
            <h1 className="font-[var(--font-bangers)] text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-none tracking-wide text-foreground text-balance">
              FROM SURVIVOR
              <span className="block text-vibrant-lime">TO THRIVER</span>
              <span className="block text-2xl sm:text-3xl md:text-4xl lg:text-5xl mt-2 text-muted-foreground">
                JOIN THE WAITLIST
              </span>
            </h1>
          </div>

          <p className="font-[var(--font-inter)] text-sm sm:text-base md:text-lg text-muted-foreground mb-6 max-w-lg leading-relaxed">
            Be part of the world's first psyop-free economy uniting 5 million survivors into a thriving, self-sustaining
            service economy. Limited early access -- join the waitlist now.
          </p>

          {/* Stats row - vibrant color blocks like the music app */}
          <div className="grid grid-cols-3 gap-3 mb-6 sm:mb-8" role="list" aria-label="Platform scale">
            <div className="bg-vibrant-lime/10 border border-vibrant-lime/20 rounded-xl p-3 sm:p-4 text-center" role="listitem">
              <span className="font-[var(--font-bangers)] text-xl sm:text-2xl md:text-3xl text-vibrant-lime block">5M</span>
              <span className="font-[var(--font-inter)] text-[10px] sm:text-xs text-muted-foreground">Survivors</span>
            </div>
            <div className="bg-vibrant-yellow/10 border border-vibrant-yellow/20 rounded-xl p-3 sm:p-4 text-center" role="listitem">
              <span className="font-[var(--font-bangers)] text-xl sm:text-2xl md:text-3xl text-vibrant-yellow block">$300B</span>
              <span className="font-[var(--font-inter)] text-[10px] sm:text-xs text-muted-foreground">GDP Vision</span>
            </div>
            <div className="bg-vibrant-coral/10 border border-vibrant-coral/20 rounded-xl p-3 sm:p-4 text-center" role="listitem">
              <span className="font-[var(--font-bangers)] text-xl sm:text-2xl md:text-3xl text-vibrant-coral block">$60K</span>
              <span className="font-[var(--font-inter)] text-[10px] sm:text-xs text-muted-foreground">Per Person</span>
            </div>
          </div>

          {/* Key stats badges */}
          <div className="flex flex-wrap gap-3 mb-6" role="list" aria-label="Platform features">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border" role="listitem">
              <Shield className="w-3.5 h-3.5 text-vibrant-lime flex-shrink-0" aria-hidden="true" />
              <span className="font-[var(--font-inter)] text-xs sm:text-sm">8+ Services</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border" role="listitem">
              <Lock className="w-3.5 h-3.5 text-vibrant-lavender flex-shrink-0" aria-hidden="true" />
              <span className="font-[var(--font-inter)] text-xs sm:text-sm">Invite Only</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border" role="listitem">
              <Users className="w-3.5 h-3.5 text-vibrant-mint flex-shrink-0" aria-hidden="true" />
              <span className="font-[var(--font-inter)] text-xs sm:text-sm">Survivor-Led</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-4">
            <a href="#waitlist-form" aria-label="Join the waitlist">
              <Button
                size="lg"
                className="font-[var(--font-bangers)] text-base sm:text-lg md:text-xl px-6 py-4 sm:px-8 sm:py-5 bg-vibrant-lime text-[#0a0a0a] hover:bg-vibrant-yellow rounded-xl transition-all shadow-lg shadow-vibrant-lime/20"
              >
                <Zap className="w-5 h-5 mr-1" aria-hidden="true" />
                SECURE YOUR SPOT
              </Button>
            </a>
            <a href="#how-it-works" aria-label="Learn how it works">
              <Button
                size="lg"
                variant="outline"
                className="font-[var(--font-bangers)] text-base sm:text-lg md:text-xl px-6 py-4 sm:px-8 sm:py-5 rounded-xl border-border hover:bg-secondary transition-all"
              >
                HOW IT WORKS
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
