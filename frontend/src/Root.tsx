import App from "./App";
import { Landing } from "./Landing";
import { usePathname } from "./router";

export default function Root() {
  const pathname = usePathname();
  return pathname.startsWith("/studio") ? <App /> : <Landing />;
}
