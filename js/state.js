/* ════════════════════════════════════════════════════════════════════
   state.js
   Application state, session DB credentials and persistence helpers.
════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';

function _headers() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Prefer':        'return=representation',
  };
}
function _isConfigured() {
  return SUPABASE_URL  !== 'https://YOUR_PROJECT_ID.supabase.co' &&
         SUPABASE_ANON_KEY !== 'YOUR_ANON_PUBLIC_KEY';
}
const DB = {

  async saveRegistration(student, sessionId) {
    if (!_isConfigured()) {
      console.warn('[DB] Supabase not configured — running offline.');
      return { data: null, error: null };
    }
    const payload = {
      session_id:     sessionId,
      first_name:     student.firstName,
      last_name:      student.lastName,
      full_name:      student.fullName,
      class:          student.class,
      section:        student.section      || null,
      school_name:    student.school,
      age:            student.age          ? parseInt(student.age, 10) : null,
      gender:         student.gender       || null,
      guardian_email: student.email        || null,
      registered_at:  new Date().toISOString(),
    };
    try {
      const res = await fetch(
        SUPABASE_URL + '/rest/v1/student_registrations',
        { method: 'POST', headers: _headers(), body: JSON.stringify(payload) }
      );
      if (!res.ok) {
        const msg = await res.text();
        console.error('[DB] saveRegistration HTTP ' + res.status + ':', msg);
        return { data: null, error: { message: msg } };
      }
      const data = await res.json();
      console.log('[DB] Registration saved:', Array.isArray(data) ? data[0]?.id : data?.id);
      return { data: Array.isArray(data) ? data[0] : data, error: null };
    } catch (err) {
      console.error('[DB] saveRegistration fetch failed:', err.message);
      return { data: null, error: { message: err.message } };
    }
  },

  async markCompleted(sessionId) {
    if (!_isConfigured()) return { data: null, error: null };
    try {
      const res = await fetch(
        SUPABASE_URL + '/rest/v1/student_registrations?session_id=eq.' + encodeURIComponent(sessionId),
        { method: 'PATCH', headers: _headers(), body: JSON.stringify({ completed_at: new Date().toISOString() }) }
      );
      if (!res.ok) {
        const msg = await res.text();
        console.error('[DB] markCompleted HTTP ' + res.status + ':', msg);
        return { data: null, error: { message: msg } };
      }
      console.log('[DB] Session marked complete:', sessionId);
      return { data: await res.json(), error: null };
    } catch (err) {
      console.error('[DB] markCompleted fetch failed:', err.message);
      return { data: null, error: { message: err.message } };
    }
  },
};


const S = {
  student: {}, sessionId: null,
  cpi:  { answers: Array.from({length:20}, ()=>[]), scores: null, startTime: null, duration: 0, currentQ: 0 },
  sea:  { answers: new Array(60).fill(null), scores: null, startTime: null, duration: 0, currentPage: 0 },
  nmap: { answers: new Array(63).fill(null), scores: null, startTime: null, duration: 0, currentDim: 0 },
  daab: {
    va:  { answers: new Array(20).fill(null), scores: null, startTime: null, duration: 0, timerStartedAt: null },
    pa:  { answers: new Array(50).fill(null), scores: null, startTime: null, duration: 0, currentPage: 0, timerStartedAt: null },
    na:  { answers: new Array(20).fill(null), scores: null, startTime: null, duration: 0, timerStartedAt: null },
    lsa: { answers: new Array(20).fill(null), scores: null, startTime: null, duration: 0, timerStartedAt: null },
    hma: { answers: new Array(20).fill(null), scores: null, startTime: null, duration: 0, timerStartedAt: null },
    ar:  { answers: new Array(20).fill(null), scores: null, startTime: null, duration: 0, timerStartedAt: null },
    ma:  { answers: new Array(20).fill(null), scores: null, startTime: null, duration: 0, timerStartedAt: null },
    sa:  { answers: new Array(20).fill(null), scores: null, startTime: null, duration: 0, timerStartedAt: null },
    currentSub: 0,
  },
  timerInt: null,
};

const _SESSION_KEY = 'numind_session_v1';

function _saveSession(activePage) {
  try {
    const snap = {
      student:   S.student,
      sessionId: S.sessionId,
      cpi:  { answers: S.cpi.answers,  scores: S.cpi.scores,  duration: S.cpi.duration, currentQ: S.cpi.currentQ, startTime: S.cpi.startTime },
      sea:  { answers: S.sea.answers,  scores: S.sea.scores,  duration: S.sea.duration,  currentPage: S.sea.currentPage, startTime: S.sea.startTime },
      nmap: { answers: S.nmap.answers, scores: S.nmap.scores, duration: S.nmap.duration, currentDim: S.nmap.currentDim, startTime: S.nmap.startTime },
      daab: {
        va:  { answers: S.daab.va.answers,  scores: S.daab.va.scores,  duration: S.daab.va.duration,  currentPage: S.daab.va.currentPage  || 0, timerStartedAt: S.daab.va.timerStartedAt  || null },
        pa:  { answers: S.daab.pa.answers,  scores: S.daab.pa.scores,  duration: S.daab.pa.duration,  currentPage: S.daab.pa.currentPage  || 0, timerStartedAt: S.daab.pa.timerStartedAt  || null },
        na:  { answers: S.daab.na.answers,  scores: S.daab.na.scores,  duration: S.daab.na.duration,  currentPage: S.daab.na.currentPage  || 0, timerStartedAt: S.daab.na.timerStartedAt  || null },
        lsa: { answers: S.daab.lsa.answers, scores: S.daab.lsa.scores, duration: S.daab.lsa.duration, currentPage: S.daab.lsa.currentPage || 0, timerStartedAt: S.daab.lsa.timerStartedAt || null },
        hma: { answers: S.daab.hma.answers, scores: S.daab.hma.scores, duration: S.daab.hma.duration, currentPage: S.daab.hma.currentPage || 0, timerStartedAt: S.daab.hma.timerStartedAt || null },
        ar:  { answers: S.daab.ar.answers,  scores: S.daab.ar.scores,  duration: S.daab.ar.duration,  currentPage: S.daab.ar.currentPage  || 0, timerStartedAt: S.daab.ar.timerStartedAt  || null },
        ma:  { answers: S.daab.ma.answers,  scores: S.daab.ma.scores,  duration: S.daab.ma.duration,  currentPage: S.daab.ma.currentPage  || 0, timerStartedAt: S.daab.ma.timerStartedAt  || null },
        sa:  { answers: S.daab.sa.answers,  scores: S.daab.sa.scores,  duration: S.daab.sa.duration,  currentPage: S.daab.sa.currentPage  || 0, timerStartedAt: S.daab.sa.timerStartedAt  || null },
        currentSub: S.daab.currentSub,
      },
      activePage: activePage || null,
      savedAt: Date.now(),
    };
    localStorage.setItem(_SESSION_KEY, JSON.stringify(snap));
  } catch (e) {
    console.warn('[Session] Could not save snapshot:', e.message);
  }
}

function _clearSession() {
  try { localStorage.removeItem(_SESSION_KEY); } catch (_) {}
}

function _restoreSession() {
  try {
    const raw = localStorage.getItem(_SESSION_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap.savedAt || Date.now() - snap.savedAt > 4 * 60 * 60 * 1000) {
      _clearSession();
      return null;
    }
    S.student   = snap.student   || {};
    S.sessionId = snap.sessionId || null;

    if (snap.cpi) {
      if (Array.isArray(snap.cpi.answers)) {
        S.cpi.answers.splice(0, S.cpi.answers.length, ...snap.cpi.answers);
      }
      S.cpi.scores    = snap.cpi.scores    || null;
      S.cpi.duration  = snap.cpi.duration  || 0;
      S.cpi.startTime = snap.cpi.startTime || null;
      if (snap.cpi.currentQ != null) S.cpi.currentQ = snap.cpi.currentQ;
    }

    if (snap.sea) {
      if (Array.isArray(snap.sea.answers)) {
        S.sea.answers.splice(0, S.sea.answers.length, ...snap.sea.answers);
      }
      S.sea.scores      = snap.sea.scores      || null;
      S.sea.duration    = snap.sea.duration    || 0;
      S.sea.currentPage = snap.sea.currentPage || 0;
      S.sea.startTime   = snap.sea.startTime   || null;
    }
    
    if (snap.nmap) {
      if (Array.isArray(snap.nmap.answers)) {
        S.nmap.answers.splice(0, S.nmap.answers.length, ...snap.nmap.answers);
      }
      S.nmap.scores     = snap.nmap.scores     || null;
      S.nmap.duration   = snap.nmap.duration   || 0;
      S.nmap.currentDim = snap.nmap.currentDim || 0;
      S.nmap.startTime  = snap.nmap.startTime  || null;
    }

    if (snap.daab) {
      ['va','pa','na','lsa','hma','ar','ma','sa'].forEach(k => {
        if (!snap.daab[k]) return;
        if (Array.isArray(snap.daab[k].answers)) {
          S.daab[k].answers.splice(0, S.daab[k].answers.length, ...snap.daab[k].answers);
        }
        S.daab[k].scores   = snap.daab[k].scores   || null;
        S.daab[k].duration = snap.daab[k].duration || 0;
        if (snap.daab[k].currentPage != null) {
          S.daab[k].currentPage = snap.daab[k].currentPage;
        }
        if (snap.daab[k].timerStartedAt != null) {
          S.daab[k].timerStartedAt = snap.daab[k].timerStartedAt;
        }
      });
      S.daab.currentSub = snap.daab.currentSub || 0;
    }
    console.log('[Session] Restored from snapshot (page:', snap.activePage, ')');
    return snap.activePage || null;
  } catch (e) {
    console.warn('[Session] Could not restore snapshot:', e.message);
    _clearSession();
    return null;
  }
}

function saveState() {
  if (!S.sessionId) return;
  try {
    // timerInt is a live interval handle — don't serialise it
    const snapshot = JSON.parse(JSON.stringify({ ...S, timerInt: null }));
    localStorage.setItem('nm_state_' + S.sessionId, JSON.stringify(snapshot));
    localStorage.setItem('nm_last_session', S.sessionId);
  } catch (e) {
    console.warn('[NM] saveState failed:', e);
  }
}

function loadState() {
  try {
    const sid = localStorage.getItem('nm_last_session');
    if (!sid) return false;
    const raw = localStorage.getItem('nm_state_' + sid);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    // Merge into S — keep live references (timerInt stays null from parsed)
    Object.assign(S, parsed);
    S.timerInt = null; // always reset live timer handle
    return true;
  } catch (e) {
    console.warn('[NM] loadState failed (corrupt data?):', e);
    return false;
  }
}

function clearState() {
  try {
    const sid = localStorage.getItem('nm_last_session');
    if (sid) localStorage.removeItem('nm_state_' + sid);
    localStorage.removeItem('nm_last_session');
  } catch (e) {
    console.warn('[NM] clearState failed:', e);
  }
}

export { SUPABASE_URL, SUPABASE_ANON_KEY, _headers, _isConfigured, DB, S, _SESSION_KEY, _saveSession, _clearSession, _restoreSession, saveState, loadState, clearState };
