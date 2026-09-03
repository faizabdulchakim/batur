/**
 * @class Indonesian lip-sync processor (Bahasa Indonesia)
 * @author BATUR / Antigravity AI
 */
class LipsyncId {
  constructor() {
    // Pemetaan huruf Bahasa Indonesia ke Oculus Visemes (A, I, U, E, O + Konsonan)
    this.visemes = {
      'a': 'aa', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U',
      'b': 'PP', 'c': 'SS', 'd': 'DD', 'f': 'FF', 'g': 'kk',
      'h': 'kk', 'j': 'I', 'k': 'kk', 'l': 'nn', 'm': 'PP',
      'n': 'nn', 'p': 'PP', 'q': 'kk', 'r': 'RR', 's': 'SS',
      't': 'DD', 'v': 'FF', 'w': 'FF', 'x': 'SS', 'y': 'I', 'z': 'SS'
    };

    // Durasi relatif fonem Bahasa Indonesia
    this.visemeDurations = {
      'aa': 1.10, 'E': 0.95, 'I': 0.95, 'O': 1.05, 'U': 1.05,
      'PP': 1.00, 'SS': 1.10, 'DD': 0.95, 'FF': 0.95, 'kk': 1.05,
      'nn': 0.90, 'RR': 0.90, 'sil': 1.00
    };

    this.specialDurations = { ' ': 1.2, ',': 3.0, '.': 4.0, '?': 4.0, '!': 4.0, '-': 0.5 };

    this.numbers = [
      'nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam',
      'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'
    ];

    this.symbols = {
      '%': 'persen', '€': 'euro', '&': 'dan', '+': 'tambah',
      '$': 'dolar', '=': 'sama dengan', '@': 'at'
    };
    this.symbolsReg = /[%€&\+\$=@]/g;
  }

  numberToIndonesianWords(nStr) {
    let n = parseInt(nStr, 10);
    if (isNaN(n)) return nStr;
    if (n <= 11) return this.numbers[n];
    if (n < 20) return this.numbers[n - 10] + ' belas';
    if (n < 100) return this.numbers[Math.floor(n / 10)] + ' puluh' + (n % 10 !== 0 ? ' ' + this.numbers[n % 10] : '');
    if (n === 100) return 'seratus';
    if (n < 200) return 'seratus ' + this.numberToIndonesianWords((n % 100).toString());
    if (n < 1000) return this.numbers[Math.floor(n / 100)] + ' ratus' + (n % 100 !== 0 ? ' ' + this.numberToIndonesianWords((n % 100).toString()) : '');
    if (n === 1000) return 'seribu';
    if (n < 2000) return 'seribu ' + this.numberToIndonesianWords((n % 1000).toString());
    if (n < 1000000) return this.numberToIndonesianWords(Math.floor(n / 1000).toString()) + ' ribu' + (n % 1000 !== 0 ? ' ' + this.numberToIndonesianWords((n % 1000).toString()) : '');
    return nStr;
  }

  preProcessText(s) {
    return s.replace(/[#_*\'\":;]/g, '')
      .replace(this.symbolsReg, (symbol) => ' ' + this.symbols[symbol] + ' ')
      .replace(/\d+/g, (num) => this.numberToIndonesianWords(num))
      .replaceAll('  ', ' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
      .trim();
  }

  wordsToVisemes(w) {
    const o = { words: w, visemes: [], times: [], durations: [] };
    let t = 0;
    const chars = [...w];

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i].toLowerCase();
      const viseme = this.visemes[char];

      if (viseme) {
        if (o.visemes.length && o.visemes[o.visemes.length - 1] === viseme) {
          const d = 0.7 * (this.visemeDurations[viseme] || 1);
          o.durations[o.durations.length - 1] += d;
          t += d;
        } else {
          const d = this.visemeDurations[viseme] || 1;
          o.visemes.push(viseme);
          o.times.push(t);
          o.durations.push(d);
          t += d;
        }
      } else {
        t += this.specialDurations[char] || 0;
      }
    }

    return o;
  }
}

export { LipsyncId };
