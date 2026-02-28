import { config } from "@/lib/config"

export function Footer() {
  return (
    <footer className="border-t border-border bg-card" role="contentinfo">
      {/* Short banner */}
      <div className="bg-vibrant-lime/10 border-b border-vibrant-lime/20 py-4" role="region" aria-label="Waitlist summary">
        <div className="container mx-auto px-4 text-center">
          <p className="font-[var(--font-bangers)] text-base sm:text-lg md:text-xl text-vibrant-lime">
            5M SURVIVORS. $300B VISION. LIMITED EARLY ACCESS.
          </p>
          <p className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground mt-1">
            Join the waitlist to be first in line for training, gigs, and ServiceCredits.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:py-10 md:py-12">
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-[var(--font-bangers)] text-lg sm:text-xl md:text-2xl mb-2 sm:mb-3 text-foreground">PSYOP-FREE ECONOMY</h3>
            <p className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Built with care, respect, and dedication to serving the survivor community. Every feature is designed with
              trauma-informed principles.
            </p>
          </div>

          {/* Platform Status */}
          <div>
            <h4 className="font-[var(--font-bangers)] text-base sm:text-lg md:text-xl mb-2 sm:mb-3 text-foreground">PLATFORM STATUS</h4>
            <ul className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground flex flex-col gap-2">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-vibrant-lime rounded-full flex-shrink-0" />
                Active and continuously improving
              </li>
              <li>
                <a
                  href={config.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-vibrant-lime transition-colors"
                  aria-label="View source code on GitHub"
                >
                  Access: Open source code
                </a>
              </li>
              <li>
                <a
                  href={config.links.signalGroup}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-vibrant-lime transition-colors"
                  aria-label="Join Signal group chat"
                >
                  Chat: Signal group
                </a>
              </li>
            </ul>
          </div>

          {/* Privacy Commitment */}
          <div>
            <h4 className="font-[var(--font-bangers)] text-base sm:text-lg md:text-xl mb-2 sm:mb-3 text-foreground">PRIVACY COMMITMENT</h4>
            <ul className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground flex flex-col gap-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-vibrant-mint rounded-full flex-shrink-0" />
                Complete account deletion
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-vibrant-mint rounded-full flex-shrink-0" />
                Data anonymization
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-vibrant-mint rounded-full flex-shrink-0" />
                We never sell data
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-vibrant-mint rounded-full flex-shrink-0" />
                Regular security audits
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 sm:mt-10 pt-5 sm:pt-6 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground text-center md:text-left">
            &copy; {new Date().getFullYear()} Charging The Future. All rights reserved.
          </p>
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href={config.links.terms}
              target="_blank"
              rel="noopener noreferrer"
              className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground hover:text-vibrant-lime transition-colors"
              aria-label="View Terms of Service"
            >
              Terms of Service
            </a>
            <a
              href={config.links.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className="font-[var(--font-inter)] text-xs sm:text-sm text-muted-foreground hover:text-vibrant-lime transition-colors"
              aria-label="View Privacy Policy"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
