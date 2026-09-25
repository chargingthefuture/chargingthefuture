"use client";

import styles from "./community-shell.module.css";
import type { ChatMessageImage as ChatMessageImageData } from "./shell-types";

// The picture on a Commons post. Tapping it opens the full-size copy in a new tab, where it can be
// zoomed on a phone. The width and height hold its space so the stream does not jump when it loads.
export function ChatMessageImage({ image }: { image: ChatMessageImageData }) {
  return (
    <a href={image.url} target="_blank" rel="noopener" className={styles.chatImageLink}>
      {/* A plain img, not next/image: the source is a member-gated route the image pipeline cannot
          fetch on the member's behalf. */}
      <img
        src={image.url}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        className={styles.chatImage}
      />
    </a>
  );
}
