{/* ── Enhanced System Overview Header ── */}
<div
  className="monitor-overview-hero"
  style={{
    marginBottom: '18px',
    padding: '18px 20px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, rgba(30,41,59,0.96), rgba(15,23,42,0.94))',
    border: '1px solid rgba(148,163,184,0.18)',
    boxShadow: '0 18px 40px rgba(15,23,42,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '18px',
    flexWrap: 'wrap',
  }}
>
  <div>
    <div
      style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: '#38bdf8',
        marginBottom: '6px',
      }}
    >
      Live System Overview
    </div>

    <h2
      style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: '1.45rem',
        fontWeight: 700,
        color: '#f8fafc',
        margin: 0,
        letterSpacing: '-0.02em',
      }}
    >
      System Monitoring Dashboard
    </h2>

    <p
      style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: '0.86rem',
        color: '#94a3b8',
        margin: '6px 0 0',
      }}
    >
      Real-time process, performance, disk, startup, service, and scheduling simulation overview.
    </p>
  </div>

  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(90px, 1fr))',
      gap: '10px',
      minWidth: '420px',
    }}
  >
    {[
      { label: 'Health', value: `${systemHealthScore}%`, sub: systemHealthLabel },
      { label: 'CPU', value: `${systemStats.cpuUsage.toFixed(1)}%`, sub: 'usage' },
      { label: 'Memory', value: `${memoryUsagePercent.toFixed(1)}%`, sub: 'used' },
      { label: 'Disk', value: `${diskUsagePercent.toFixed(1)}%`, sub: 'used' },
    ].map((item) => (
      <div
        key={item.label}
        style={{
          padding: '12px',
          borderRadius: '14px',
          background: 'rgba(255,255,255,0.055)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.68rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#94a3b8',
            marginBottom: '4px',
          }}
        >
          {item.label}
        </div>

        <div
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '1.15rem',
            fontWeight: 700,
            color: '#f8fafc',
          }}
        >
          {item.value}
        </div>

        <div
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.72rem',
            color: '#64748b',
          }}
        >
          {item.sub}
        </div>
      </div>
    ))}
  </div>
</div>