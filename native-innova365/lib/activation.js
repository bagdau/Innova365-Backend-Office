'use strict';
const SERVICE_URL = 'https://innova365.kz';
const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
const validCode = (value) => /^[A-HJ-NP-Z2-9]{12}$/.test(normalizeCode(value));
const formatCode = (value) => { const c = normalizeCode(value).slice(0, 12); return [c.slice(0, 4), c.slice(4, 8), c.slice(8)].filter(Boolean).join('-'); };
module.exports = { SERVICE_URL, normalizeCode, validCode, formatCode };
