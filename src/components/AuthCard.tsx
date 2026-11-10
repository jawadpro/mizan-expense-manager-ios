/** The centred card around the sign-in, sign-up and password pages. */
export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="brand" style={{ marginBottom: 12 }}><span className="brand-mark" aria-hidden>م</span> Mizan</div>
        <h1 style={{ fontSize: "1.5rem" }}>{title}</h1>
        {subtitle && <p className="muted" style={{ marginTop: 4 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
