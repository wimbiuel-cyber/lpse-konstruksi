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
  // Portal SPSE nasional baru tidak memakai prefix /eproc4.
  if (parsed.hostname === 'spse.inaproc.id') return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
  return `${parsed.origin}/eproc4`;
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
  // Pada SPSE, label tabel berada sebelum nilai; cari badan usaha yang diikuti alamat.
  const company = text.match(/\b((?:CV|PT)\.\s*[A-Z][A-Z0-9 .,&()'\/-]{2,90}?)(?=\s+(?:JL\.?|JALAN|RT\/?RW|KOMP\.?|DS\.?|KEL\.?))/i);
  if (company) return company[1].trim();
  const fallback = text.match(/\b((?:CV|PT)\.\s*[A-Z][A-Z0-9 .,&()'\/-]{2,70})/i);
  return fallback ? fallback[1].trim() : null;
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return Response.json({ error: 'Gunakan POST.' }, { status: 405 });
    const body = await request.json().catch(() => ({}));
    const sources = Array.isArray(body.sources) ? body.sources : DEFAULT_SOURCES;
    const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 20);
    const results = [], logs = [];
    for (const source of sources) {
      try {
        const baseUrl = eprocBase(source.baseUrl);
        // SPSE memuat tabel tender melalui endpoint DataTables, bukan HTML beranda.
        const query = new URLSearchParams({ draw: '1', start: '0', length: String(Math.max(limit * 4, 40)), 'search[value]': '' });
        const listing = await getPublicPage(`${baseUrl}/dt/lelang?${query}`);
        const tenders = findTenderRows(JSON.parse(listing), baseUrl, limit);
        for (const tender of tenders) {
          await wait(850); // rate limit per portal
          try {
            // Pemenang belum tentu sudah berkontrak; cek keduanya.
            const winnerUrl = `${baseUrl}/evaluasi/${tender.id}/pemenang`;
            let detail = await getPublicPage(winnerUrl);
            let company = extractWinner(detail);
            let sourceUrl = winnerUrl;
            if (!company) {
              sourceUrl = `${baseUrl}/evaluasi/${tender.id}/pemenangberkontrak`;
              detail = await getPublicPage(sourceUrl);
              company = extractWinner(detail);
            }
            if (company) results.push({ company, package: tender.label, source: source.name, sourceUrl, fetchedAt: new Date().toISOString() });
          } catch { /* skip inaccessible individual public page */ }
        }
        logs.push({ source: source.name, status: 'ok', packagesChecked: tenders.length });
      } catch (error) { logs.push({ source: source.name, status: 'failed', message: error.message }); }
    }
    const unique = [...new Map(results.map(row => [`${row.company}|${row.sourceUrl}`, row])).values()];
    return Response.json({ data: unique, logs }, { headers: { 'Cache-Control': 'no-store' } });
  }
};
