import { KURASO_FORMAT_VERSION } from "@kuraso/formats";

export function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--kuraso-bg-canvas)",
        color: "var(--kuraso-text-primary)",
        fontFamily: "var(--kuraso-font-ui)",
        paddingInline: "var(--kuraso-space-6)",
        paddingBlock: "var(--kuraso-space-6)",
      }}
    >
      <h1>Kuraso</h1>
      <p style={{ color: "var(--kuraso-text-secondary)" }}>
        Local-first academic reading workspace · Format v{KURASO_FORMAT_VERSION}
      </p>
    </main>
  );
}
