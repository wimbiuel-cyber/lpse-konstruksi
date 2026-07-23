/**
 * Vercel serverless endpoint for public LPSE pages.
 * POST { sources: [{name, baseUrl}], limit?: number }
 * This is intentionally conservative: no login, CAPTCHA bypass, or retries.
 */
const DEFAULT_SOURCES = [
  { name: 'LPSE Kota Tanjungpinang', baseUrl: 'https://lpse.tanjungpinangkota.go.id/eproc4' },
  { name: 'LPSE Kota Batam', baseUrl: 'https://lpsekotabatam.com' },
  { name: 'LPSE Provinsi Kepulauan Riau', baseUrl: 'https://lpse.kepriprov.go.id/eproc4' }
];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = text => text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const absolute = (base, href) => new URL(href, base).toString();

async function getPublicPage(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'KontrakKepri/1.0 (public procurement research; contact: admin@example.invalid)' },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function eprocBase(url) {
  const parsed = new URL(url);
  return parsed.pathname.includes('/eproc4') ? `${parsed.origin}/eproc4` : `${parsed.origin}/eproc4`;
}

function findTenderRows(payload, baseUrl, max) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map(row => {
    const html = Array.isArray(row) ? row.join(' ') : JSON.stringify(row);
    const id = html.match(/(?:lelang|evaluasi)\/(\d+)/i)?.[1] || html.match(/\b(\d{5,})\b/)?.[1];
    return { id, label: clean(html), raw: html };
  }).filter(item => item.id && /konstruksi|pembangunan|rehabilitasi|jalan|drainase|gedung|irigasi/i.test(item.label)).slice(0, max);
}

function extractWinner(html) {
  const text = clean(html);
  const match = text.match(/(?:nama pemenang|pemenang|nama penyedia)\s*[:\-]?\s*([A-Z][A-Z0-9 .,&()'\/-]{4,100})/i);
  return match ? match[1].trim() : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const sources = Array.isArray(req.body?.sources) ? req.body.sources : DEFAULT_SOURCES;
  const limit = Math.min(Math.max(Number(req.body?.limit) || 10, 1), 20);
  const results = [], logs = [];
  for (const source of sources) {
    try {
      const baseUrl = eprocBase(source.baseUrl);
      // SPSE memuat tabel tender melalui endpoint DataTables, bukan HTML beranda.
      const query = new URLSearchParams({ draw: '1', start: '0', length: String(Math.max(limit * 3, 20)), 'search[value]': '' });
      const listing = await getPublicPage(`${baseUrl}/dt/lelang?${query}`);
      const tenders = findTenderRows(JSON.parse(listing), baseUrl, limit);
      for (const tender of tenders) {
        await wait(850); // rate limit per portal
        try {
          const detailUrl = `${baseUrl}/evaluasi/${tender.id}/pemenangberkontrak`;
          const detail = await getPublicPage(detailUrl);
          const company = extractWinner(detail);
          if (company) results.push({ company, package: tender.label, source: source.name, sourceUrl: detailUrl, fetchedAt: new Date().toISOString() });
        } catch { /* skip inaccessible individual public page */ }
      }
      logs.push({ source: source.name, status: 'ok', packagesChecked: tenders.length });
    } catch (error) { logs.push({ source: source.name, status: 'failed', message: error.message }); }
  }
  const unique = [...new Map(results.map(row => [`${row.company}|${row.sourceUrl}`, row])).values()];
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ data: unique, logs });
}
