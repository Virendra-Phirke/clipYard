"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePageClient() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createRoom() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to create room");
      sessionStorage.setItem(`clipboard-token-${payload.roomId}`, JSON.stringify(payload));
      router.push(`/room/${payload.roomId}`);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Unable to create room");
    } finally {
      setLoading(false);
    }
  }

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = roomId.trim().toLowerCase();
    if (!normalized || normalized.length < 4) {
      setError("Use the 8-character room code.");
      return;
    }
    router.push(`/room/${normalized}`);
  }

  return (
    <>
      {/* ── Top Nav Bar ── */}
      <header
        style={{
          backgroundColor: "#f3fbf6",
          borderBottom: "1px solid #bdc9c3",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            width: "100%",
            maxWidth: "1280px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: "24px",
              lineHeight: "32px",
              letterSpacing: "-0.01em",
              fontWeight: 700,
              color: "#006a53",
            }}
          >
            ◈ ClipYard
          </div>
          <nav style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <a
              href="#how-it-works"
              style={{
                fontFamily: "Hanken Grotesk, sans-serif",
                fontSize: "16px",
                lineHeight: "24px",
                color: "#3e4944",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#006a53")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#3e4944")}
            >
              How it works
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: "Hanken Grotesk, sans-serif",
                fontSize: "16px",
                lineHeight: "24px",
                color: "#3e4944",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#006a53")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#3e4944")}
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      {/* ── Main Canvas ── */}
      <main
        style={{
          flexGrow: 1,
          width: "100%",
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "64px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* ── Hero Section ── */}
        <section
          style={{
            textAlign: "center",
            maxWidth: "672px",
            marginBottom: "96px",
            marginTop: "48px",
          }}
        >
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "14px",
              lineHeight: "20px",
              letterSpacing: "0.1em",
              fontWeight: 500,
              color: "#16856a",
              textTransform: "uppercase",
              marginBottom: "16px",
            }}
          >
            Real-Time Text Transfer
          </div>

          <h1
            style={{
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: "clamp(32px, 5vw, 48px)",
              lineHeight: "1.15",
              letterSpacing: "-0.02em",
              fontWeight: 700,
              color: "#161d1a",
              marginBottom: "24px",
            }}
          >
            Send text between your devices.
          </h1>

          <p
            style={{
              fontFamily: "Hanken Grotesk, sans-serif",
              fontSize: "18px",
              lineHeight: "28px",
              color: "#3e4944",
              marginBottom: "40px",
            }}
          >
            A temporary clipboard for moving text between your laptop, phone,
            and desktop. No account. No setup.
          </p>

          {/* CTA Row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <button
              id="create-clipboard-btn"
              onClick={createRoom}
              disabled={loading}
              style={{
                backgroundColor: "#16856a",
                color: "#fdfffc",
                fontFamily: "Hanken Grotesk, sans-serif",
                fontSize: "16px",
                lineHeight: "24px",
                fontWeight: 600,
                padding: "12px 24px",
                borderRadius: "4px",
                border: "1.5px solid #d1d9d4",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget.style.backgroundColor) = "#006a53"
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget.style.backgroundColor) = "#16856a"
              }}
            >
              {loading ? "Creating…" : "Create Clipboard →"}
            </button>

            <span
              style={{
                fontFamily: "Hanken Grotesk, sans-serif",
                fontSize: "16px",
                color: "#3e4944",
              }}
            >
              or
            </span>

            {/* Join Module */}
            <form
              onSubmit={joinRoom}
              style={{
                backgroundColor: "#ffffff",
                border: "1.5px solid #d1d9d4",
                borderRadius: "4px",
                padding: "12px 16px",
                display: "flex",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <label htmlFor="room-id-input" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
                Room code
              </label>
              <input
                id="room-id-input"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                placeholder="Enter room code"
                style={{
                  minWidth: '240px',
                  border: '1.5px solid #d1d9d4',
                  borderRadius: '4px',
                  padding: '12px 16px',
                  fontSize: '16px',
                  outline: 'none',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <button
                type="submit"
                style={{
                  backgroundColor: '#16856a',
                  color: '#fdfffc',
                  fontFamily: 'Hanken Grotesk, sans-serif',
                  fontSize: '16px',
                  lineHeight: '24px',
                  fontWeight: 600,
                  padding: '12px 24px',
                  borderRadius: '4px',
                  border: '1.5px solid #16856a',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006a53')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#16856a')}
              >
                Join
              </button>
            </form>
          </div>

          {error ? (
            <p
              role="alert"
              style={{
                marginTop: '24px',
                color: '#ba1a1a',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {error}
            </p>
          ) : null}
        </section>

        <section id="how-it-works" style={{ width: '100%', maxWidth: '888px', display: 'grid', gap: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '32px', border: '1.5px solid #d1d9d4' }}>
            <h2 style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '24px', lineHeight: '1.2', marginBottom: '16px', color: '#161d1a' }}>
              How it works
            </h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', color: '#16856a', marginTop: '4px' }}>1</span>
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '18px', color: '#161d1a' }}>Generate a room</h3>
                  <p style={{ margin: '8px 0 0', color: '#3e4944', lineHeight: '1.6' }}>Create a temporary clipboard that syncs instantly across devices.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', color: '#16856a', marginTop: '4px' }}>2</span>
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '18px', color: '#161d1a' }}>Connect devices</h3>
                  <p style={{ margin: '8px 0 0', color: '#3e4944', lineHeight: '1.6' }}>Share the room link or QR code with any device to join instantly.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', color: '#16856a', marginTop: '4px' }}>3</span>
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '18px', color: '#161d1a' }}>Sync text instantly</h3>
                  <p style={{ margin: '8px 0 0', color: '#3e4944', lineHeight: '1.6' }}>Paste or type text and have it available across every connected device in the room.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
