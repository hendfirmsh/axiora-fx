export interface MarketSnapshot {
  symbol: string;
  label: string;
  value: string;
  change: string;
  direction: 'up' | 'down' | 'flat';
}

export interface IntelligenceCard {
  eyebrow: string;
  title: string;
  summary: string;
  meta: string;
  href: string;
}

export const MARKET_SNAPSHOTS: MarketSnapshot[] = [
  { symbol: 'USD/IDR', label: 'Rupiah', value: '16.275', change: '+0,18%', direction: 'up' },
  { symbol: 'XAU/USD', label: 'Emas spot', value: '2.364', change: '+0,42%', direction: 'up' },
  { symbol: 'IHSG', label: 'Indonesia', value: '7.214', change: '-0,31%', direction: 'down' },
  { symbol: 'BRENT', label: 'Minyak', value: '82,16', change: '0,00%', direction: 'flat' },
];

export const INTELLIGENCE_CARDS: IntelligenceCard[] = [
  {
    eyebrow: 'Macro / 6 menit',
    title: 'Membaca dolar kuat tanpa mengabaikan konteks domestik',
    summary:
      'Kerangka sederhana untuk memisahkan tekanan dolar global, arus modal, dan faktor spesifik rupiah.',
    meta: 'Ditinjau 4 Agustus 2026',
    href: '/topics/usd/',
  },
  {
    eyebrow: 'Gold / 5 menit',
    title: 'Mengapa emas dan yield dapat bergerak berlawanan',
    summary:
      'Hubungan emas, yield riil, risiko geopolitik, dan ekspektasi kebijakan tidak selalu linear.',
    meta: 'Ditinjau 3 Agustus 2026',
    href: '/topics/gold/',
  },
  {
    eyebrow: 'Inflation / 8 menit',
    title: 'Inflasi headline turun, apa yang belum selesai?',
    summary:
      'Periksa komponen inti, pangan, dan transmisi harga sebelum menyimpulkan perubahan tren.',
    meta: 'Ditinjau 2 Agustus 2026',
    href: '/topics/inflation/',
  },
];

export const MACRO_CALENDAR = [
  { time: '07:00 WIB', region: 'ID', event: 'Pertumbuhan PDB kuartalan', importance: 'Tinggi' },
  { time: '19:30 WIB', region: 'US', event: 'Initial jobless claims', importance: 'Sedang' },
  { time: '21:00 WIB', region: 'US', event: 'Inventori wholesale', importance: 'Rendah' },
];
