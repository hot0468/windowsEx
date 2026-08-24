import Download from './Download.jsx'

// A one-page company site. The honest ones and the ones that are not look
// nothing alike, so the theme picks the whole skin rather than one accent.
export default function Vendor({ site }) {
  const v = site.vendor
  return (
    <div className={'vd vd-' + v.theme}>
      <header className="vd-top">
        <span className="vd-brand">{v.brand}</span>
        <span className="vd-tag">{v.tagline}</span>
      </header>
      <div className="vd-body">
        {v.lines.map((line, i) => <p key={i} className="vd-line">{line}</p>)}
        {v.download && <Download item={v.download} />}
        {(v.notes ?? []).map((n, i) => <p key={i} className="vd-note">{n}</p>)}
      </div>
    </div>
  )
}
