"use client";

import { useEffect, useRef } from "react";

/**
 * The logo animation as a panel background. It's contained, not cropped, because the logo fills half
 * the frame's height and a wide panel would otherwise slice through it. Phones are the exception:
 * their panels are tall enough to fill without cutting the logo, so it stays large.
 *
 * Wide screens have room beside the text, so the logo sits there clearly. Elsewhere the text fills
 * the panel, so it's a faint watermark that never competes with the words. The soft edge hides the
 * small colour difference between the video and the panel.
 *
 * It plays once and rests on the finished logo, and goes straight there for reduced motion or if
 * the browser refuses to autoplay.
 */
export function LogoVideo() {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.muted = true;

    const showFinished = () => {
      element.pause();
      if (Number.isFinite(element.duration)) element.currentTime = element.duration;
      else element.addEventListener("loadedmetadata", showFinished, { once: true });
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) showFinished();
    else element.play().catch(showFinished);

    return () => element.removeEventListener("loadedmetadata", showFinished);
  }, []);

  return (
    <video
      ref={video}
      aria-hidden="true"
      tabIndex={-1}
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      src="/brand/lumora-logo-motion-green.mp4"
      className="pointer-events-none absolute inset-0 -z-20 size-full object-contain opacity-20 [mask-image:radial-gradient(closest-side,black_60%,transparent)] max-[430px]:object-cover max-[430px]:opacity-15 xl:object-right xl:opacity-50"
    />
  );
}
