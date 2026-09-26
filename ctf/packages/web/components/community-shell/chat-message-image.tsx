"use client";

import { useState } from "react";
import styles from "./community-shell.module.css";
import { ChatImageLightbox } from "./chat-image-lightbox";
import type { ChatMessageImage as ChatMessageImageData } from "./shell-types";

// The picture on a Commons post. Tapping it opens the full-size copy in an in-app lightbox, where
// it can be zoomed on a phone. Not a `target="_blank"` link: the app is installed as a standalone
// PWA with no browser chrome, so a new tab leaves a member on a bare native image viewer with no
// way back short of a force-close (see `chat-image-lightbox.tsx`). The width and height hold the
// thumbnail's space so the stream does not jump when it loads.
export function ChatMessageImage({ image }: { image: ChatMessageImageData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.chatImageLink}
        onClick={() => setExpanded(true)}
        aria-label={`Expand image: ${image.alt}`}
      >
        {/* A plain img, not next/image: the source is an API route whose access depends on the viewer's
            sign-in and the Commons public-viewing setting, which the image pipeline cannot judge. */}
        <img
          src={image.url}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          className={styles.chatImage}
        />
      </button>
      {expanded ? <ChatImageLightbox image={image} onDismiss={() => setExpanded(false)} /> : null}
    </>
  );
}
