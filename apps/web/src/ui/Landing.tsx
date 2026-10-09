import { useEffect, useState } from "react";
import { useGame, persist } from "../state/store";
import { Logo } from "../App";
import { accountsEnabled, getEmail, sendMagicLink, signOut } from "../net/auth";
import { multiplayerConfigured } from "../net/client";
import { Guidelines } from "./Panels";

export function Landing() {
  const { acceptedGuidelines, set, name } = useGame();
  const [adult, setAdult] = useState(acceptedGuidelines);
  const [agree, setAgree] = useState(acceptedGuidelines);
  const [showRules, setShowRules] = useState(false);
  const [email, setEmail] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<string | null>(null);

  useEffect(() => {
    void getEmail().then(setSignedIn);
  }, []);

  const enter = () => {
    persist.set("ozu.guidelines", true);
    set({ acceptedGuidelines: true, phase: "create" });
  };

  return (
    <main className="landing">
      <div className="landing-bg" aria-hidden="true" />
      <header className="landing-top">
        <Logo />
        <span className="pill">Lagos · Beta</span>
      </header>
      <section className="hero">
        <h1>
          Your city.<br />Your people.<br /><span className="accent">Your story.</span>
        </h1>
        <p className="lede">
          Step into Ozu, a multiplayer virtual Lagos in your browser. Create your character, explore the Ozu
          Social District, meet real people, join community activities and build a reputation.
        </p>

        <div className="card entry">
          <label className="check">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
            <span>I am 18 or older.</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              I agree to the{" "}
              <button className="link" onClick={() => setShowRules(true)}>community guidelines</button>.
            </span>
          </label>
          <button className="btn primary big" disabled={!adult || !agree} onClick={enter}>
            {name ? `Continue as ${name}` : "Enter Lagos"}
          </button>

          {accountsEnabled && (
            <div className="account-box">
              {signedIn ? (
                <p className="muted">
                  Signed in as <strong>{signedIn}</strong> ·{" "}
                  <button className="link" onClick={() => void signOut().then(() => setSignedIn(null))}>Sign out</button>
                </p>
              ) : (
                <>
                  <p className="muted">Playing as a guest saves progress on this device. Sign in to keep it everywhere.</p>
                  <form
                    className="row"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setAuthMsg("Sending…");
                      const err = await sendMagicLink(email);
                      setAuthMsg(err ?? "Check your email for a sign-in link.");
                    }}
                  >
                    <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" />
                    <button className="btn">Email me a link</button>
                  </form>
                  {authMsg && <p className="muted small">{authMsg}</p>}
                </>
              )}
            </div>
          )}
          {!multiplayerConfigured && (
            <p className="muted small">Preview mode: the multiplayer server isn't connected to this build, so you'll explore solo and progress won't be saved.</p>
          )}
        </div>
      </section>

      <section className="features">
        {[
          ["Explore", "Plaza, buka, market row, Shrine Lounge, Danfo Park and the Lagoon Lookout."],
          ["Meet people", "Walk up to anyone, say hello, chat and use emotes."],
          ["Do things together", "Community clean-up drives, exploration and greetings earn coins and rep."],
          ["Stay safe", "Report, block and mute at any time. Moderators review every report."],
        ].map(([h, p]) => (
          <div key={h} className="feature">
            <h3>{h}</h3>
            <p>{p}</p>
          </div>
        ))}
      </section>
      <footer className="landing-foot">
        <span>© {new Date().getFullYear()} Ozu</span>
        <button className="link" onClick={() => setShowRules(true)}>Community guidelines</button>
        <span>Ozu coins have no real-world value.</span>
      </footer>
      {showRules && <Guidelines onClose={() => setShowRules(false)} />}
    </main>
  );
}
