#!/usr/bin/env node
// Compare theme/luxtl.js against the Python port fixture (and the synthetic rules).
const fs = require("fs");
const path = require("path");
const L = require("./luxtl.js");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "luxtl_fixture.json"), "utf8"));
let ok = true;
function chk(name, cond, detail) {
  if (!cond) { ok = false; console.log("FAIL " + name + (detail ? " — " + detail : "")); }
  else console.log("PASS " + name);
}

function close(a, b, tol) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (!Number.isFinite(a) && !Number.isFinite(b)) return true;
  return Math.abs(a - b) <= (tol || 1e-9);
}

function cmpArr(name, got, exp, boolean) {
  if (got.length !== exp.length) {
    chk(name, false, `len ${got.length} != ${exp.length}`);
    return;
  }
  let n = 0, first = null;
  for (let i = 0; i < exp.length; i++) {
    const g = boolean ? !!got[i] : (Number.isFinite(got[i]) ? got[i] : null);
    const e = boolean ? !!exp[i] : exp[i];
    const good = boolean ? g === e : close(g, e, 1e-9);
    if (!good) { n++; if (first == null) first = `i=${i} got=${g} exp=${e}`; }
  }
  chk(name, n === 0, n ? `${n} mismatches, first ${first}` : "");
}

function runCase(label, fx) {
  const R = L.compute(Float64Array.from(fx.h), Float64Array.from(fx.l), Float64Array.from(fx.c), 14, 1.0);
  cmpArr(label + " ph", L.finiteArr(R.ph), fx.ph);
  cmpArr(label + " pl", L.finiteArr(R.pl), fx.pl);
  cmpArr(label + " upper", L.finiteArr(R.upper), fx.upper);
  cmpArr(label + " lower", L.finiteArr(R.lower), fx.lower);
  cmpArr(label + " slope_ph", L.finiteArr(R.slope_ph), fx.slope_ph);
  cmpArr(label + " slope_pl", L.finiteArr(R.slope_pl), fx.slope_pl);
  cmpArr(label + " upper_rt", L.finiteArr(R.upper_rt), fx.upper_rt);
  cmpArr(label + " lower_rt", L.finiteArr(R.lower_rt), fx.lower_rt);
  cmpArr(label + " upos", Array.from(R.upos), fx.upos);
  cmpArr(label + " dnos", Array.from(R.dnos), fx.dnos);
  cmpArr(label + " up_break", R.up_break, fx.up_break, true);
  cmpArr(label + " dn_break", R.dn_break, fx.dn_break, true);
}

// Rule checks (same as ~/dd/luxtl/test_luxtl.py)
const fx = fixture.synthetic;
const h = Float64Array.from(fx.h), l = Float64Array.from(fx.l), c = Float64Array.from(fx.c);
const { ph, pl } = L.pivots(h, l, 14);
chk("PH confirmed 14 bars later at the swing high", Number.isFinite(ph[34]) && Math.abs(ph[34] - 110) < 1e-12 && !Number.isFinite(ph[20]));
chk("PL confirmed 14 bars later at the swing low", Number.isFinite(pl[39]) && Math.abs(pl[39] - 90) < 1e-12 && !Number.isFinite(pl[25]));
chk("no premature PH", !Array.from(ph.slice(0, 34)).some(Number.isFinite));
const R = L.compute(h, l, c, 14, 1.0);
chk("at PH confirm, upper state equals the pivot high", Math.abs(R.upper[34] - 110) < 1e-9);
chk("real-time down-trendline at confirm is ph - slope*length",
  Math.abs(R.upper_rt[34] - (110 - R.slope_ph[34] * 14)) < 1e-9);
chk("one bar later the real-time line has declined by slope",
  Math.abs(R.upper_rt[35] - (R.upper_rt[34] - R.slope_ph[34])) < 1e-9);
chk("upos resets to 0 on the PH confirmation bar", R.upos[34] === 0);

const up = fixture.synthetic_upbreak;
const R2 = L.compute(Float64Array.from(up.h), Float64Array.from(up.l), Float64Array.from(up.c), 14, 1.0);
chk("up-break fires on first close above the real-time down-trendline",
  R2.up_break[36] && R2.upos[36] === 1 && R2.upos[35] === 0);
chk("later bars above the line do not retrigger", !R2.up_break[37] && R2.upos[37] === 1);

const dn = fixture.synthetic_dnbreak;
const R3 = L.compute(Float64Array.from(dn.h), Float64Array.from(dn.l), Float64Array.from(dn.c), 14, 1.0);
chk("down-break fires on first close below the real-time up-trendline",
  R3.dn_break[45] && R3.dnos[45] === 1);

runCase("synthetic", fixture.synthetic);
runCase("synthetic_upbreak", fixture.synthetic_upbreak);
runCase("synthetic_dnbreak", fixture.synthetic_dnbreak);
runCase("m15_240", fixture.m15_240);

console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
