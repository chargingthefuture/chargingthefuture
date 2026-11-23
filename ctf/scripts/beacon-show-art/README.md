# "In Other News" Beacon show art

Source and rendered images for the "In Other News" audio series graphic that points people to the
live Beacon stream. `show-art.css` holds the shared look; each `.html` file is one size.

| Source file | Output | Use |
|---|---|---|
| `in-other-news-square.html` | `in-other-news-square-2000x2000.png` | Square posts |
| `in-other-news-wide.html` | `in-other-news-wide-1280x720.png` | Stream cover and wide posts |

The text is Inter (Black, ExtraBold, Bold), read from the fonts installed on the machine that
renders it. To change the address or copy, edit the `.html` file and re-render with headless
Chromium at the page size:

```bash
chromium --headless --no-sandbox --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=2000,2000 --screenshot=in-other-news-square-2000x2000.png \
  "file://$PWD/in-other-news-square.html"
```
