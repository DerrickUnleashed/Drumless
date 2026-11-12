import { useEffect, useState } from "react";

export function navigate(to: string): void {
  if (window.location.pathname !== to) {
    window.history.pushState({}, "", to);
  }
  window.dispatchEvent(new Event("popstate"));
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const handleChange = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handleChange);
    return () => window.removeEventListener("popstate", handleChange);
  }, []);

  return pathname;
}
