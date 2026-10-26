import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  googleMapsEmbedUrl,
  googleMapsItineraireUrl,
  normalizePlanRoute,
  parseCoordonnees,
} from '../dist/index.js';

describe('Plan de route — coordonnées', () => {
  test('saisie décimale (virgule, espace, point-virgule)', () => {
    assert.deepEqual(parseCoordonnees('-4.3217, 15.3125'), { lat: -4.3217, lng: 15.3125 });
    assert.deepEqual(parseCoordonnees('-4.3217 15.3125'), { lat: -4.3217, lng: 15.3125 });
    assert.deepEqual(parseCoordonnees(' -4.3217;15.3125 '), { lat: -4.3217, lng: 15.3125 });
  });

  test('liens Google Maps', () => {
    assert.deepEqual(
      parseCoordonnees('https://www.google.com/maps/@-4.3217,15.3125,17z'),
      { lat: -4.3217, lng: 15.3125 },
    );
    assert.deepEqual(
      parseCoordonnees('https://maps.google.com/?q=-4.3217,15.3125'),
      { lat: -4.3217, lng: 15.3125 },
    );
    assert.deepEqual(
      parseCoordonnees(
        'https://www.google.com/maps/place/March%C3%A9/@-4.33,15.30,17z/data=!3m1!4b1!4m6!3m5!8m2!3d-4.3217!4d15.3125',
      ),
      { lat: -4.3217, lng: 15.3125 },
    );
  });

  test('saisies invalides', () => {
    assert.equal(parseCoordonnees(''), null);
    assert.equal(parseCoordonnees('Kinshasa'), null);
    assert.equal(parseCoordonnees('95, 15'), null);
    assert.equal(parseCoordonnees('-4, 200'), null);
    assert.equal(parseCoordonnees('0, 0'), null);
  });

  test('URLs Google', () => {
    const g = { lat: -4.3217, lng: 15.3125 };
    assert.equal(googleMapsEmbedUrl(g), 'https://www.google.com/maps?q=-4.3217,15.3125&z=17&output=embed');
    assert.equal(
      googleMapsItineraireUrl(g),
      'https://www.google.com/maps/dir/?api=1&destination=-4.3217,15.3125',
    );
  });
});

describe('Plan de route — compatibilité', () => {
  test('ancien format : GPS conservé, adresse reprise dans le repère', () => {
    const d = normalizePlanRoute({
      dateEtablissement: '2026-10-01',
      agent: 'X',
      activite: {
        avenue: 'Ngungu',
        numero: '99',
        quartier: 'Pende',
        commune: 'Kinshasa',
        reference: 'face au marché',
        gps: { lat: -4.3217, lng: 15.3125, precisionM: 12, capturedAt: '2026-10-01T10:00:00Z' },
      },
      domicile: {},
    });
    assert.equal(d.activite.gps?.lat, -4.3217);
    assert.equal(d.activite.repere, 'Av. Ngungu n°99 Q/Pende C/Kinshasa face au marché');
    assert.equal(d.domicile.gps, null);
    assert.equal(d.domicile.repere, '');
    assert.ok(!('agent' in d));
  });
});
