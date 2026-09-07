// Backend API smoke test
const BASE = 'http://localhost:3001/api';

async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}

(async () => {
  let pass = 0, fail = 0;
  const check = (name, cond, extra) => {
    if (cond) { pass++; console.log('PASS', name); }
    else { fail++; console.log('FAIL', name, extra || ''); }
  };
  // unique per run so the suite is re-runnable
  const runId = Date.now().toString().slice(-6);
  const pendingEmail = `pending.doc.${runId}@test.com`;

  // health
  let r = await req('GET', '/health');
  check('health', r.status === 200 && r.json.status === 'ok');

  // unauthenticated blocked
  r = await req('GET', '/medicines/search?q=panadol');
  check('unauth blocked', r.status === 401);

  // login wrong password
  r = await req('POST', '/auth/login', { email: 'john@test.com', password: 'wrong' });
  check('login wrong password', r.status === 401 && /invalid email or password/i.test(r.json.error));

  // login success patient
  r = await req('POST', '/auth/login', { email: 'john@test.com', password: 'John@1234' });
  check('patient login', r.status === 200 && r.json.user.role === 'patient');
  const patientToken = r.json.token;
  const patientId = r.json.user.user_id;

  // me
  r = await req('GET', '/auth/me', null, patientToken);
  check('me endpoint', r.status === 200 && r.json.user.email === 'john@test.com');

  // duplicate registration
  r = await req('POST', '/auth/register', { role: 'patient', fullName: 'X', cnic: '35202-9999999-9', email: 'john@test.com', password: 'Test@1234', confirmPassword: 'Test@1234' });
  check('duplicate email rejected', r.status === 409);

  // invalid email
  r = await req('POST', '/auth/register', { role: 'patient', fullName: 'X', cnic: '35202-9999999-9', email: 'bademail', password: 'Test@1234', confirmPassword: 'Test@1234' });
  check('invalid email rejected', r.status === 400);

  // password mismatch
  r = await req('POST', '/auth/register', { role: 'patient', fullName: 'X', cnic: '35202-9999999-9', email: 'x@y.com', password: 'Test@1234', confirmPassword: 'Different@123' });
  check('password mismatch rejected', r.status === 400 && /match/i.test(r.json.error));

  // bad cnic
  r = await req('POST', '/auth/register', { role: 'patient', fullName: 'X', cnic: '12345', email: 'x@y.com', password: 'Test@1234', confirmPassword: 'Test@1234' });
  check('bad cnic rejected', r.status === 400 && /cnic/i.test(r.json.error));

  // suggest
  r = await req('GET', '/medicines/suggest?q=pana', null, patientToken);
  check('suggest panadol', r.status === 200 && r.json.suggestions.some((s) => /panadol/i.test(s.brand_name)));

  // search
  r = await req('GET', '/medicines/search?q=metronidazole', null, patientToken);
  check('search by ingredient', r.status === 200 && r.json.results.length >= 2);

  r = await req('GET', '/medicines/search?q=512900', null, patientToken);
  check('search by batch number', r.status === 200 && r.json.results.length >= 1);

  // smart search: exact name still works
  r = await req('GET', '/medicines/search/smart?q=Panadol', null, patientToken);
  check(
    'smart search exact name',
    r.status === 200 &&
      r.json.semantic_available === true &&
      r.json.results.length >= 1 &&
      /panadol/i.test(r.json.results[0].brand_name)
  );

  // smart search: natural-language symptom query returns relevant medicines
  r = await req('GET', '/medicines/search/smart?q=' + encodeURIComponent('medicine for fever and headache'), null, patientToken);
  check(
    'smart search natural language',
    r.status === 200 &&
      r.json.results.some((x) => /panadol|brufen/i.test(x.brand_name)) &&
      !r.json.results.some((x) => /zyrtec|ventolin/i.test(x.brand_name))
  );

  // smart search: unrelated query returns nothing and a clear message
  r = await req('GET', '/medicines/search/smart?q=' + encodeURIComponent('rocket fuel'), null, patientToken);
  check(
    'smart search unrelated query',
    r.status === 200 && r.json.results.length === 0 && /no suitable medicine/i.test(r.json.message)
  );

  // patient save prescription
  r = await req('POST', '/prescriptions/patient', { title: 'My Prescription', details: 'Panadol 500mg TDS' }, patientToken);
  check('patient save prescription', r.status === 201);
  const prescId = r.json.prescription ? r.json.prescription.prescription_id : null;

  // patient list + ownership
  r = await req('GET', '/prescriptions/patient', null, patientToken);
  check('patient list prescriptions', r.status === 200 && r.json.prescriptions.length >= 1);

  // dashboard
  r = await req('GET', '/history/dashboard', null, patientToken);
  check('patient dashboard stats', r.status === 200 && Number(r.json.stats.total_prescriptions) >= 1);

  // search history
  r = await req('GET', '/history/search', null, patientToken);
  check('search history logged', r.status === 200 && r.json.history.length >= 1);

  // retailers
  r = await req('GET', '/medicines/retailers/nearby', null, patientToken);
  check('retailers list', r.status === 200 && r.json.retailers.length >= 10);

  // cross-user privacy: jane cannot read john's prescription
  r = await req('POST', '/auth/login', { email: 'jane@test.com', password: 'Jane@1234' });
  check('doctor login', r.status === 200 && r.json.user.role === 'doctor');
  const doctorToken = r.json.token;
  if (prescId) {
    r = await req('GET', `/prescriptions/patient/${prescId}`, null, doctorToken);
    check('cross-user prescription blocked (403/404)', r.status === 403 || r.status === 404);
  }

  // doctor: analyze prescription with unsafe medicine
  const unsafeRx = 'NOVIDAT 500mg Tablets\nPanadol 500mg Tablet';
  r = await req('POST', '/prescriptions/analyze', { content: unsafeRx }, doctorToken);
  check('analyze unsafe prescription', r.status === 200 && r.json.all_safe === false && r.json.items.length === 2);
  const novidat = r.json.items.find((i) => /novidat/i.test(i.line));
  check('novidat detected spurious', novidat && novidat.safety_status === 'spurious');
  const panadol = r.json.items.find((i) => /panadol/i.test(i.line));
  check('panadol detected active', panadol && panadol.safe === true);

  // doctor: create folder + draft
  r = await req('POST', '/prescriptions/files', { patientName: 'Test Patient' }, doctorToken);
  if (r.status === 409) {
    r = await req('GET', '/prescriptions/files', null, doctorToken);
    var fileId = r.json.files.find((f) => f.patient_name === 'Test Patient').file_id;
  } else {
    check('create patient folder', r.status === 201);
    var fileId = r.json.file.file_id;
  }
  r = await req('POST', '/prescriptions/draft', { fileId, content: unsafeRx }, doctorToken);
  check('save draft', r.status >= 200 && r.status < 300 && r.json.analysis.all_safe === false);

  // print blocked when unsafe
  r = await req('POST', '/prescriptions/print', { fileId, content: unsafeRx }, doctorToken);
  check('print blocked for unsafe rx', r.status === 422);

  // all-safe prescription
  const safeRx = 'Panadol 500mg Tablet\nBrufen 400mg Tablet';
  r = await req('POST', '/prescriptions/print', { fileId, content: safeRx }, doctorToken);
  check('print allowed for safe rx', r.status === 200 && r.json.analysis.all_safe === true);

  // medicine detail with alternatives
  r = await req('GET', '/medicines/search?q=novidat', null, doctorToken);
  const novidatId = r.json.results[0].product_id;
  r = await req('GET', `/medicines/${novidatId}`, null, doctorToken);
  check('medicine detail', r.status === 200 && r.json.product.brand_name.includes('NOVIDAT'));
  check('unsafe medicine has alternatives', (r.json.product.alternatives || []).length >= 1);
  if ((r.json.product.alternatives || []).length) {
    const alt = r.json.product.alternatives[0];
    const mode = r.json.product.ai_powered ? 'AI-powered' : 'algorithmic';
    console.log('   top alternative:', alt.brand_name, 'score:', alt.similarity_score, 'shared:', alt.similar_ingredients, '(' + mode + ')');
    if (r.json.product.ai_reason) console.log('   AI reason:', r.json.product.ai_reason);
  }

  // doctor cannot access admin
  r = await req('GET', '/admin/summary', null, doctorToken);
  check('doctor blocked from admin', r.status === 403);

  // admin
  r = await req('POST', '/auth/login', { email: 'admin@rxguard.ai', password: 'Admin@1234' });
  check('admin login', r.status === 200 && r.json.user.role === 'admin');
  const adminToken = r.json.token;

  r = await req('GET', '/admin/summary', null, adminToken);
  check('admin summary', r.status === 200 && Number(r.json.summary.total_medicines) >= 50);

  r = await req('GET', '/admin/medicines?search=leukeran', null, adminToken);
  check('admin medicine search', r.status === 200 && r.json.medicines.length >= 1);

  r = await req('GET', '/admin/medicines?status=substandard&limit=10', null, adminToken);
  check('admin filter by status', r.status === 200 && r.json.medicines.every((m) => m.safety_status === 'substandard'));

  const leukeranRow = (await req('GET', '/admin/medicines?search=leukeran', null, adminToken)).json.medicines[0];
  r = await req('GET', `/admin/medicines/${leukeranRow.product_id}`, null, adminToken);
  check('admin medicine detail + timeline', r.status === 200 && r.json.product.timeline.length >= 1 && r.json.product.completeness);

  // safety change requires reason
  r = await req('PATCH', `/admin/medicines/${leukeranRow.product_id}`, { safety_status: 'active' }, adminToken);
  check('safety change requires reason', r.status === 400);

  r = await req('PATCH', `/admin/medicines/${leukeranRow.product_id}`, { safety_status: 'active', reason: 'Reinstated after lab re-test' }, adminToken);
  check('safety change with reason works', r.status === 200 && r.json.product.safety_status === 'active');

  // revert it back
  r = await req('PATCH', `/admin/medicines/${leukeranRow.product_id}`, { safety_status: 'unregistered', reason: 'Reverted for testing' }, adminToken);
  check('safety change reverted', r.status === 200);

  // approvals flow: register a doctor then approve
  const pendingCnic = `35202-0${runId}-1`;
  r = await req('POST', '/auth/register', {
    role: 'doctor', fullName: 'Dr. Pending', cnic: pendingCnic,
    email: pendingEmail, password: 'Pending@1234', confirmPassword: 'Pending@1234',
    licenseNumber: `PMDC-2020-${runId}`, clinicName: 'City Hospital',
  });
  check('doctor registration pending', r.status === 201 && /pending/i.test(r.json.message));
  r = await req('GET', '/admin/approvals', null, adminToken);
  check('pending list has doctor', r.status === 200 && r.json.pending.some((d) => d.email === pendingEmail));
  const pendingDoc = r.json.pending.find((d) => d.email === pendingEmail);
  r = await req('POST', `/admin/approvals/${pendingDoc.user_id}`, { decision: 'approved' }, adminToken);
  check('doctor approved', r.status === 200);

  // users + manufacturers + sources + backups + events
  r = await req('GET', '/admin/users', null, adminToken);
  check('admin users list', r.status === 200 && r.json.users.length >= 4);
  r = await req('GET', '/admin/manufacturers', null, adminToken);
  check('admin manufacturers', r.status === 200 && r.json.manufacturers.length >= 20);
  r = await req('GET', '/admin/sources', null, adminToken);
  check('admin sources', r.status === 200 && r.json.sources.length >= 3);
  r = await req('POST', '/admin/backups', null, adminToken);
  check('admin backup created', r.status === 200 && r.json.backup.status === 'success');
  r = await req('GET', '/admin/backups', null, adminToken);
  check('admin backups list', r.status === 200 && r.json.backups.length >= 1);
  r = await req('GET', '/admin/events', null, adminToken);
  check('admin events logged', r.status === 200 && r.json.events.length >= 2);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
