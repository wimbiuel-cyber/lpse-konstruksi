let companies = [
  { name:'PT Cipta Karya Tanjungpinang', city:'Tanjungpinang', address:'Bukit Bestari, Tanjungpinang', work:'Rehabilitasi Gedung Pemerintah', source:'LPSE Kota Tanjungpinang', year:'2025', url:'https://lpse.tanjungpinangkota.go.id/eproc4' },
  { name:'CV Tunas Bahari Konstruksi', city:'Tanjungpinang', address:'Tanjungpinang Timur', work:'Pembangunan Drainase Lingkungan', source:'LPSE Kota Tanjungpinang', year:'2025', url:'https://lpse.tanjungpinangkota.go.id/eproc4' },
  { name:'PT Bintang Samudra Persada', city:'Batam', address:'Batam Kota, Batam', work:'Peningkatan Jalan Lingkungan', source:'LPSE Kota Batam', year:'2026', url:'https://lpsekotabatam.com/' },
  { name:'CV Anugerah Mitra Utama', city:'Tanjungpinang', address:'Tanjungpinang Barat', work:'Pembangunan Sarana Air Bersih', source:'LPSE Provinsi Kepulauan Riau', year:'2025', url:'https://lpse.kepriprov.go.id/eproc4' },
  { name:'PT Artha Konstruksi Kepri', city:'Batam', address:'Sekupang, Batam', work:'Pemeliharaan Berkala Jalan', source:'LPSE Provinsi Kepulauan Riau', year:'2024', url:'https://lpse.kepriprov.go.id/eproc4' },
  { name:'CV Cemerlang Karya Mandiri', city:'Tanjungpinang', address:'Tanjungpinang Kota', work:'Pembangunan Bangunan Gedung', source:'LPSE Kota Tanjungpinang', year:'2024', url:'https://lpse.tanjungpinangkota.go.id/eproc4' }
];
const $ = s => document.querySelector(s);
let filtered = [...companies];
function selectedSources(){return [...document.querySelectorAll('.source-card input:checked')].map(x=>x.value)}
function render(){
 const key=$('#keyword').value.toLowerCase(), city=$('#city').value, year=$('#period').value, sources=selectedSources();
 filtered=companies.filter(c=>sources.includes(c.source)&&(!key||Object.values(c).join(' ').toLowerCase().includes(key))&&(city==='all'||(city==='other'?!['Tanjungpinang','Batam'].includes(c.city):c.city.toLowerCase()===city))&&(year==='all'||c.year===year));
 $('#companyRows').innerHTML=filtered.map(c=>`<tr><td><span class="company">${c.name}</span><span class="detail">${c.address}</span></td><td>${c.city}</td><td>${c.work}<span class="detail"><span class="tag">KONSTRUKSI</span></span></td><td class="source">${c.source}</td><td>${c.year}</td><td><a class="link" href="${c.url}" target="_blank" rel="noreferrer" title="Lihat sumber">↗</a></td></tr>`).join('');
 $('#count').textContent=filtered.length; $('#empty').hidden=filtered.length>0; $('#sourceCount').textContent=sources.length; $('#locationCount').textContent=new Set(filtered.map(c=>c.city)).size; $('#latestDate').textContent=filtered.length?Math.max(...filtered.map(c=>c.year)):'—';
}
function toast(message){const x=$('#toast');x.textContent=message;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),3600)}
document.querySelectorAll('.source-card input').forEach(x=>x.addEventListener('change',()=>{x.closest('.source-card').classList.toggle('active',x.checked);render()}));
['#keyword','#city','#period'].forEach(s=>$(s).addEventListener(s==='#keyword'?'input':'change',render));
$('#resetBtn').onclick=()=>{$('#keyword').value='';$('#city').value='all';$('#period').value='all';document.querySelectorAll('.source-card input').forEach(x=>{x.checked=true;x.closest('.source-card').classList.add('active')});render()};
$('#refreshBtn').onclick=async()=>{
 const button=$('#refreshBtn'); button.disabled=true; button.innerHTML='<span>◌</span> Mengambil halaman publik…';
 try {
  const sources=[...document.querySelectorAll('.source-card input:checked')].map(input=>({name:input.value,baseUrl:input.closest('.source-card').querySelector('a').href}));
  const response=await fetch('/api/scrape',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sources,limit:10})});
  if(!response.ok) throw new Error('Endpoint scraper belum tersedia');
  const payload=await response.json();
  if(payload.data?.length){companies=payload.data.map(row=>({name:row.company,city:'Perlu verifikasi',address:'Lihat paket sumber',work:row.package,source:row.source,year:new Date(row.fetchedAt).getFullYear().toString(),url:row.sourceUrl}));render();toast(`${companies.length} perusahaan ditemukan dari halaman publik.`)}
  else toast('Tidak ada pemenang yang dapat diekstrak. Periksa log server atau portal sumber.');
 }catch(error){toast('Scraper belum terhubung. Jalankan via Vercel atau gunakan endpoint /api/scrape.');}
 finally{button.disabled=false;button.innerHTML='<span>↻</span> Ambil data terbaru';}
};
$('#exportBtn').onclick=()=>{const header=['Perusahaan','Domisili','Alamat','Paket','Sumber','Tahun'];const csv=[header,...filtered.map(c=>[c.name,c.city,c.address,c.work,c.source,c.year])].map(r=>r.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='perusahaan-konstruksi-kepri.csv';a.click();URL.revokeObjectURL(a.href);toast(`${filtered.length} baris diekspor ke CSV.`)};
$('#aboutBtn').onclick=()=>$('#aboutDialog').showModal();$('#closeAbout').onclick=()=>$('#aboutDialog').close();render();
