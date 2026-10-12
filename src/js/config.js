// Saytın dəyişən məlumatları bir yerdə. Mətnlər isə src/i18n/*.json-dadır.
export const CONFIG = {
  phone: '+994555303532',
  waNumber: '994555303532',

  // Studiyanın yeri. Ünvan mətni i18n-dədir (contact.address).
  coords: { lat: 40.411221, lng: 49.857947 },
  // Google Business profili yaradılanda onun linkini bura yaz
  mapsUrl: null,
  wazeUrl: 'https://waze.com/ul/htp5mys9kw',

  instagram: {
    // Worker qoşulanda: 'https://<worker-adı>.workers.dev/api/instagram' (README-yə bax)
    endpoint: null,
    // true → endpoint yoxdursa placeholder kafellər görünür (yalnız dizayn yoxlaması üçün).
    // false + endpoint yoxdur → bölmə gizlidir (hazırkı qərar, 2026-10-12)
    demo: false,
    limit: 8,
  },

  // Hazır GLB modeli gələndə: 'models/mic.glb' (public/models/ qovluğuna qoy). null → kodla qurulan model
  micModelUrl: null,
};
