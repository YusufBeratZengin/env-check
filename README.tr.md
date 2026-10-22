# env-check

Ortam değişkenlerini ve `.env` dosyalarını `.env.example` veya `env.schema.json` dosyasında tanımlanan bir şemaya göre, gizli değerleri asla ekrana yazdırmadan doğrulayın.

Uygulamalar, eksik veya hatalı biçimlendirilmiş ortam değişkenleri nedeniyle CI süreçlerinde ya da canlı ortamda sıkça çöker. Hata ayıklama sırasında geliştiriciler `.env` içeriğini terminale yazdırarak gizli anahtarları loglara sızdırabilir. `env-check`, bu iki problemi sıfır harici bağımlılıkla çözer: uygulama başlangıcında ve CI aşamasında güçlü şema doğrulaması sunarken hassas değerleri kesin olarak gizler.

## Öne Çıkan Özellikler

- Sıfır çalışma zamanı bağımlılığı: Tamamen Node.js standart kütüphanesi üzerine inşa edilmiştir.
- Gizlilik garantisi: `@secret` olarak işaretlenen veya hassas kabul edilen değişkenler konsola, hata mesajlarına, diff çıktılarına veya şablonlara asla yazdırılmaz; bunun yerine karakter uzunluğu ve sabit bir maske (`[SECRET len=24] ********`) gösterilir.
- Kendi dotenv ayrıştırıcısı: Tek tırnak, çift tırnak, kaçış karakterleri (`\n`, `\t`, `\"`, `\\`), çok satırlı değerler, `export` öneki, yorum satırları ve isteğe bağlı `${VAR}` genişletmesi desteği.
- Yorum satırlarıyla şema tanımlama: Tip, zorunluluk, varsayılan değer ve regex kurallarını doğrudan `.env.example` içerisindeki yorumlarla tanımlayın.
- JSON şema desteği: `env.schema.json` üzerinden standart JSON Schema ile doğrulama.
- Erken güvenlik uyarısı: `.env` dosyasının Git tarafından takip edilip edilmediğini (`git ls-files`) denetler ve depoya eklenmişse uyarır.
- Yer tutucu (placeholder) tespiti: `changeme`, `xxx`, `<...>` veya `your_api_key_here` gibi unutulmuş taslak değerleri algılar ve reddeder.
- CI uyumlu CLI: Otomasyon ve sürekli entegrasyon süreçleri için standart çıkış kodları.
- Kütüphane API'si: Uygulama başlangıcında tipleri dönüştürülmüş (`number`, `boolean`, `string`, ms cinsinden `duration`) yapılandırma nesnesi döner.

## Gereksinimler

- Node.js >= 20.0.0

## Kurulum

```bash
# Global CLI kullanımı
npm install -g env-check

# Veya proje bazında kurulum
npm install env-check
```

Ya da doğrudan `npx` ile çalıştırın:

```bash
npx env-check check
```

## `.env.example` İçinde Şema Tanımı

Değişken tanımlarının hemen üstüne ilgili direktifleri yorum satırı olarak ekleyin:

```bash
# Web servisi HTTP portu
# @type port
# @default 3000
PORT=3000

# Çalışma ortamı
# @type enum(development, staging, production)
# @default development
NODE_ENV=development

# Veritabanı bağlantı adresi
# @type url
# @secret
# @required
DATABASE_URL=

# Yönetici bildirim e-postası
# @type email
# @required
ADMIN_EMAIL=

# Önbellek yaşam süresi
# @type duration
# @default 15m
CACHE_TTL=15m

# Belirli desene uyması gereken API anahtarı
# @pattern /^sk_[a-z0-9]{24}$/
# @secret
# @required
STRIPE_SECRET_KEY=

# İsteğe bağlı özellik anahtarı
# @type bool
# @default false
ENABLE_FEATURE_FLAGS=false
```

### Desteklenen Direktifler

| Direktif | Açıklama | Örnek |
| -------- | -------- | ----- |
| `# @type <tip>` | Değer tipi (`url`, `int`, `bool`, `enum(...)`, `email`, `port`, `duration`, `string`) | `# @type port` |
| `# @required` | Değişkenin tanımlı ve dolu olması zorunludur | `# @required` |
| `# @optional` | Varsayılan değer olmasa bile değişken isteğe bağlıdır | `# @optional` |
| `# @default <değer>` | Değişken eksikse kullanılacak varsayılan değer | `# @default 3000` |
| `# @secret` | Değerin konsol çıktılarında ve hata mesajlarında kesinlikle gizlenmesini sağlar | `# @secret` |
| `# @pattern <regex>` | Düzenli ifade (regex) doğrulaması uygular | `# @pattern /^sk_[a-z0-9]+$/` |

### Desteklenen Tipler

- `port`: 1 ile 65535 arasında tam sayı.
- `int` / `integer`: Geçerli tam sayı.
- `bool` / `boolean`: `true`, `false`, `1`, `0`, `yes`, `no` değerlerini kabul eder ve JavaScript boolean türüne dönüştürür.
- `enum(değer1, değer2, ...)`: Belirtilen seçeneklerden birine eşit olmalıdır.
- `url`: Geçerli protokol içeren URL (`http`, `https`, `postgres`, `redis` vb.).
- `email`: Geçerli e-posta adresi formatı.
- `duration`: Süre ifadesi (`500ms`, `10s`, `5m`, `2h`, `1d`, `1w`, `1y`) veya milisaniye. Milisaniyeye dönüştürülür.
- `string`: Herhangi bir metin değeri.

## JSON Schema Desteği (`env.schema.json`)

Alternatif olarak ortam şemanızı standart JSON Schema ile tanımlayabilirsiniz:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["PORT", "DATABASE_URL"],
  "properties": {
    "PORT": {
      "type": "integer",
      "default": 3000,
      "description": "HTTP portu"
    },
    "DATABASE_URL": {
      "type": "string",
      "format": "uri",
      "secret": true
    },
    "NODE_ENV": {
      "type": "string",
      "enum": ["development", "staging", "production"],
      "default": "development"
    }
  }
}
```

## Komut Satırı Kullanımı (CLI)

### 1. `check` (varsayılan komut)

Ortam değişkenlerini ve `.env` dosyalarını şemaya göre denetler.

```bash
# .env dosyasını .env.example şemasına göre doğrular
env-check check

# Özel env dosyaları ve şema yolu belirtme
env-check check -e .env -e .env.local -x .env.example

# JSON şema dosyası ile doğrulama
env-check check -s env.schema.json

# Uyarıları hata olarak kabul etme (katı mod)
env-check check --strict

# CI raporlaması için JSON formatında çıktı
env-check check --json

# Gizli olmayan değerleri açık gösterme (gizli değerler yine de maskelenir)
env-check check --no-mask

# Değişken genişletmeyi etkinleştirme (${VAR})
env-check check --expand
```

#### Çıkış Kodları

| Kod | Anlamı |
| --- | ------ |
| `0` | Başarılı: Tüm değişkenler şemaya uygundur. |
| `1` | Başarısız: Eksik zorunlu değişken, tip uyumsuzluğu, yer tutucu tespiti veya katı mod uyarısı. |
| `2` | Hata: Şema dosyası bulunamadı, geçersiz sözdizimi veya çalışma hatası. |

### 2. `example`

Mevcut bir `.env` dosyasından tüm sırları temizlenmiş temiz bir `.env.example` dosyası üretir. Tipleri otomatik çıkarır ve şema direktiflerini ekler.

```bash
# .env dosyasından .env.example oluşturma
env-check example

# Giriş ve çıkış dosyası belirtme
env-check example -i .env.production -o .env.example

# Doğrudan terminal çıktısına yazdırma
env-check example --stdout
```

### 3. `diff`

İki `.env` dosyasının anahtarlarını karşılaştırır. Değerleri asla ifşa etmeden eksik ve farklı anahtarları listeler.

```bash
env-check diff .env.development .env.production
```

Örnek çıktı:

```
Comparing: .env.development <-> .env.production

(-) Only in .env.development (1):
  - DEBUG_TOOLBAR

(+) Only in .env.production (1):
  + SENTRY_DSN

(=) Common keys (3):
  = PORT (both set)
  = DATABASE_URL (both set)
  = REDIS_CACHE (empty in .env.development, set in .env.production)
```

## Kütüphane Olarak Kullanım

Uygulama açılışında yapılandırmayı doğrulamak için `env-check` doğrudan içe aktarılabilir:

```javascript
import { validateEnv } from 'env-check';

// process.env ve .env dosyasını .env.example'a göre doğrular
const { valid, config, errors, warnings } = validateEnv({
  example: '.env.example',
  throwOnError: true // Hata durumunda ValidationError fırlatır
});

// Tipleri dönüştürülmüş yapılandırma nesnesi:
console.log(config.PORT);       // number: 3000
console.log(config.CACHE_TTL);  // number (ms): 900000
console.log(config.DEBUG);      // boolean: false
```

### Gelişmiş Seçenekler

```javascript
import { validateEnv } from 'env-check';

const result = validateEnv({
  example: '.env.example',           // Şema dosyası
  schemaFile: 'env.schema.json',     // Veya JSON şema yolu
  files: ['.env', '.env.local'],     // Sırayla yüklenecek dosyalar
  system: true,                      // process.env'i dahil et (varsayılan: true)
  strict: true,                      // Uyarıları hata say
  expand: true,                      // ${VAR} genişletmesini etkinleştir
  checkGit: true,                    // .env git tarafından izleniyorsa uyar
  throwOnError: false                // Hata fırlatmak yerine liste dön
});

if (!result.valid) {
  for (const err of result.errors) {
    console.error(`${err.key}: ${err.message}`);
  }
  process.exit(1);
}
```

## Gizlilik ve Maskeleme İlkeleri

Güvenlik ve sırların korunması `env-check`'in temel ilkesidir:

1. `# @secret` ile işaretlenmiş veya hassas anahtar adına sahip tüm değerler `[SECRET len=24] ********` biçiminde gösterilir.
2. Ham gizli değerler hata mesajlarında, terminal çıktılarında veya JSON özetlerinde kesinlikle yer almaz.
3. `--no-mask` seçeneği kullanılsa bile `@secret` alanları gizli kalmaya devam eder.
4. `diff` işlemi yalnızca anahtar adlarını ve durumları (dolu/boş) karşılaştırır; değerler asla okunmaz veya gösterilmez.

## Katkıda Bulunma

Geliştirme ve test kuralları için lütfen [CONTRIBUTING.md](CONTRIBUTING.md) belgesini inceleyin.

## Lisans

MIT Lisansı. Telif Hakkı (c) 2026 Yusuf Berat Zengin. Ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.
