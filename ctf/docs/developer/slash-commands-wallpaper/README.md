# Slash commands wallpaper

The owner keeps the slash-command cheat sheet as their iPhone Lock Screen. `wallpaper.html` is
the source; the image is rendered from it, never drawn by hand.

Update it whenever a slash command is added, renamed or removed in `.claude/commands/`, in the
same PR as the command (owner directive, 2026-10-03). Edit the card in `wallpaper.html`, render,
look at the result once, and send the PNG to the owner in the reply.

Render (1170 × 2532, the iPhone Lock Screen size):

```
/opt/pw-browsers/chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1170,2532 --force-device-scale-factor=1 \
  --screenshot=slash-commands-wallpaper.png file://$PWD/wallpaper.html
```

Layout rules the owner set: the top 660 px stay dark for the clock; no one-line titles under a
command, only the description; no explainer lines under a heading; the footer is the `/clear`
line alone. Everything must fit above 2532 px, so a new card means tightening the others, not
dropping below the bottom edge. The PNG is not committed; it is a deliverable sent in chat.
