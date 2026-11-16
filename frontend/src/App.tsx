import { AuthPanel } from "./components/AuthPanel";
import Studio from "./components/Studio";
import { useAuth } from "./hooks/useAuth";
import "./styles.css";

export default function App() {
  const { configured, loading, session, signOut } = useAuth();

  if (configured && loading) {
    return (
      <main className="app auth-screen">
        <p className="hint">Loading…</p>
      </main>
    );
  }

  if (configured && !session) {
    return <AuthPanel />;
  }

  return (
    <Studio
      authed={configured && session !== null}
      email={session?.user.email ?? null}
      onSignOut={signOut}
    />
  );
}