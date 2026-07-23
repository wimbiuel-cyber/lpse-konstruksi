# Kontrak Kepri

Prototipe dashboard untuk merapikan perusahaan pemenang pekerjaan konstruksi dari LPSE Kota Tanjungpinang, Kota Batam, dan Provinsi Kepulauan Riau. Buka `index.html` langsung di browser.

## Menjalankan scraper nyata

Antarmuka ini sengaja tidak mengambil halaman LPSE langsung dari browser: kebijakan CORS dan perubahan struktur SPSE akan membuatnya tidak stabil. Folder `api/scrape.js` menyediakan endpoint serverless `POST /api/scrape`. Deploy folder ini ke Vercel lalu tombol **Ambil data terbaru** akan memanggil endpoint tersebut.

Endpoint yang disertakan:

1. Mengambil hanya halaman tender publik yang relevan, dengan jeda 850 ms antarhalaman.
2. Membatasi maksimal 20 paket per sumber dan tidak mengakses halaman login/CAPTCHA.
3. Mengirim kembali nama pemenang yang ditemukan beserta paket, sumber, URL, dan waktu ambil.
4. Perlu disesuaikan jika struktur HTML SPSE berubah; alamat/domisi perusahaan tetap perlu diverifikasi dari sumber resmi.

Portal awal: [LPSE Tanjungpinang](https://lpse.tanjungpinangkota.go.id/eproc4), [LPSE Batam](https://lpsekotabatam.com/), dan [LPSE Kepri](https://lpse.kepriprov.go.id/eproc4).
