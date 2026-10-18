import { useEffect, useState, type ReactNode } from "react";
import { directionsUrl, mapsPlatform, type MapsTarget } from "@/lib/meeqo/maps";
import { isNative, platform } from "@/lib/meeqo/native";

/** Directions link for this phone: Google Maps on Android, Apple Maps on iOS, Google Maps web on a computer. Worked out after mount (needs the user agent). */
export function useDirections(target: MapsTarget) {
  const fallback = directionsUrl(target, "desktop");
  const [href, setHref] = useState(fallback);
  useEffect(() => {
    setHref(directionsUrl(target, mapsPlatform(platform(), navigator.userAgent), isNative()));
  }, [target.lat, target.lng, target.label, target.address]);
  return href;
}

export function RouteLink({ target, className = "", children, label }: { target: MapsTarget; className?: string; children: ReactNode; label?: string }) {
  const href = useDirections(target);
  const external = href.startsWith("http");
  return (
    <a href={href} className={className} aria-label={label} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}
