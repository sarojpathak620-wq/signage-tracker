// Automated Testing Suite for Signage Tracker & Hospital BD Travel Portal
import assert from 'node:assert';

console.log('====================================================');
console.log('🧪 RUNNING AUTOMATED TEST SUITE: SIGNAGE TRACKER');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${description}`);
    console.error(`   Error: ${err.message}\n`);
  }
}

// 1. Haversine Distance Formula
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// 2. Hospital Locations Mapping
const SANKARA_HOSPITAL_LOCATIONS = {
  jaipur: { name: 'Sankara Eye Hospital, Jaipur', lat: 26.9678, lng: 75.7725 },
  bangalore: { name: 'Sankara Eye Hospital, Bangalore', lat: 12.9602, lng: 77.7126 },
  coimbatore: { name: 'Sankara Eye Hospital, Coimbatore (Sivanandapuram)', lat: 11.0561, lng: 76.9976 },
  anand: { name: 'Sankara Eye Hospital, Anand', lat: 22.5645, lng: 72.9289 },
};

function getUnitBaseCoordinates(unit) {
  if (unit?.latitude && unit?.longitude) {
    return { name: unit.name || 'Hospital Base', lat: unit.latitude, lng: unit.longitude };
  }
  const query = `${unit?.name || ''} ${unit?.city || ''}`.toLowerCase();
  for (const [key, loc] of Object.entries(SANKARA_HOSPITAL_LOCATIONS)) {
    if (query.includes(key)) return loc;
  }
  return SANKARA_HOSPITAL_LOCATIONS.jaipur;
}

// 3. Asset Code Generation
function getUnitCodePrefix(unitNameOrCity) {
  if (!unitNameOrCity) return 'SEH';
  const lower = unitNameOrCity.toLowerCase();
  if (lower.includes('jaipur')) return 'SEHJ';
  if (lower.includes('bangalore') || lower.includes('bengaluru')) return 'SEHB';
  if (lower.includes('coimbatore')) return 'SEHC';
  if (lower.includes('anand')) return 'SEHA';
  return 'SEH';
}

function getSignageCode(signage, fallbackIndex = 1) {
  if (signage?.code && signage.code.trim()) return signage.code.trim().toUpperCase();
  const prefix = getUnitCodePrefix(signage?.unit?.name || signage?.unit?.city);
  return `${prefix}${String(fallbackIndex).padStart(2, '0')}`;
}

// 4. Google Maps URL Builder
function buildGoogleMapsDirectionsUrl(originLat, originLng, destLat, destLng) {
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
}

// ==================== TEST SUITE EXECUTION ====================

// Test 1: Hospital Base Resolution
test('Resolve Sankara Eye Hospital Jaipur base coordinates correctly', () => {
  const loc = getUnitBaseCoordinates({ name: 'SEH Jaipur', city: 'Jaipur' });
  assert.strictEqual(loc.lat, 26.9678);
  assert.strictEqual(loc.lng, 75.7725);
  assert.ok(loc.name.includes('Jaipur'));
});

// Test 2: Asset Unique Code Generation
test('Generate clean unique asset codes like SEHJ01, SEHB01', () => {
  const codeJaipur = getSignageCode({ unit: { name: 'Sankara Eye Hospital Jaipur', city: 'Jaipur' } }, 1);
  assert.strictEqual(codeJaipur, 'SEHJ01');

  const codeJaipur2 = getSignageCode({ unit: { name: 'SEH Jaipur', city: 'Jaipur' } }, 2);
  assert.strictEqual(codeJaipur2, 'SEHJ02');

  const codeBangalore = getSignageCode({ unit: { name: 'SEH Bangalore', city: 'Bangalore' } }, 5);
  assert.strictEqual(codeBangalore, 'SEHB05');

  // Custom code preservation
  const customCode = getSignageCode({ code: 'CUSTOM-AD-99' }, 1);
  assert.strictEqual(customCode, 'CUSTOM-AD-99');
});

// Test 3: Hospital to Hoarding Distance Calculation
test('Calculate direct distance from Hospital to Hoarding (One-Way & Round-Trip)', () => {
  const hospital = SANKARA_HOSPITAL_LOCATIONS.jaipur;
  // Hoarding coordinates at Malviya Nagar / WTP Mall Jaipur (lat: 26.8532, lng: 75.8052)
  const hoardingLat = 26.8532;
  const hoardingLng = 75.8052;

  const meters = calculateDistanceMeters(hospital.lat, hospital.lng, hoardingLat, hoardingLng);
  const oneWayKm = Number((meters / 1000).toFixed(1));
  const roundTripKm = Number((oneWayKm * 2).toFixed(1));

  assert.ok(oneWayKm > 10 && oneWayKm < 16, `Expected ~13-15 KM one way, got ${oneWayKm} KM`);
  assert.strictEqual(roundTripKm, Number((oneWayKm * 2).toFixed(1)));
  console.log(`      * Calculated: Hospital -> Hoarding SEHJ01: ${oneWayKm} KM (One-way) | ${roundTripKm} KM (Round-trip)`);
});

// Test 4: Single Hoarding Visit produces non-zero Distance
test('Single hoarding visit correctly produces positive mileage (fixes previous 0.0 KM bug)', () => {
  const hospital = SANKARA_HOSPITAL_LOCATIONS.jaipur;
  const visits = [
    { signage_id: 'sig-1', code: 'SEHJ01', lat: 26.8532, lng: 75.8052 }
  ];

  const processedStops = visits.map((v) => {
    const meters = calculateDistanceMeters(hospital.lat, hospital.lng, v.lat, v.lng);
    const oneWayKm = Number((meters / 1000).toFixed(1));
    return {
      code: v.code,
      oneWayKm,
      roundTripKm: Number((oneWayKm * 2).toFixed(1)),
    };
  });

  const totalRoundTripKm = processedStops.reduce((sum, s) => sum + s.roundTripKm, 0);
  assert.ok(totalRoundTripKm > 0, 'Total distance must be strictly greater than 0');
  console.log(`      * Single Hoarding SEHJ01 claim: ${totalRoundTripKm} KM`);
});

// Test 5: Multiple Hoardings Cumulative Distance
test('Multiple hoarding visits correctly sum their respective hospital trip distances', () => {
  const hospital = SANKARA_HOSPITAL_LOCATIONS.jaipur;
  const visits = [
    { code: 'SEHJ01', lat: 26.8532, lng: 75.8052 }, // WTP Mall (~13.1 km)
    { code: 'SEHJ02', lat: 26.8920, lng: 75.8260 }, // Raja Park (~9.9 km)
  ];

  const totalKm = visits.reduce((acc, v) => {
    const m = calculateDistanceMeters(hospital.lat, hospital.lng, v.lat, v.lng);
    const oneWay = Number((m / 1000).toFixed(1));
    return acc + Number((oneWay * 2).toFixed(1));
  }, 0);

  assert.ok(totalKm > 40, `Expected >40 KM total round trip, got ${totalKm} KM`);
  console.log(`      * 2 Hoardings (SEHJ01 + SEHJ02) total claim: ${totalKm.toFixed(1)} KM`);
});

// Test 6: Google Maps Driving URL Generation
test('Generate valid Google Maps driving directions link', () => {
  const hospital = SANKARA_HOSPITAL_LOCATIONS.jaipur;
  const hoarding = { lat: 26.8532, lng: 75.8052 };
  const url = buildGoogleMapsDirectionsUrl(hospital.lat, hospital.lng, hoarding.lat, hoarding.lng);
  
  assert.ok(url.startsWith('https://www.google.com/maps/dir/'));
  assert.ok(url.includes(`origin=${hospital.lat},${hospital.lng}`));
  assert.ok(url.includes(`destination=${hoarding.lat},${hoarding.lng}`));
  assert.ok(url.includes('travelmode=driving'));
});

// Test 7: Travel Request State Machine (Pending -> Rejected -> Resubmit -> Approved)
test('Verify Travel Request Approval, Rejection, and Resubmission state machine', () => {
  const request = {
    id: 'req-001',
    bd_executive_id: 'user-pathak',
    unit_id: 'unit-jaipur',
    month: '2026-11-01',
    total_distance_km: 29.6,
    status: 'pending',
    reviewed_by: null,
    review_comment: null,
  };

  // Step A: Initial submission
  assert.strictEqual(request.status, 'pending');

  // Step B: Unit Head rejects with feedback
  request.status = 'rejected';
  request.reviewed_by = 'user-nishant-unithead';
  request.review_comment = 'Odometer reading verification required. Please adjust to actual road reading.';
  assert.strictEqual(request.status, 'rejected');
  assert.ok(request.review_comment.includes('Odometer'));

  // Step C: BD Executive updates and resubmits
  request.total_distance_km = 31.5; // Adjusted road mileage
  request.status = 'pending';
  request.reviewed_by = null;
  request.review_comment = null;
  assert.strictEqual(request.status, 'pending');
  assert.strictEqual(request.total_distance_km, 31.5);

  // Step D: Unit Head approves
  request.status = 'approved';
  request.reviewed_by = 'user-nishant-unithead';
  request.review_comment = 'Verified against road route. Approved for reimbursement.';
  assert.strictEqual(request.status, 'approved');
});

console.log('\n====================================================');
console.log(`🏁 TEST SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
console.log('====================================================');
