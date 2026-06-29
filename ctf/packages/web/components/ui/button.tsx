import * as React from "react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", style, ...props }, ref) => {
    // The shadcn color tokens (bg-primary, border-input, bg-background, …) are not defined in this
    // app's Tailwind config, so the old variant classes rendered transparent buttons. Style each
    // variant explicitly with the app's --ctf-* tokens (with hardcoded fallbacks) so the button reads
    // as a real button regardless of the missing tokens.
    const variantStyles: Record<NonNullable<ButtonProps["variant"]>, React.CSSProperties> = {
      default: {
        backgroundColor: "var(--ctf-cta-bg, #6366F1)",
        color: "var(--ctf-cta-text, #FFFFFF)",
        border: "1px solid var(--ctf-cta-border, transparent)",
      },
      outline: {
        backgroundColor: "var(--ctf-surface, rgba(255,255,255,0.04))",
        color: "var(--ctf-text, #F9FAFB)",
        border: "1px solid var(--ctf-border, #1E2A3A)",
      },
      ghost: {
        backgroundColor: "transparent",
        color: "var(--ctf-text, #F9FAFB)",
        border: "1px solid transparent",
      },
    }

    return (
      <button
        className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 px-4 py-2 ${className}`}
        style={{ cursor: "pointer", ...variantStyles[variant], ...style }}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
