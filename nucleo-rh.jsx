import React, { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard, Users, PenLine, Package, FileText, MessageSquare,
  Activity, Settings, HelpCircle, Search, Bell, Sparkles, ChevronRight, ChevronDown,
  Plus, ArrowUp, Check, Clock, Upload, Filter, MoreHorizontal, X, Send,
  ShieldCheck, AlertCircle, CalendarClock, FileCheck2, Boxes, Menu, Ticket, LayoutGrid, List, Flag, Info, Eraser,
  Share2, Link2, Copy, Bold, Italic, Underline, Strikethrough, ListOrdered, Image, Quote, Type, Mail, Phone, MapPin,
  Building2, Lock, Globe, LogOut, Receipt, Download, Printer, Shield, Eye, FileSpreadsheet,
  Calendar, Video, UserCheck, ShoppingCart, ChevronLeft, Truck,
  Briefcase, UserMinus, TrendingDown, TrendingUp, Wallet, Target, GraduationCap, Smile, Award, BookOpen, Heart, BarChart3, Trash2, ShieldAlert, Zap, ChevronUp, Layers, GitBranch, History, RotateCcw,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import * as XLSX from "xlsx";

/* ------------------------------------------------------------------ */
/*  Design system                                                      */
/* ------------------------------------------------------------------ */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root{
/* transitions-dev root */
  --resize-dur:300ms; --resize-ease:cubic-bezier(0.22,1,0.36,1);
  --dropdown-open-dur:220ms; --dropdown-close-dur:130ms;
  --dropdown-pre-scale:0.97; --dropdown-closing-scale:0.99;
  --dropdown-ease:cubic-bezier(0.22,1,0.36,1);
  --modal-open-dur:240ms; --modal-close-dur:140ms;
  --modal-scale:0.96; --modal-ease:cubic-bezier(0.22,1,0.36,1);
  --panel-open-dur:320ms; --panel-close-dur:260ms;
  --panel-translate-y:60px; --panel-blur:2px;
  --panel-ease:cubic-bezier(0.22,1,0.36,1);
  --icon-swap-dur:180ms; --icon-swap-blur:2px;
  --icon-swap-start-scale:0.3; --icon-swap-ease:ease-in-out;
  --check-opacity-dur:500ms; --check-rotate-dur:500ms;
  --check-rotate-from:60deg; --check-bob-dur:400ms;
  --check-y-amount:24px; --check-blur-dur:440ms;
  --check-blur-from:8px; --check-path-dur:500ms;
  --check-path-delay:60ms; --check-ease-out:cubic-bezier(0.22,1,0.36,1);
  --check-ease-bob:cubic-bezier(0.34,1.35,0.64,1);
  --check-ease-path:cubic-bezier(0.22,1,0.36,1);
  --shake-distance:5px; --shake-overshoot:3px;
  --shake-dur-a:80ms; --shake-dur-b:60ms;
  --shake-ease:cubic-bezier(0.22,1,0.36,1);
  --revert-hold:2800ms; --revert-dur:260ms;
  --bg:#ffffff; --panel:#ffffff; --ink:#15151a; --ink2:#5d5d68; --ink3:#9494a0;
  --line:#ededf0; --line2:#f4f4f6;
  --red:#e5484d; --redd:#cc2f35; --reds:#fdeced;
  --grn:#1f9d63; --grns:#e6f5ed; --amb:#bf8410; --ambs:#fbf2db;
  --blu:#3b6fe0; --blus:#eaf0fd; --vio:#7c5cd6; --vios:#f1edfb;
  --r:20px; --rs:13px;
  --e1:0 1px 2px rgba(17,17,26,.04), 0 1px 1px rgba(17,17,26,.03);
  --e2:0 1px 3px rgba(17,17,26,.05), 0 8px 20px -8px rgba(17,17,26,.11);
  --e3:0 6px 16px -8px rgba(17,17,26,.09), 0 18px 38px -14px rgba(17,17,26,.13);
  --e4:0 12px 28px -12px rgba(17,17,26,.15), 0 32px 60px -22px rgba(17,17,26,.20);
  --sh:var(--e1);
}
*{box-sizing:border-box}
.nrh, .nrh *{font-family:'Manrope',ui-sans-serif,system-ui,sans-serif;font-weight:500;}
.nrh .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-feature-settings:"tnum";}
.nrh{height:100vh;display:flex;overflow:hidden;background:var(--bg);color:var(--ink);
  font-size:14px;line-height:1.45;-webkit-font-smoothing:antialiased;}
.nrh button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit;}
.nrh input,.nrh textarea{font-family:inherit;}
.nrh ::selection{background:var(--reds);}

/* sidebar */
.sb{width:248px;flex-shrink:0;background:#fafafa;
  display:flex;flex-direction:column;height:100%;z-index:60;
  border-right:1px solid rgba(20,20,26,.055);}
.brand{display:flex;align-items:center;gap:11px;margin:18px 14px 8px;padding-bottom:14px;
  border-bottom:1px solid rgba(20,20,26,.055);}
.mark{width:30px;height:30px;border-radius:8px;overflow:hidden;flex-shrink:0;display:block;
  box-shadow:0 1px 2px rgba(17,17,26,.18);}
.mark img{width:100%;height:100%;object-fit:cover;display:block;}
.bname{font-weight:800;font-size:15px;letter-spacing:-.04em;line-height:1.1;}
.bsub{font-size:11px;font-weight:600;color:var(--ink3);letter-spacing:.01em;margin-top:1px;}
.nav{padding:4px 12px;overflow-y:auto;flex:1;}
.nlabel{font-size:10px;font-weight:800;letter-spacing:.1em;color:var(--ink3);
  padding:16px 10px 5px;text-transform:uppercase;}
.nitem{width:100%;display:flex;align-items:center;gap:11px;padding:9px 13px;border-radius:999px;
  color:var(--ink2);font-weight:600;font-size:13px;transition:.12s;text-align:left;margin-bottom:3px;}
.nitem svg{flex-shrink:0;opacity:.75;transition:.12s;}
.nitem:hover svg{opacity:1;}
.nitem.on svg{opacity:1;}
.nitem:hover{background:rgba(20,20,26,.045);color:var(--ink);}
.nitem.on{background:#fff;color:var(--ink);font-weight:700;border-radius:999px;
  box-shadow:0 0 0 1px rgba(20,20,26,.06),0 2px 8px -4px rgba(20,20,26,.1);}
.nitem.on svg{color:var(--red);}
.nbadge{margin-left:auto;font-size:11px;font-weight:700;min-width:20px;height:20px;padding:0 6px;
  border-radius:7px;display:grid;place-items:center;}
.nbadge.a{background:var(--ambs);color:var(--amb);} .nbadge.g{background:var(--grns);color:var(--grn);}
.sfoot{border-top:1px solid rgba(20,20,26,.055);padding:10px;position:relative;}
.suser{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:999px;width:100%;text-align:left;}
.suser:hover{background:rgba(20,20,26,.045);}

.av{border-radius:50%;color:#fff;font-weight:700;display:grid;place-items:center;
  flex-shrink:0;font-size:12px;letter-spacing:.01em;}
/* tooltips */
[data-tip]{position:relative;}
[data-tip]::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 9px);left:50%;
  transform:translateX(-50%) scale(.92);background:#1a1b1f;color:#fff;font-size:11.5px;font-weight:600;
  font-family:inherit;padding:5px 10px;border-radius:8px;white-space:nowrap;pointer-events:none;
  opacity:0;transition:opacity .12s,transform .12s;z-index:300;letter-spacing:.01em;}
[data-tip]::before{content:"";position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);
  border:5px solid transparent;border-top-color:#1a1b1f;pointer-events:none;opacity:0;
  transition:opacity .12s;z-index:300;}
[data-tip]:hover::after{opacity:1;transform:translateX(-50%) scale(1);}
[data-tip]:hover::before{opacity:1;}
[data-tip].tip-down::after{bottom:auto;top:calc(100% + 9px);transform:translateX(-50%) scale(.92);}
[data-tip].tip-down::before{bottom:auto;top:calc(100% + 4px);border-top-color:transparent;border-bottom-color:#1a1b1f;}
[data-tip].tip-down:hover::after{transform:translateX(-50%) scale(1);}
[data-tip].tip-left::after{left:auto;right:0;transform:translateX(0) scale(.92);}
[data-tip].tip-left:hover::after{transform:translateX(0) scale(1);}

/* main */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
.top{height:60px;flex-shrink:0;background:rgba(250,250,250,.9);
  backdrop-filter:blur(12px);display:flex;align-items:center;gap:10px;padding:0 20px;
  border-bottom:1px solid rgba(20,20,26,.055);position:relative;z-index:50;}
.crumb{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--ink);font-weight:700;letter-spacing:-.01em;}
.crumb svg{color:var(--ink3);}
.tdiv{width:1px;height:20px;background:var(--line2);flex-shrink:0;}
.search{display:flex;align-items:center;gap:8px;background:#eeeef1;
  border-radius:999px;padding:0 14px;width:230px;height:38px;color:var(--ink3);transition:.12s;}
.search:focus-within{background:#fff;box-shadow:0 0 0 3px var(--line2),var(--e1);}
.search input{border:none;background:none;outline:none;flex:1;font-size:13px;color:var(--ink);min-width:0;}
.kbd{font-size:10px;font-weight:700;color:var(--ink3);border-radius:5px;
  padding:1px 5px;background:#e6e6ea;}
.ibtn{width:38px;height:38px;border-radius:999px;background:#ebebee;
  display:grid;place-items:center;color:var(--ink2);position:relative;transition:.12s;flex-shrink:0;}
.ibtn:hover{background:#e3e3e7;color:var(--ink);}
.ibtn.on{background:#18181b;color:#fff;}
.ibtn:active{transform:translateY(.5px);}
.ham{display:none;}
.nbell{width:38px;height:38px;border-radius:999px;flex-shrink:0;
  background:#ebebee;color:var(--ink2);
  display:grid;place-items:center;position:relative;transition:.15s;}
.nbell:hover{background:#e3e3e7;color:var(--ink);}
.nbell:active{transform:translateY(0);}
.nbadge2{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;
  background:linear-gradient(150deg,#ff8a8d,#e5484d);color:#fff;font-size:10px;font-weight:800;line-height:1;
  display:grid;place-items:center;box-shadow:0 2px 6px -1px rgba(229,72,77,.55),0 0 0 2px #fff;}
.popcatch{position:fixed;inset:0;z-index:75;}
.notifwrap{position:relative;}
.notifpanel{position:absolute;top:calc(100% + 8px);right:0;width:340px;max-width:90vw;background:#ffffff;border-radius:16px;
  box-shadow:0 8px 32px -8px rgba(17,17,26,.16),0 2px 8px rgba(17,17,26,.06);overflow:hidden;z-index:200;
  animation:t-notif-open var(--dropdown-open-dur) var(--dropdown-ease) both;}
@keyframes popin{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
.notifhead{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid #f0f0f2;}
.notifhead b{font-size:13.5px;font-weight:800;}
.notiflink{font-size:11.5px;font-weight:700;color:var(--ink3);}
.notiflink:hover{color:var(--red);}
.notiflist{overflow:visible;}
.notifitem{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid #f4f4f6;align-items:flex-start;}
.notifitem:last-child{border-bottom:none;}
.notifitem:hover{background:#f8f8fa;cursor:pointer;}
/* document category chips — white unselected */
.docchip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--ink2);
  background:transparent;border-radius:999px;padding:6px 14px;transition:.13s;}
.docchip:hover{background:rgba(20,20,26,.05);color:var(--ink);}
.docchip.on{color:var(--ink);font-weight:700;background:#fff;
  box-shadow:0 0 0 1px rgba(20,20,26,.1),0 1px 4px rgba(20,20,26,.08);}
.nico{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;margin-top:1px;}
.nico.red{background:var(--reds);color:var(--red);} .nico.amb{background:var(--ambs);color:var(--amb);}
.nico.grn{background:var(--grns);color:var(--grn);} .nico.blu{background:var(--blus);color:var(--blu);} .nico.ink{background:var(--line2);color:var(--ink2);}
.ntxt b{display:block;font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:2px;}
.ntxt span{font-size:11.5px;color:var(--ink3);line-height:1.4;}
.notiffoot{padding:9px 16px;text-align:center;border-top:1px solid var(--line);}
.notiffoot button{font-size:12px;font-weight:700;color:var(--ink2);}
.notiffoot button:hover{color:var(--ink);}
.usermenu{position:absolute;bottom:calc(100% + 8px);left:10px;right:10px;background:#fff;border-radius:13px;
  box-shadow:var(--e4);overflow:hidden;z-index:80;padding:6px;
  animation:popin .15s cubic-bezier(.22,1,.36,1) both;}
.umitem{width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;
  font-size:13px;font-weight:600;color:var(--ink2);text-align:left;}
.umitem:hover{background:var(--line2);color:var(--ink);}
.umitem svg{color:var(--ink3);flex-shrink:0;}
.umitem:hover svg{color:var(--ink2);}
.umbadge{margin-left:auto;background:var(--red);color:#fff;font-size:11px;font-weight:700;min-width:18px;
  height:18px;border-radius:6px;display:grid;place-items:center;padding:0 5px;}
.umdiv{height:1px;background:var(--line);margin:6px 4px;}
.umlabel{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;color:var(--ink3);
  text-transform:uppercase;letter-spacing:.04em;padding:6px 10px 4px;}

.content{flex:1;overflow-y:auto;padding:26px 26px 60px;background:#f8f8f9;}
.content-full{padding:0;overflow:hidden;display:flex;flex-direction:column;}
.previewbar{display:flex;align-items:center;gap:8px;background:linear-gradient(160deg,#fdf7e6,#fff7e0);
  border:1px solid #f3e2ab;color:#7a5b12;font-size:12.5px;font-weight:600;border-radius:12px;
  padding:10px 14px;margin-bottom:18px;}
.previewbar b{font-weight:800;}
.previewbar button{margin-left:auto;font-size:12px;font-weight:700;color:#7a5b12;text-decoration:underline;flex-shrink:0;}
.phead{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;}
.h1{font-size:25px;font-weight:800;letter-spacing:-.06em;}
.psub{color:var(--ink2);font-size:13.5px;margin-top:3px;font-weight:500;}

/* buttons / pills */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-weight:600;font-size:13px;
  padding:8px 16px;border-radius:999px;background:#fff;color:var(--ink);
  box-shadow:0 0 0 1px rgba(20,20,26,.1),0 1px 3px rgba(20,20,26,.06);transition:.13s;}
.btn:hover{background:#f6f6f8;box-shadow:0 0 0 1px rgba(20,20,26,.14),0 2px 6px rgba(20,20,26,.08);}
.btn:active{transform:scale(.98);}
.btn.pri{border:none;color:#fff;background:#e5484d;box-shadow:none;}
.btn.pri:hover{background:#d73f44;}
.btn.pri:active{transform:scale(.98);background:#c93940;}
.btn.dark{border:none;color:#fff;background:#18181b;box-shadow:none;}
.btn.dark:hover{background:#2c2c32;}
.btn.dark:active{transform:scale(.98);}
.badge{display:inline-flex;align-items:center;gap:5px;font-weight:600;font-size:11.5px;
  padding:3px 10px;border-radius:999px;white-space:nowrap;
  background:#fff;box-shadow:0 0 0 1px rgba(20,20,26,.1);}
.badge .bd{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
/* dot colors */
.b-grn{color:var(--grn);} .b-grn .bd{background:var(--grn);}
.b-amb{color:#b07800;} .b-amb .bd{background:#e9a000;}
.b-red{color:var(--redd);} .b-red .bd{background:var(--red);}
.b-neu{color:var(--ink2);} .b-neu .bd{background:#b0b0ba;}
.b-blu{color:var(--blu);} .b-blu .bd{background:var(--blu);}
.b-vio{color:var(--vio);} .b-vio .bd{background:var(--vio);}
/* filled variants for special states */
.badge.filled-grn{background:#e8faf1;box-shadow:0 0 0 1px #b8e8d0;}
.badge.filled-amb{background:#fff8e6;box-shadow:0 0 0 1px #ead8a0;}
.badge.filled-red{background:#fff0f0;box-shadow:0 0 0 1px #f4c0c0;}
.badge.filled-neu{background:#f4f4f6;box-shadow:0 0 0 1px #e0e0e6;}
.badge.filled-blu{background:#eef3fd;box-shadow:0 0 0 1px #bfd0f4;}
.badge.filled-vio{background:#f3effe;box-shadow:0 0 0 1px #d4bef4;}
/* dark filled (like v3.0, -40% in ref) */
.badge.dark-fill{background:#18181b;color:#fff;box-shadow:none;}
.badge.dark-fill .bd{background:#fff;}

/* cards / grids */
.card{background:var(--panel);border-radius:var(--r);box-shadow:var(--e2);}
.cpad{padding:16px 18px;}
.chead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px 10px;flex-wrap:wrap;}
.ctitle{font-weight:800;font-size:14.5px;letter-spacing:-.03em;}
.clink{font-size:12.5px;font-weight:700;color:var(--ink2);display:inline-flex;align-items:center;gap:3px;}
.clink:hover{color:var(--red);}
.gkpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:14px;margin-bottom:16px;align-items:stretch;}
.gkpi>div{display:flex;flex-direction:column;}
.g2{display:grid;grid-template-columns:1.62fr 1fr;gap:16px;margin-bottom:16px;}
.settingsgrid{grid-template-columns:200px 1fr;}
/* calendar */
.calgrid{grid-template-columns:1.3fr 1fr;align-items:start;}
.calhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.calgridwrap{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;}
.caldow{text-align:center;font-size:10.5px;font-weight:700;color:var(--ink3);text-transform:uppercase;padding-bottom:6px;}
.calcell{aspect-ratio:1;border-radius:10px;padding:6px 7px;display:flex;flex-direction:column;background:var(--line2);}
.calcell.empty{background:transparent;}
.calcell.today{background:var(--reds);box-shadow:inset 0 0 0 1.5px var(--red);}
.caldnum{font-size:12.5px;font-weight:700;color:var(--ink2);}
.calcell.today .caldnum{color:var(--redd);font-weight:800;}
.caldots{display:flex;gap:3px;margin-top:auto;flex-wrap:wrap;}
.caldot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
.caldot.blu{background:var(--blu);} .caldot.grn{background:var(--grn);} .caldot.vio{background:var(--vio);} .caldot.red{background:var(--red);}
.meetrow{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line2);}
.meetrow:last-child{border-bottom:none;}
.meetdate{width:42px;height:42px;border-radius:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;}
.meetday{font-size:14px;font-weight:800;line-height:1.1;}
.meetmon{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
.meetdate.blu{background:var(--blus);color:var(--blu);} .meetdate.grn{background:var(--grns);color:var(--grn);}
.meetdate.vio{background:var(--vios);color:var(--vio);} .meetdate.red{background:var(--reds);color:var(--redd);}
.g2b{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
.g3{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;align-items:stretch;}
.g3>div{display:flex;flex-direction:column;}

/* kpi */
.kpi{position:relative;overflow:hidden;padding:15px 16px 14px;transition:box-shadow .2s,transform .2s;
  flex:1;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;}
.kpi:hover{box-shadow:var(--e3);transform:translateY(-1px);}
.kglow{position:absolute;width:100px;height:100px;border-radius:50%;filter:blur(20px);
  opacity:.3;top:-20px;right:-16px;pointer-events:none;
  -webkit-mask-image:radial-gradient(circle,#000 35%,transparent 72%);
  mask-image:radial-gradient(circle,#000 35%,transparent 72%);}
.klab{position:relative;z-index:1;font-size:12px;color:var(--ink2);font-weight:700;display:flex;align-items:center;gap:9px;}
.kico{width:30px;height:30px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;color:#fff;}
.kval{position:relative;z-index:1;font-size:25px;font-weight:800;letter-spacing:-.06em;margin:8px 0 9px;}
.kfoot{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;}
.delta{display:inline-flex;align-items:center;gap:3px;font-weight:700;font-size:11px;padding:2px 6px;border-radius:7px;}
.delta.up{background:var(--grns);color:var(--grn);} .delta.dn{background:var(--reds);color:var(--redd);}
.delta.dn svg{transform:rotate(180deg);}
.kvs{font-size:10.5px;color:var(--ink3);font-weight:600;}

/* compact stat card */
.stat{position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;padding:13px 15px;
  flex:1;height:100%;box-sizing:border-box;
  transition:box-shadow .2s,transform .2s;}
.stat:hover{box-shadow:var(--e3);transform:translateY(-1px);}
.sic{position:relative;z-index:1;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;
  flex-shrink:0;color:#fff;}
.stxt{position:relative;z-index:1;min-width:0;}
.slab{font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.03em;}
.sval{font-size:20px;font-weight:800;letter-spacing:-.05em;line-height:1.2;margin-top:1px;}
.ssub{font-size:10.5px;color:var(--ink3);font-weight:600;margin-top:1px;}

/* chart */
.legend{display:flex;align-items:center;gap:16px;}
.lg{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--ink2);}
.lgd{width:9px;height:9px;border-radius:3px;}
.range{font-size:12px;font-weight:700;color:var(--ink2);background:#ebebee;border-radius:9px;
  padding:6px 11px;display:inline-flex;align-items:center;gap:6px;box-shadow:var(--e1);}
.range:hover{background:#e2e2e7;}
.tip{background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 8px 24px -8px rgba(20,20,26,.18);
  padding:10px 12px;}
.tip .tm{font-weight:800;font-size:12px;margin-bottom:6px;}
.tip .tr{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--ink2);font-weight:600;}

/* table */
.tbl{width:100%;border-collapse:collapse;}
.tbl th{text-align:left;font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--ink3);
  text-transform:uppercase;padding:10px 18px;border-bottom:1px solid var(--line2);}
.tbl td{padding:11px 18px;border-bottom:1px solid var(--line2);font-size:13.5px;font-weight:500;vertical-align:middle;}
.tbl tr:last-child td{border-bottom:none;}
.trow{transition:.1s;} .trow:hover{background:#fbfbfc;}
.cemp{display:flex;align-items:center;gap:11px;}
.cename{font-weight:700;font-size:13.5px;letter-spacing:-.025em;}
.ceid{font-size:11px;color:var(--ink3);}
.muted{color:var(--ink2);}

/* insights */
.ins-top{position:relative;overflow:hidden;}
.ins-top::after{content:"";position:absolute;inset:0 0 auto 0;height:90px;
  background:radial-gradient(120% 90px at 88% 0%, rgba(229,72,77,.08), transparent 70%);pointer-events:none;}
.insight{display:flex;gap:13px;padding:14px 20px;border-bottom:1px solid var(--line2);}
.insight:last-child{border-bottom:none;}
.iico{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;color:#fff;}
.iico.red{background:linear-gradient(145deg,#ff8a8d,#e5484d);box-shadow:0 5px 12px -5px #e5484d88;}
.iico.amb{background:linear-gradient(145deg,#f0bd5a,#bf8410);box-shadow:0 5px 12px -5px #bf841088;}
.iico.grn{background:linear-gradient(145deg,#3ed694,#1f9d63);box-shadow:0 5px 12px -5px #1f9d6388;}
.iico.blu{background:linear-gradient(145deg,#7aa2ff,#3b6fe0);box-shadow:0 5px 12px -5px #3b6fe088;}
.iico.vio{background:linear-gradient(145deg,#b298f2,#7c5cd6);box-shadow:0 5px 12px -5px #7c5cd688;}
.iico.ink{background:linear-gradient(145deg,#3a3a42,#15151a);box-shadow:0 5px 12px -5px #15151a66;}
.iref{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--ink2);
  background:#ebebee;border-radius:9px;padding:5px 11px;cursor:pointer;box-shadow:var(--e1);transition:.15s;}
.iref:hover{background:#e2e2e7;}
.ispin{width:14px;height:14px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--red);
  animation:spin .7s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.skel{height:42px;border-radius:10px;background:linear-gradient(90deg,var(--line2) 0%,#ececef 50%,var(--line2) 100%);
  background-size:200% 100%;animation:shimmer 1.4s ease-in-out infinite;}
@keyframes shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.it{font-weight:700;font-size:13.5px;letter-spacing:-.025em;}
.id{font-size:12.5px;color:var(--ink2);margin-top:2px;}

/* timeline */
.tl{padding:8px 20px 16px;}
.tlg{font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--ink3);text-transform:uppercase;
  padding:14px 0 8px;}
.tli{display:flex;gap:14px;position:relative;padding-bottom:6px;}
.tlrail{position:relative;flex-shrink:0;width:14px;display:flex;justify-content:center;}
.tlrail::before{content:"";position:absolute;top:14px;bottom:-8px;width:2px;background:var(--line);}
.tli.last .tlrail::before{display:none;}
.tlnode{width:11px;height:11px;border-radius:50%;background:#fff;border:2.5px solid var(--ink3);margin-top:4px;z-index:1;}
.tlnode.red{border-color:var(--red);background:linear-gradient(145deg,#ff8a8d,#e5484d);box-shadow:0 0 0 4px var(--reds);}
.tlnode.vio{border-color:var(--vio);background:linear-gradient(145deg,#b298f2,#7c5cd6);box-shadow:0 0 0 4px var(--vios);}
.tlbody{flex:1;padding-bottom:14px;min-width:0;}
.tltop{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.tltxt{font-size:13.5px;font-weight:600;}
.tltxt b{font-weight:700;}
.tltime{font-size:11px;color:var(--ink3);flex-shrink:0;}
.tltag{font-size:10.5px;font-weight:700;color:var(--ink2);background:var(--line2);border-radius:6px;
  padding:1px 7px;margin-top:5px;display:inline-block;}

/* upload / sign */
.drop{border:1.5px dashed #d9d9df;border-radius:14px;padding:28px 20px;text-align:center;
  background:#fcfcfd;transition:.15s;}
.drop:hover{background:var(--reds);}
.dico{width:46px;height:46px;border-radius:13px;background:#fff;border:1px solid var(--line);
  display:grid;place-items:center;color:var(--red);margin:0 auto 11px;}
.signpad{border:1px solid var(--line);border-radius:13px;height:120px;background:
  repeating-linear-gradient(0deg,transparent 0 27px,var(--line2) 27px 28px);
  display:grid;place-items:center;position:relative;}

/* doc list */
.doclist{display:flex;flex-direction:column;}
.doclist-head{display:grid;grid-template-columns:1fr 120px 110px 80px;gap:12px;
  padding:8px 14px;font-size:11.5px;font-weight:700;color:var(--ink3);letter-spacing:.03em;
  border-bottom:1px solid #f0f0f2;}
.docrow{display:grid;grid-template-columns:1fr 120px 110px 80px;gap:12px;align-items:center;
  padding:11px 14px;border-bottom:1px solid #f5f5f7;transition:.12s;cursor:pointer;}
.docrow:hover{background:#f8f8fa;}
.docrow:last-child{border-bottom:none;}
.doc-name{display:flex;align-items:center;gap:10px;min-width:0;}
.doc-icon{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;background:#f0f0f2;color:var(--ink2);}
.doc-icon.ctr{background:#fef2f2;color:var(--redd);}
.doc-icon.pol{background:#f0f9ff;color:#0088cc;}
.doc-icon.act{background:#f0fdf4;color:#1a8a44;}
.doc-icon.pla{background:#fefce8;color:#a07000;}
.doc-nametext{font-size:13.5px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.doc-id{font-size:11px;color:var(--ink3);font-family:var(--mono);margin-top:1px;}
.doc-meta{font-size:12.5px;color:var(--ink2);}
.doc-type{display:inline-flex;align-items:center;font-size:12px;font-weight:600;
  padding:3px 10px;border-radius:999px;background:#f0f0f2;color:var(--ink2);}
.doc-acts{display:flex;gap:4px;justify-content:flex-end;opacity:0;transition:.12s;}
.docrow:hover .doc-acts{opacity:1;}
.dtags{display:flex;flex-wrap:wrap;gap:6px;}
.tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--ink2);background:var(--line2);border-radius:7px;padding:3px 8px;}
.tag.blu{background:var(--blus);color:var(--blu);} .tag.grn{background:var(--grns);color:var(--grn);}
.tag.amb{background:var(--ambs);color:var(--amb);} .tag.vio{background:var(--vios);color:var(--vio);}
.tag.red{background:var(--reds);color:var(--redd);}
.tag.ai{background:var(--reds);color:var(--redd);}

/* chips */
.chips{display:flex;gap:2px;flex-wrap:wrap;background:#f0f0f3;border-radius:999px;padding:3px;}
.chips-free{display:flex;gap:6px;flex-wrap:wrap;}
.chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--ink2);
  background:transparent;border-radius:999px;padding:6px 14px;transition:.13s;}
.chip:hover{background:rgba(20,20,26,.05);color:var(--ink);}
.chip.on{color:var(--ink);font-weight:700;background:#fff;
  box-shadow:0 0 0 1px rgba(20,20,26,.1),0 1px 4px rgba(20,20,26,.08);}

/* stat mini */

/* tickets: toggle + board + detail */
.seg{display:inline-flex;background:#f0f0f2;border-radius:999px;padding:3px;gap:2px;}
.seg button{font-size:12.5px;font-weight:600;color:var(--ink2);padding:6px 12px;border-radius:999px;
  display:inline-flex;align-items:center;gap:6px;transition:.12s;}
.seg button.on{background:#fff;color:var(--ink);box-shadow:var(--sh);}
.seg button.on svg{color:var(--red);}
.board{display:flex;gap:14px;padding:4px 2px 24px;overflow-x:auto;align-items:flex-start;}
.col{flex:1;min-width:282px;max-width:340px;display:flex;flex-direction:column;
  background:#fff;border-radius:18px;padding:14px 12px 12px;
  box-shadow:0 0 0 1px rgba(20,20,26,.07),0 1px 4px rgba(20,20,26,.04);}
.col.drag-over{box-shadow:0 0 0 2px #3b6fe0,0 4px 20px -6px rgba(59,111,224,.18);}
.colh{display:flex;align-items:center;gap:8px;margin-bottom:12px;font-weight:700;font-size:12.5px;}
.colh .cdot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.colh .cn{margin-left:auto;font-size:11.5px;font-weight:700;color:var(--ink3);
  background:#f0f0f3;border-radius:999px;padding:2px 9px;}
.col-cards{display:flex;flex-direction:column;gap:8px;min-height:48px;}
/* position-aware drop indicator */
.drop-line{height:3px;border-radius:999px;background:#3b6fe0;flex-shrink:0;
  position:relative;z-index:2;pointer-events:none;
  animation:dropLineIn .14s cubic-bezier(0.22,1,0.36,1) both;}
.drop-line::before{content:"";position:absolute;left:-3px;top:50%;transform:translateY(-50%);
  width:9px;height:9px;border-radius:50%;background:#3b6fe0;}
@keyframes dropLineIn{from{transform:scaleX(0.2);opacity:0}to{transform:scaleX(1);opacity:1}}
.tkcard{background:#fff;border-radius:13px;padding:13px 14px;
  box-shadow:0 1px 2px rgba(20,20,26,.05),0 1px 4px -1px rgba(20,20,26,.07),0 0 0 1px rgba(20,20,26,.05);
  cursor:grab;transition:transform .2s cubic-bezier(0.22,1,0.36,1),box-shadow .2s,opacity .2s;user-select:none;}
.tkcard:hover{transform:translateY(-2px);
  box-shadow:0 4px 14px -4px rgba(20,20,26,.16),0 0 0 1px rgba(20,20,26,.07);}
.tkcard:active{cursor:grabbing;}
.tkcard.is-dragging{opacity:.15;transform:scale(.96);box-shadow:none;}
.tkcard.card-enter{animation:cardEnter .26s cubic-bezier(0.22,1,0.36,1) both;}
@keyframes cardEnter{from{opacity:0;transform:translateY(-10px) scale(.97)}to{opacity:1;transform:none}}
.tktop{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:9px;}
.tkas{font-weight:700;font-size:13px;letter-spacing:-.02em;line-height:1.4;color:var(--ink);}
.tkmeta{display:flex;align-items:center;justify-content:space-between;gap:8px;
  margin-top:10px;padding-top:9px;border-top:1px solid #f0f0f3;}
.tkwho{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);font-weight:600;}
.tltime{font-size:11px;color:var(--ink3);font-weight:500;}
.colempty{font-size:12px;color:var(--ink3);text-align:center;padding:20px 10px;
  border-radius:10px;background:#f8f8fa;}
/* ── transitions.dev ── */
/* dropdown scale-from-origin */
.t-dropdown{transform-origin:top right;transform:scale(var(--dropdown-pre-scale));
  opacity:0;pointer-events:none;
  transition:transform var(--dropdown-open-dur) var(--dropdown-ease),
    opacity var(--dropdown-open-dur) var(--dropdown-ease);
  will-change:transform,opacity;}
.t-dropdown.is-open{transform:scale(1);opacity:1;pointer-events:auto;}
.t-dropdown.is-closing{transform:scale(var(--dropdown-closing-scale));opacity:0;pointer-events:none;
  transition:transform var(--dropdown-close-dur) var(--dropdown-ease),
    opacity var(--dropdown-close-dur) var(--dropdown-ease);}
/* modal scale */
.t-modal{transform-origin:center;transform:scale(var(--modal-scale));
  opacity:0;pointer-events:none;
  transition:transform var(--modal-open-dur) var(--modal-ease),
    opacity var(--modal-open-dur) var(--modal-ease);
  will-change:transform,opacity;}
.t-modal.is-open{transform:scale(1);opacity:1;pointer-events:auto;}
.t-modal.is-closing{transform:scale(var(--modal-scale));opacity:0;pointer-events:none;
  transition:transform var(--modal-close-dur) var(--modal-ease),
    opacity var(--modal-close-dur) var(--modal-ease);}
/* icon swap */
.t-icon-swap{position:relative;display:inline-grid;}
.t-icon-swap .t-icon{grid-area:1/1;transition:opacity var(--icon-swap-dur) var(--icon-swap-ease),
    filter var(--icon-swap-dur) var(--icon-swap-ease),
    transform var(--icon-swap-dur) var(--icon-swap-ease);will-change:opacity,filter,transform;}
.t-icon-swap[data-state="a"] .t-icon[data-icon="a"],.t-icon-swap[data-state="b"] .t-icon[data-icon="b"]{opacity:1;filter:blur(0);transform:scale(1);}
.t-icon-swap[data-state="a"] .t-icon[data-icon="b"],.t-icon-swap[data-state="b"] .t-icon[data-icon="a"]{opacity:0;filter:blur(var(--icon-swap-blur));transform:scale(var(--icon-swap-start-scale));}
/* error shake */
.t-input{transition:border-color 150ms ease-out;will-change:transform;}
.t-input.is-shaking{animation:t-input-shake calc(var(--shake-dur-a)*2 + var(--shake-dur-b)*2) linear;}
.t-input-wrap.is-error .t-error-msg{opacity:1;visibility:visible;transition:opacity var(--revert-dur) ease-out,visibility 0s linear 0s;}
.t-error-msg{opacity:0;visibility:hidden;transition:opacity var(--revert-dur) ease-out,visibility 0s linear var(--revert-dur);}
@keyframes t-input-shake{
  0%{transform:translateX(0);animation-timing-function:var(--shake-ease);}
  28.57%{transform:translateX(var(--shake-distance));animation-timing-function:var(--shake-ease);}
  57.14%{transform:translateX(calc(var(--shake-distance)*-1));animation-timing-function:var(--shake-ease);}
  78.57%{transform:translateX(var(--shake-overshoot));animation-timing-function:var(--shake-ease);}
  100%{transform:translateX(0);}
}
/* success check */
.t-success-check{display:inline-block;transform-origin:center;opacity:0;will-change:transform,opacity,filter;}
.t-success-check svg{display:block;overflow:visible;}
.t-success-check svg path{stroke-dasharray:20;stroke-dashoffset:20;}
.t-success-check[data-state="in"]{animation:t-check-fade var(--check-opacity-dur) var(--check-ease-out) forwards,t-check-rotate var(--check-rotate-dur) var(--check-ease-out) forwards,t-check-bob var(--check-bob-dur) var(--check-ease-bob) forwards;}
.t-success-check[data-state="in"] svg path{animation:t-check-draw var(--check-path-dur) var(--check-ease-path) var(--check-path-delay) forwards;}
@keyframes t-check-fade{from{opacity:0}to{opacity:1}}
@keyframes t-check-rotate{from{transform:rotate(var(--check-rotate-from))}to{transform:rotate(0deg)}}
@keyframes t-check-bob{from{translate:0 var(--check-y-amount)}to{translate:0 0}}
@keyframes t-check-draw{to{stroke-dashoffset:0}}
@media(prefers-reduced-motion:reduce){
  .t-dropdown,.t-modal,.t-icon-swap .t-icon{transition:none!important;}
  .t-input{animation:none!important;}
  .t-success-check{animation:none!important;opacity:1;}
  .t-success-check svg path{animation:none!important;stroke-dashoffset:0!important;}
}
.dbody{flex:1;overflow-y:auto;padding:20px 22px;scrollbar-width:none;-ms-overflow-style:none;}
.dbody::-webkit-scrollbar{display:none;}
.tkhead{position:relative;overflow:hidden;}
.tkhead .kglow{top:-44px;right:18px;}
.tkhead .dmark,.tkhead .dh-t,.tkhead .dh-s{position:relative;z-index:1;}
.treq{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:13px;font-size:13px;color:var(--ink2);}
.treq b{color:var(--ink);font-weight:700;}
.treqarea{display:inline-flex;align-items:center;gap:5px;}
.areadot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.ccrow{display:flex;align-items:center;gap:10px;padding:8px 0;font-size:13px;color:var(--ink2);font-weight:600;}
.ccrow svg{color:var(--ink3);flex-shrink:0;}
.elrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line2);}
.permchk{width:22px;height:22px;border-radius:7px;border:1.5px solid var(--line);background:#fff;display:inline-grid;
  place-items:center;color:#fff;transition:.12s;}
.permchk:hover:not(:disabled){border-color:#c4c4cc;}
.permchk.on{background:var(--red);border-color:var(--red);}
.permchk:disabled{opacity:.55;cursor:default;}
.permtbl th{text-align:left;}
.elrow:last-child{border-bottom:none;}
.elrow .eltxt{font-size:13px;font-weight:700;}
.elrow .elsub{font-size:11px;color:var(--ink3);margin-top:1px;}
.dempty{font-size:12.5px;color:var(--ink3);padding:4px 0 2px;}
.barrow{display:flex;align-items:center;gap:10px;padding:9px 0;}
.barlabel{font-size:12.5px;font-weight:600;color:var(--ink2);width:84px;flex-shrink:0;}
.bartrack{flex:1;height:7px;background:var(--line2);border-radius:99px;overflow:hidden;}
.barfill{height:100%;border-radius:99px;background:var(--red);transition:width .4s ease;}
.barfill.grn{background:var(--grn);} .barfill.blu{background:var(--blu);} .barfill.vio{background:var(--vio);} .barfill.amb{background:var(--amb);}
.barval{font-size:12px;font-weight:700;color:var(--ink2);width:38px;text-align:right;flex-shrink:0;}
/* org chart */
.orgwrap{padding:32px 28px 36px;overflow-x:auto;display:flex;flex-direction:column;align-items:center;gap:0;min-height:320px;}
.orgnode{display:flex;flex-direction:column;align-items:center;position:relative;}
.orgcard{background:#fff;border-radius:18px;padding:14px 20px 13px;
  box-shadow:0 1px 3px rgba(20,20,26,.05),0 6px 18px -8px rgba(20,20,26,.1);
  display:flex;flex-direction:column;align-items:center;gap:8px;
  transition:.15s;min-width:150px;max-width:180px;cursor:pointer;border:none;}
.orgcard:hover{box-shadow:0 4px 16px -4px rgba(20,20,26,.14),0 1px 3px rgba(20,20,26,.06);transform:translateY(-2px);}
.orgname{font-weight:700;font-size:12.5px;letter-spacing:-.02em;text-align:center;white-space:nowrap;color:var(--ink);}
.orgrole{font-size:10.5px;color:var(--ink3);text-align:center;font-weight:500;}
.orgdept{font-size:10px;background:#f4f4f6;color:var(--ink2);border-radius:6px;padding:2px 8px;font-weight:600;margin-top:2px;}
.orglevel{display:flex;gap:20px;position:relative;margin-top:0;padding-top:0;flex-wrap:wrap;justify-content:center;}
.orgconnect{display:flex;flex-direction:column;align-items:center;}
.orgline-v{width:1.5px;height:28px;background:#e4e4e8;flex-shrink:0;}
.orgline-h-wrap{display:flex;align-items:flex-start;position:relative;}
.orgchildren{display:flex;gap:20px;justify-content:center;}
/* health index widget */
.hix{display:flex;align-items:center;gap:28px;}
.hix-score{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0;width:100px;}
.hix-num{font-size:58px;font-weight:900;letter-spacing:-.06em;line-height:1;}
.hix-num.grn{color:var(--grn)}.hix-num.amb{color:var(--amb)}.hix-num.red{color:var(--redd)}
.hix-lbl{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);}
.hix-track{width:90px;height:6px;background:var(--line2);border-radius:99px;overflow:hidden;margin-top:2px;}
.hix-fill{height:100%;border-radius:99px;transition:width .6s ease;}
.hix-fill.grn{background:var(--grn)}.hix-fill.amb{background:var(--amb)}.hix-fill.red{background:var(--redd)}
.hix-bars{flex:1;display:flex;flex-direction:column;gap:9px;}
.hix-row{display:flex;align-items:center;gap:10px;}
.hix-name{font-size:12px;font-weight:600;color:var(--ink2);width:154px;flex-shrink:0;}
.hix-bar{flex:1;height:5px;background:var(--line2);border-radius:99px;overflow:hidden;}
.hix-bar-fill{height:100%;border-radius:99px;transition:width .5s ease;}
.hix-bar-fill.grn{background:var(--grn)}.hix-bar-fill.amb{background:var(--amb)}
.hix-bar-val{font-size:11.5px;font-weight:700;color:var(--ink2);width:30px;text-align:right;flex-shrink:0;}
/* risk center */
.riskgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;padding:20px;}
.riskcard{background:#fafafb;border-radius:var(--rs);padding:16px;
  display:flex;flex-direction:column;gap:10px;transition:.15s;}
.riskcard.sev-alta{background:linear-gradient(160deg,#fdf5f5,#fff 60%);}
.riskcard.sev-media{background:linear-gradient(160deg,#fdfaf0,#fff 60%);}
.riskcard:hover{box-shadow:var(--e2);transform:translateY(-1px);}
.riskhead{display:flex;align-items:center;gap:8px;}
.riskname{font-weight:800;font-size:14px;letter-spacing:-.025em;color:var(--ink1);}
.riskarea{font-size:11.5px;color:var(--ink3);font-weight:700;display:flex;align-items:center;gap:5px;}
.riskdetail{font-size:13px;color:var(--ink2);line-height:1.5;flex:1;}
.riskfooter{display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding-top:11px;border-top:1px solid var(--line2);}
.riskaction{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--ink2);}
/* recommendation cards */
.reccards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
.reccard{border-radius:var(--rs);padding:16px 18px;display:flex;flex-direction:column;gap:10px;
}
.reccard.red{background:linear-gradient(160deg,#fdf5f5,#fff 55%);}
.reccard.amb{background:linear-gradient(160deg,#fdfaf0,#fff 55%);}
.reccard.blu{background:linear-gradient(160deg,#f0f5fe,#fff 55%);}
.reccard.vio{background:linear-gradient(160deg,#f5f0fe,#fff 55%);}
.reccard.grn{background:linear-gradient(160deg,#f0fdf6,#fff 55%);}
.rechd{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.recto{font-weight:800;font-size:14px;letter-spacing:-.025em;margin-top:2px;}
.recra{font-size:12.5px;color:var(--ink2);line-height:1.45;}
.recft{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;}
.reccat{font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em;}
/* talent / skills matrix */
.skillmatrix{overflow-x:auto;padding:0 20px 20px;}
.smtable{border-collapse:separate;border-spacing:0;width:100%;}
.smtable th{padding:9px 8px;font-size:11px;font-weight:700;color:var(--ink3);white-space:nowrap;text-transform:uppercase;letter-spacing:.04em;}
.smtable th:first-child{text-align:left;min-width:148px;}
.smtable td{padding:6px 8px;text-align:center;}
.smtable td:first-child{text-align:left;}
.smtable tr:hover td{background:var(--line2);}
.smcell{width:30px;height:30px;border-radius:8px;margin:0 auto;transition:.15s;}
.smlegend{display:flex;align-items:center;gap:14px;padding:10px 0 0;flex-wrap:wrap;}
/* succession planning */
.sucgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;padding:20px;}
.succard{background:#fafafb;border-radius:var(--rs);padding:18px;display:flex;flex-direction:column;gap:14px;}
.succard.crit{background:linear-gradient(160deg,#fdf8f8,#fff 55%);}
.sucready{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line2);}
.sucready:last-child{border-bottom:none;}
.sucscorebar{width:72px;height:5px;background:var(--line2);border-radius:99px;overflow:hidden;flex-shrink:0;}
/* journey timeline reuses .tli/.tlrail etc */
/* rotation risk prediction */
.riskbar{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--line2);}
.riskbar:last-child{border-bottom:none;}
.riskpct{font-size:12px;font-weight:800;width:36px;text-align:right;flex-shrink:0;}
.riskpct.high{color:var(--redd)} .riskpct.med{color:var(--amb)} .riskpct.low{color:var(--grn)}
/* benchmarking */
.benchtable{width:100%;border-collapse:collapse;}
.benchtable th{font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);}
.benchtable td{padding:10px 12px;font-size:13px;border-bottom:1px solid var(--line2);}
.benchtable tr:last-child td{border-bottom:none;}
.benchval{font-weight:700;font-size:13.5px;}
.benchval.best{color:var(--grn)} .benchval.worst{color:var(--redd)}
/* employee journey */
.jfunnel{display:flex;gap:8px;overflow-x:auto;padding:4px 0 14px;align-items:flex-start;}
.jstage{flex:1;min-width:120px;cursor:pointer;}
.jbar{display:flex;align-items:center;gap:8px;padding:11px 14px;border-radius:12px;font-weight:700;font-size:13px;transition:.15s;border:1.5px solid transparent;}
.jbar.b-blu{background:var(--blus);color:var(--blu);} .jbar.b-vio{background:var(--vios);color:var(--vio);}
.jbar.b-grn{background:var(--grns);color:var(--grn);} .jbar.b-amb{background:var(--ambs);color:var(--amb);}
.jbar.b-red{background:var(--reds);color:var(--redd);} .jbar.b-ink{background:var(--line2);color:var(--ink2);}
.jstage.sel .jbar{box-shadow:var(--e2);transform:translateY(-1px);}
.jcount{margin-left:auto;font-size:20px;font-weight:900;letter-spacing:-.04em;}
.jsub{font-size:11px;color:var(--ink3);margin-top:6px;font-weight:600;padding-left:2px;}
.jrow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--line2);cursor:pointer;}
.jrow:last-child{border-bottom:none;} .jrow:hover{background:var(--line2);margin:0 -6px;padding:10px 6px;border-radius:8px;}
/* simulations */
.simcontrol{display:flex;flex-direction:column;gap:18px;}
.simlabel{font-size:12.5px;font-weight:700;color:var(--ink2);margin-bottom:5px;display:flex;justify-content:space-between;}
.simrange{width:100%;accent-color:#3b6fe0;height:5px;margin:4px 0;}
.simresult{border:1.5px solid var(--line);border-radius:12px;padding:15px 16px;transition:.15s;}
.simresult.pos{background:linear-gradient(160deg,#f0fdf6,#fff 55%);}
.simresult.neg{background:linear-gradient(160deg,#fdf8f8,#fff 55%);}
.simresult.neu{background:linear-gradient(160deg,#f0f5fe,#fff 55%);}
/* heatmap */
.heatwrap{padding:4px 0 8px;}
.heatdows{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;}
.heatdow{text-align:center;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;}
.heatgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
.heatcell{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;cursor:default;transition:.1s;}
.heatcell:hover{transform:scale(1.15);}
.heatcell.e{background:transparent;}
.heatcell.l0{background:var(--line2);color:var(--ink3);}
.heatcell.l1{background:#fef3c7;color:var(--amb);}
.heatcell.l2{background:#fde68a;color:#92400e;}
.heatcell.l3{background:#f59e0b;color:#fff;}
.heatcell.l4{background:var(--redd);color:#fff;}
.heatlegend{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11.5px;font-weight:600;color:var(--ink2);}
/* org overlay */
.orgmetasel{display:flex;align-items:center;gap:8px;padding:0 0 20px;flex-wrap:wrap;}
.orgnode-badge{position:absolute;bottom:-3px;right:-3px;width:12px;height:12px;border-radius:50%;border:2px solid #fff;z-index:2;}

.dsect{font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--ink3);text-transform:uppercase;margin:18px 0 10px;}
.aibox{position:relative;overflow:hidden;background:linear-gradient(160deg,#fdeeee,#fff 72%);
  border:1px solid #f6d6d6;border-radius:14px;padding:13px;display:flex;gap:11px;}
.aibox .kglow{top:-40px;right:-20px;opacity:.4;background:#ff8a8d;}
.aibox .aii{position:relative;z-index:1;width:32px;height:32px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(145deg,#ff8a8d,#e5484d);box-shadow:0 6px 14px -6px rgba(229,72,77,.55);
  display:grid;place-items:center;color:#fff;}
.aibox .at{position:relative;z-index:1;font-weight:800;font-size:12.5px;color:var(--redd);}
.aibox .ad{position:relative;z-index:1;font-size:12.5px;color:#7a3033;margin-top:2px;line-height:1.45;}
.dacts{padding:14px 20px;border-top:1px solid var(--line);display:flex;gap:9px;}

/* AI drawer */
.ovl{position:fixed;inset:0;background:rgba(20,20,26,.32);backdrop-filter:blur(2px);z-index:90;
  animation:fade .2s both;}
.drawer{position:fixed;top:10px;right:10px;bottom:10px;width:430px;max-width:calc(100vw - 20px);
  background:#fff;border-radius:22px;
  z-index:100;display:flex;flex-direction:column;overflow:hidden;
  box-shadow:0 8px 32px -8px rgba(20,20,26,.2),0 2px 8px rgba(20,20,26,.06);
  animation:slide var(--panel-open-dur) var(--panel-ease) both;}
.dhead{padding:18px 22px 16px;border-bottom:1px solid #f0f0f2;display:flex;align-items:center;gap:12px;}
.dmark{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;background:var(--ink);}
.dh-t{font-weight:800;font-size:15px;letter-spacing:-.035em;}
.dh-s{font-size:11.5px;color:var(--ink3);font-weight:600;display:flex;align-items:center;gap:5px;}
.dh-s .live{width:6px;height:6px;border-radius:50%;background:var(--grn);}
.orb{border-radius:50%;flex-shrink:0;background:
  radial-gradient(circle at 30% 26%,#ffe9a8 0%,transparent 40%),
  radial-gradient(circle at 64% 38%,#ff9a4d 0%,transparent 52%),
  radial-gradient(circle at 32% 70%,#ff4d6a 0%,transparent 50%),
  radial-gradient(circle at 76% 80%,#ffc7b0 0%,transparent 56%),
  linear-gradient(135deg,#fff6ea,#ffffff);}
.orb.xs{width:28px;height:28px;box-shadow:0 3px 10px -3px rgba(255,107,53,.55);}
.orb.sm{width:38px;height:38px;box-shadow:0 4px 13px -4px rgba(255,107,53,.55);}
.orb.lg{width:72px;height:72px;filter:blur(6px) saturate(1.35);box-shadow:0 10px 26px -10px rgba(255,107,53,.5);}
.msgs{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px;}
.msg{display:flex;gap:10px;max-width:90%;}
.msg.u{align-self:flex-end;flex-direction:row-reverse;}
.bub{padding:10px 13px;border-radius:14px;font-size:13.5px;line-height:1.5;}
.msg.b .bub{background:var(--line2);border-bottom-left-radius:5px;white-space:pre-wrap;}
.msg.u .bub{background:var(--ink);color:#fff;border-bottom-right-radius:5px;}
.dhero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
  padding:28px 30px;}
.dhero .orb{margin-bottom:20px;}
.dhero h3{font-size:16.5px;font-weight:800;letter-spacing:-.04em;margin-bottom:7px;}
.dhero p{font-size:13px;color:var(--ink2);line-height:1.55;max-width:280px;}
.qrow{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:6px 20px 18px;}
.qchip{display:inline-flex;align-items:center;gap:6px;background:#ebebee;
  border-radius:999px;padding:8px 13px;font-size:12px;font-weight:700;color:var(--ink2);
  box-shadow:var(--e1);transition:.12s;}
.qchip:hover{color:var(--ink);background:var(--reds);transform:translateY(-1px);}
.qchip svg{color:var(--red);flex-shrink:0;}
.ainput{margin:0 16px 16px;padding:7px 7px 7px 14px;background:#eeeef1;border-radius:20px;
  background:#fff;display:flex;align-items:flex-end;gap:8px;box-shadow:var(--e1);transition:.15s;}
.ainput:focus-within{box-shadow:0 0 0 3px var(--line2),var(--e1);}
.ainput textarea{flex:1;border:none;outline:none;resize:none;font-size:13.5px;background:transparent;
  padding:9px 0;max-height:110px;}
.aplus{width:34px;height:34px;border-radius:50%;background:var(--line2);display:grid;place-items:center;
  color:var(--ink2);flex-shrink:0;transition:.12s;margin-bottom:2px;}
.aplus:hover{background:var(--line);color:var(--ink);}
.sbtn{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex-shrink:0;color:#fff;
  background:linear-gradient(180deg,#ec5256,#e0383d);transition:transform .12s,box-shadow .15s,background .15s,color .15s;
  box-shadow:var(--e2);}
.sbtn:hover{background:linear-gradient(180deg,#e8484d,#d2353a);box-shadow:var(--e3);}
.sbtn:active{transform:translateY(1px);box-shadow:var(--e1);}
/* ═══ ASISTENTE IA ═══ */
.ia-page{display:flex;flex-direction:column;height:100%;}
.ia-msgs{flex:1;overflow-y:auto;}
.ia-inner{max-width:660px;margin:0 auto;padding:24px 20px 8px;display:flex;flex-direction:column;gap:12px;}
.ia-welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:calc(100vh - 260px);gap:0;}
.ia-orb{width:140px;height:140px;flex-shrink:0;margin-bottom:24px;
  background:radial-gradient(ellipse at 46% 40%,rgba(255,165,90,.9) 0%,rgba(255,95,130,.7) 38%,rgba(210,65,185,.28) 68%,transparent 100%);
  filter:blur(22px);border-radius:50%;animation:orbdrift 7s ease-in-out infinite;}
@keyframes orbdrift{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1.07) translateY(-8px)}}
.ia-title{font-size:22px;font-weight:800;letter-spacing:-.05em;color:var(--ink);margin-bottom:20px;line-height:1.2;}
.ia-pills{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:480px;}
.ia-pill{background:#f0f0f3;border-radius:999px;padding:8px 18px;font-size:12.5px;font-weight:600;
  color:var(--ink2);transition:.13s;}
.ia-pill:hover{background:#e8e8ec;color:var(--ink);}
.ia-row{display:flex;gap:9px;animation:iaIn .2s cubic-bezier(.22,1,.36,1) both;}
@keyframes iaIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.ia-row.me{justify-content:flex-end;}
.ia-row.ai{align-items:flex-end;}
.ia-ava{width:24px;height:24px;border-radius:50%;flex-shrink:0;
  background:radial-gradient(ellipse at 46% 40%,rgba(255,165,90,.95) 0%,rgba(255,95,130,.85) 50%,rgba(210,65,185,.55) 100%);
  filter:blur(2.5px);}
.ia-bub{padding:10px 14px;font-size:13.5px;line-height:1.65;white-space:pre-wrap;border-radius:16px;}
.ia-row.me .ia-bub{background:#18181b;color:#fff;border-bottom-right-radius:5px;max-width:72%;}
.ia-row.ai .ia-bub{background:#fff;color:var(--ink);border-bottom-left-radius:5px;max-width:88%;
  box-shadow:0 1px 2px rgba(20,20,26,.04),0 2px 8px -4px rgba(20,20,26,.07);}
.ia-composer{padding:8px 20px 22px;max-width:640px;width:100%;margin:0 auto;box-sizing:border-box;}
.ia-box{background:#fff;border-radius:22px;padding:20px 20px 14px 22px;
  box-shadow:0 2px 16px -4px rgba(20,20,26,.1),0 0 0 1px rgba(20,20,26,.06);transition:.2s;}
.ia-box:focus-within{box-shadow:0 4px 24px -6px rgba(20,20,26,.12),0 0 0 1px rgba(20,20,26,.09);}
.ia-text{width:100%;border:none;outline:none;resize:none;font-size:17px;font-family:inherit;
  font-weight:500;background:transparent;color:var(--ink);min-height:26px;max-height:160px;
  line-height:1.5;display:block;margin-bottom:14px;}
.ia-text::placeholder{color:#b0b0ba;font-weight:500;}
.ia-foot{display:flex;align-items:center;gap:8px;}
.ia-attach{width:42px;height:42px;border-radius:50%;background:#f0f0f3;color:var(--ink2);
  display:grid;place-items:center;transition:.13s;flex-shrink:0;}
.ia-attach:hover{background:#e6e6ea;color:var(--ink);}
.ia-foot-space{flex:1;}
.ia-go{width:42px;height:42px;border-radius:50%;background:#18181b;color:#fff;flex-shrink:0;
  display:grid;place-items:center;transition:.12s;}
.ia-go:hover:not(:disabled){background:#333;}
.ia-go:disabled{background:#e8e8ec;color:#c0c0ca;cursor:not-allowed;}
.typing{display:flex;gap:4px;padding:3px 2px;}
.typing i{width:5px;height:5px;border-radius:50%;background:#b8b8c0;animation:bounce 1s infinite;}
.typing i:nth-child(2){animation-delay:.15s;}.typing i:nth-child(3){animation-delay:.3s;}
@media(max-width:760px){
  .ia-inner,.ia-composer{padding-left:14px;padding-right:14px;}
  .ia-row.me .ia-bub{max-width:84%;}
}
/* option cards (create modal) */
.optgrid{display:grid;grid-template-columns:1fr 1fr;gap:11px;}
.optcard{border-radius:14px;padding:14px;cursor:pointer;position:relative;transition:.13s;background:#f4f4f6;}
.optcard:hover{background:#eeeef1;}
.optcard.on{background:#fff;box-shadow:0 0 0 2px var(--red),var(--e1);}
.optcard .ot{font-weight:700;font-size:13.5px;}
.optcard .od{font-size:12px;color:var(--ink2);margin-top:3px;}
.optcheck{position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:50%;border:1.5px solid var(--line);
  display:grid;place-items:center;color:transparent;transition:.13s;}
.optcard.on .optcheck{background:var(--red);border-color:var(--red);color:#fff;}
.flabel{font-size:12px;font-weight:600;color:var(--ink);letter-spacing:-.01em;margin:14px 0 6px;}
.field{width:100%;border:none;border-radius:999px;padding:9px 14px;font-size:13.5px;
  background:#eeeef1;outline:none;color:var(--ink);transition:.15s;font-family:inherit;font-weight:500;}
.field:hover{background:#e8e8ec;}
.field:focus{background:#fff;box-shadow:0 0 0 3px var(--line2),var(--e1);}
/* share modal */
.invite{display:flex;gap:8px;align-items:center;padding:0 0 4px;}
.role{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:11px;padding:9px 11px;
  font-size:12.5px;font-weight:700;color:var(--ink2);background:#fff;flex-shrink:0;cursor:pointer;}
.acc{display:flex;align-items:center;gap:12px;padding:11px 4px;width:100%;text-align:left;border-radius:11px;transition:.12s;}
.acc:hover{background:var(--line2);}
.acc .acico{width:36px;height:36px;border-radius:10px;background:var(--line2);display:grid;place-items:center;color:var(--ink2);flex-shrink:0;}
.acc .act{font-weight:700;font-size:13.5px;} .acc .acs{font-size:12px;color:var(--ink3);}
.prow{display:flex;align-items:center;gap:11px;padding:9px 0;}
.prole{font-size:12.5px;font-weight:700;color:var(--ink2);display:inline-flex;align-items:center;gap:5px;transition:.12s;}
.prole:hover{color:var(--ink);}
.premove{width:26px;height:26px;border-radius:8px;background:var(--red);color:#fff;display:none;place-items:center;flex-shrink:0;}
.prow:hover .premove{display:grid;}
.copybar{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--line);margin-top:10px;padding-top:14px;}
.copybar .lk{font-size:12px;color:var(--ink3);font-family:'JetBrains Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
/* AI composer */
.modalw{width:640px;}
.fbar{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:8px 0 12px;}
.fbtn{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:var(--ink2);transition:.12s;}
.fbtn:hover{background:var(--line2);color:var(--ink);}
.fsep{width:1px;height:18px;background:var(--line);margin:0 4px;}
.ftxt{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:6px 10px;border-radius:8px;color:var(--ink2);}
.ftxt:hover{background:var(--line2);}
.aipill{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:var(--redd);
  border:1.5px solid #f3c6c8;background:var(--reds);border-radius:10px;padding:7px 12px;transition:.12s;}
.aipill:hover{background:#fbe0e1;}
.editor{width:100%;min-height:200px;border:none;border-radius:14px;padding:14px 16px;font-size:14px;background:#eeeef1;
  line-height:1.6;resize:vertical;outline:none;background:#fff;color:var(--ink);}
.editor:focus{box-shadow:0 0 0 3px var(--line2),var(--e1);}
.aibar{margin-top:12px;border:1px solid var(--line);border-radius:14px;padding:12px;background:#fafafb;}
.aibar-h{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:var(--ink2);margin-bottom:10px;}
.aichips{display:flex;flex-wrap:wrap;gap:7px;}
.aichip{font-size:12.5px;font-weight:600;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:9px;
  padding:6px 11px;transition:.12s;display:inline-flex;align-items:center;gap:6px;}
.aichip:hover{color:var(--redd);background:var(--reds);}
.aichip:disabled{opacity:.5;cursor:default;}
/* toasts */
.toasts{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:120;display:flex;
  flex-direction:column;gap:10px;align-items:center;width:max-content;max-width:92vw;pointer-events:none;}
.toast{pointer-events:auto;display:flex;align-items:center;gap:11px;color:#fff;border-radius:13px;
  padding:11px 13px 11px 12px;min-width:288px;background:linear-gradient(180deg,#26282e,#191b1f);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.1),var(--e4);
  animation:toastin .38s cubic-bezier(.16,1,.3,1) both;}
.toast.out{animation:toastout .22s cubic-bezier(.4,0,1,1) both;}
.tci{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;color:#fff;}
.tci.ok{background:#1f9d63;} .tci.err{background:#e5484d;} .tci.info{background:#6b7280;} .tci.warn{background:#bf8410;}
.tmsg{font-size:13px;font-weight:600;flex:1;}
.tact{margin-left:6px;font-size:12.5px;font-weight:700;color:#fff;background:rgba(255,255,255,.1);
  border-radius:8px;padding:5px 10px;transition:.12s;flex-shrink:0;}
.tact:hover{background:rgba(255,255,255,.2);}
/* upload cards */
.upwrap{position:fixed;bottom:24px;right:24px;z-index:115;display:flex;flex-direction:column-reverse;gap:10px;
  width:300px;max-width:88vw;}
.upcard{background:#fff;border:1px solid var(--line);border-radius:15px;padding:14px 14px 12px;
  box-shadow:var(--e4);animation:toastin .38s cubic-bezier(.16,1,.3,1) both;}
.uphead{display:flex;align-items:flex-start;gap:10px;}
.upico{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;color:#fff;margin-top:1px;}
.upico.ink{background:var(--ink3);} .upico.blu{background:var(--blu);} .upico.grn{background:var(--grn);}
.uptxt{flex:1;min-width:0;}
.uptitle{font-size:12.5px;font-weight:700;color:var(--ink);line-height:1.4;}
.uptitle b{color:var(--blu);font-weight:700;}
.upsub{font-size:11.5px;color:var(--ink3);margin-top:1px;}
.upx{color:var(--ink3);flex-shrink:0;transition:.12s;}
.upx:hover{color:var(--ink);}
.upbar{height:5px;background:var(--line2);border-radius:99px;margin-top:11px;overflow:hidden;}
.upfill{height:100%;border-radius:99px;transition:width .45s ease;}
.upfoot{display:flex;justify-content:flex-end;margin-top:7px;}
.uppct{font-size:11px;color:var(--ink3);font-weight:600;}
/* switch */
.sw{width:38px;height:22px;border-radius:999px;background:#d8d8de;position:relative;transition:.18s;flex-shrink:0;cursor:pointer;border:none;}
.sw::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;
  background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:.18s;}
.sw.on{background:var(--red);} .sw.on::after{transform:translateX(16px);}
/* sign modal */
.mwrap{position:fixed;inset:0;z-index:110;display:grid;place-items:center;padding:20px;
  background:rgba(20,20,26,.34);backdrop-filter:blur(3px);animation:fade .18s both;}
.modal{width:440px;max-width:100%;background:#fff;border-radius:20px;box-shadow:var(--e4);overflow:hidden;
  display:flex;flex-direction:column;max-height:90vh;animation:pop .26s cubic-bezier(.22,1,.36,1) both;}
@media(max-width:760px){
  .mwrap{padding:0;align-items:flex-end;place-items:end center;}
  .modal{width:100%;max-width:100%;border-radius:22px 22px 0 0;max-height:92vh;
    animation:slideup .28s cubic-bezier(.22,1,.36,1) both;}
  .modal::before{content:'';display:block;width:36px;height:4px;background:#dddde2;
    border-radius:2px;margin:12px auto 2px;flex-shrink:0;}
}
@keyframes slideup{from{transform:translateY(100%)}to{transform:none}}
.mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;flex-shrink:0;}
.mtitle{font-weight:800;font-size:17px;letter-spacing:-.04em;}
.mbody{padding:0 20px 4px;overflow-y:auto;flex:1 1 auto;min-height:0;}
.sigarea{border-radius:14px;background:#fafafb;border:1px solid var(--line);padding:6px;position:relative;}
.sigarea canvas{width:100%;height:150px;display:block;border-radius:10px;touch-action:none;cursor:crosshair;}
.sighint{position:absolute;inset:0;display:grid;place-items:center;color:var(--ink3);font-size:13px;pointer-events:none;}
.sigbar{display:flex;align-items:center;gap:16px;padding:10px 4px 2px;}
.sigbar button{font-size:12.5px;font-weight:700;color:var(--ink2);display:inline-flex;align-items:center;gap:6px;}
.sigbar button:hover{color:var(--ink);}
.agree{display:flex;align-items:flex-start;gap:11px;border:1px solid var(--line);border-radius:13px;padding:13px;margin-top:14px;}
.agree.bad{border-color:#f3c6c8;background:var(--reds);}
.agreetxt{font-size:12.5px;color:var(--ink2);line-height:1.45;}
.errline{display:flex;align-items:center;gap:7px;color:var(--redd);font-size:12.5px;font-weight:600;margin-top:10px;}
/* login */
.loginwrap{min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;padding:20px;
  background:
    radial-gradient(circle at 18% 14%, rgba(229,72,77,.10), transparent 42%),
    radial-gradient(circle at 84% 82%, rgba(124,92,214,.10), transparent 46%),
    var(--bg);}
.loginbox{width:380px;max-width:100%;background:#fff;border:1px solid var(--line);border-radius:20px;
  box-shadow:var(--e4);padding:36px 32px 30px;}
.loginlogo{display:flex;justify-content:center;margin-bottom:16px;}
.logintitle{font-size:19px;font-weight:800;letter-spacing:-.04em;text-align:center;}
.loginsub{font-size:13px;color:var(--ink2);text-align:center;margin-top:4px;}
.loginrow{display:flex;align-items:center;justify-content:space-between;margin:14px 0 18px;font-size:12.5px;}
.remember{display:flex;align-items:center;gap:8px;color:var(--ink2);font-weight:600;font-size:13px;}
.remember input[type=checkbox]{width:18px;height:18px;accent-color:#3b6fe0;cursor:pointer;}
input[type=checkbox]{accent-color:#3b6fe0;}
.loginlink{color:var(--red);font-weight:700;font-size:12.5px;}
.loginlink:hover{text-decoration:underline;}
.loginfoot{text-align:center;font-size:12.5px;color:var(--ink2);margin-top:18px;}
.mfoot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 20px;border-top:1px solid var(--line);margin-top:16px;}
/* status card */
.statuscard{text-align:center;padding:34px 28px 8px;}
.statuscard.ok{background:linear-gradient(165deg,#eafcf3,#fff 60%);}
.statuscard.err{background:linear-gradient(165deg,#fdecec,#fff 60%);}
.statuscard.pending{background:linear-gradient(165deg,#eaf1fd,#fff 60%);}
.statuscard.warn{background:linear-gradient(165deg,#fdf3e1,#fff 60%);}
.scico{width:52px;height:52px;border-radius:50%;background:#fff;display:grid;place-items:center;margin:0 auto 16px;box-shadow:var(--e2);}
.statuscard.ok .scico{color:var(--grn);} .statuscard.err .scico{color:var(--red);}
.statuscard.pending .scico{color:var(--blu);} .statuscard.warn .scico{color:var(--amb);}
.sctitle{font-size:16.5px;font-weight:800;letter-spacing:-.04em;margin-bottom:7px;}
.scsub{font-size:13px;color:var(--ink2);line-height:1.55;max-width:280px;margin:0 auto;}
.scacts{display:flex;gap:10px;justify-content:center;margin-top:22px;padding-bottom:26px;}
@keyframes toastin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes toastout{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(6px)}}
@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes slide{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.rise{animation:up .5s both;}
.rise.d1{animation-delay:.04s}.rise.d2{animation-delay:.08s}.rise.d3{animation-delay:.12s}
.rise.d4{animation-delay:.16s}.rise.d5{animation-delay:.2s}.rise.d6{animation-delay:.24s}

@media (max-width:1080px){ .g2{grid-template-columns:1fr;} }
@media (max-width:760px){
  .sb{position:fixed;left:0;top:0;height:100%;background:var(--panel);transform:translateX(-100%);transition:transform .25s;box-shadow:var(--e4);}
  .sb.open{transform:none;}
  .ham{display:grid;} .search{display:none;} .crumb{display:none;} .tdiv{display:none;}
  .aitop{padding:0;width:38px;height:38px;} .aitop .lbl{display:none;}
  .g2b{grid-template-columns:1fr;}
  .content{padding:18px 14px 50px;} .top{padding:0 14px;}
  .h1{font-size:21px;} .phead{margin-bottom:18px;}
  .card{overflow-x:auto;}
  .tbl th,.tbl td{padding:11px 14px;}
  .gkpi{display:flex;overflow-x:auto;gap:11px;margin:-8px 0 8px;padding:8px 0 24px;
    -webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;align-items:stretch;}
  .gkpi>div{flex:0 0 180px;scroll-snap-align:start;display:flex;flex-direction:column;}
  .gkpi .kpi{min-width:180px;overflow:hidden;}
  .gkpi .kvs{display:none;}
  .g3{display:flex;overflow-x:auto;gap:11px;margin:-8px 0 -8px;padding:8px 0 24px;
    -webkit-overflow-scrolling:touch;align-items:stretch;}
  .g3>div{flex:0 0 158px;display:flex;flex-direction:column;}
  .g3 .stat{overflow:hidden;}
  .g3.docgrid{display:flex;flex-direction:column;gap:14px;overflow:visible;margin:0;padding:0;}
  .g3.docgrid>div{flex:none;display:block;}
}
/* printable invoice */
.printarea{display:none;}
.pinv-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;}
.pinv-logo{font-size:22px;font-weight:800;letter-spacing:-.04em;}
.pinv-sub{font-size:13px;color:#555;margin-top:2px;}
.pinv-meta{text-align:right;font-size:12.5px;color:#333;line-height:1.7;}
.pinv-meta b{font-weight:700;margin-right:5px;}
.pinv-parties{display:flex;justify-content:space-between;gap:30px;margin-bottom:26px;padding-bottom:18px;border-bottom:1px solid #ddd;}
.pinv-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:3px;}
.pinv-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;}
.pinv-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#777;
  border-bottom:2px solid #222;padding:8px 6px;}
.pinv-table td{padding:9px 6px;border-bottom:1px solid #e2e2e2;}
.pinv-total{text-align:right;font-size:17px;font-weight:800;letter-spacing:-.03em;margin-bottom:30px;}
.pinv-foot{font-size:11px;color:#999;border-top:1px solid #ddd;padding-top:12px;}
@media print{
  body *{visibility:hidden;}
  .printarea, .printarea *{visibility:visible;}
  .printarea{display:block;position:fixed;top:0;left:0;width:100%;padding:40px;}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}
`;

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const initials = (n) => n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const EMPLEADOS = [
  { id: "EMP-1042", name: "María González", role: "Diseñadora de Producto", dept: "Producto", loc: "Bogotá", st: "Activo", perm: "Empleado", manager: "Camila Restrepo" },
  { id: "EMP-1043", name: "Juan Pérez", role: "Desarrollador Backend", dept: "Ingeniería", loc: "Medellín", st: "Activo", perm: "Empleado", manager: "Camila Restrepo" },
  { id: "EMP-1044", name: "Camila Restrepo", role: "Líder de RRHH", dept: "Personas", loc: "Bogotá", st: "Activo", perm: "Administrador", manager: null },
  { id: "EMP-1045", name: "Andrés Mora", role: "Analista Financiero", dept: "Finanzas", loc: "Cali", st: "En licencia", perm: "Líder de equipo", manager: "Camila Restrepo" },
  { id: "EMP-1046", name: "Valentina Ruiz", role: "Especialista en Marketing", dept: "Marketing", loc: "Popayán", st: "Activo", perm: "Empleado", manager: "Camila Restrepo" },
  { id: "EMP-1047", name: "Sebastián Cano", role: "Diseñador UX", dept: "Producto", loc: "Bogotá", st: "Onboarding", perm: "Empleado", manager: "María González" },
  { id: "EMP-1048", name: "Laura Jiménez", role: "Contadora", dept: "Finanzas", loc: "Medellín", st: "Activo", perm: "Líder de equipo", manager: "Andrés Mora" },
  { id: "EMP-1049", name: "Daniel Ospina", role: "Soporte TI", dept: "Ingeniería", loc: "Cali", st: "Activo", perm: "Empleado", manager: "Juan Pérez" },
];

const FIRMAS = [
  { id: "DOC-3201", name: "Contrato laboral", who: "Sebastián Cano", type: "Contrato", st: "Pendiente", date: "18 jun 2026", days: 2 },
  { id: "DOC-3195", name: "Política de seguridad", who: "Juan Pérez", type: "Política", st: "Pendiente", date: "12 jun 2026", days: 8 },
  { id: "DOC-3190", name: "Anexo de teletrabajo", who: "María González", type: "Anexo", st: "Vencido", date: "02 jun 2026", days: 18 },
  { id: "DOC-3198", name: "Acuerdo de confidencialidad", who: "Valentina Ruiz", type: "Acuerdo", st: "Firmado", date: "15 jun 2026" },
  { id: "DOC-3187", name: "Contrato laboral", who: "Laura Jiménez", type: "Contrato", st: "Firmado", date: "28 may 2026" },
];

const INVENTARIO = [
  { id: "INV-0571", item: 'MacBook Pro 14"', cat: "Cómputo", who: "María González", serial: "C02XL14ABCD", st: "Asignado", date: "10 ene 2026" },
  { id: "INV-0572", item: "Monitor LG 27''", cat: "Cómputo", who: "Juan Pérez", serial: "MN27GH88012", st: "Asignado", date: "10 ene 2026" },
  { id: "INV-0588", item: 'iPhone 15', cat: "Móvil", who: "—", serial: "IP15RT99311", st: "Disponible", date: "04 mar 2026" },
  { id: "INV-0590", item: "Silla ergonómica", cat: "Mobiliario", who: "Valentina Ruiz", serial: "SL-ERG-4421", st: "Asignado", date: "21 feb 2026" },
  { id: "INV-0595", item: "Dell Latitude", cat: "Cómputo", who: "—", serial: "DL-LAT-7780", st: "Mantenimiento", date: "30 may 2026" },
  { id: "INV-0601", item: "Teclado mecánico", cat: "Cómputo", who: "Daniel Ospina", serial: "KB-MX-3390", st: "Asignado", date: "12 jun 2026" },
];

const FACTURAS = [
  {
    id: "FAC-2201", proveedor: "Apple Colombia SAS", fecha: "10 ene 2026", st: "Pagada",
    items: [
      { activo: 'MacBook Pro 14"', cant: 1, precio: 9800000 },
      { activo: "iPhone 15", cant: 1, precio: 4200000 },
    ],
  },
  {
    id: "FAC-2198", proveedor: "LG Electronics", fecha: "10 ene 2026", st: "Pagada",
    items: [{ activo: "Monitor LG 27''", cant: 1, precio: 1350000 }],
  },
  {
    id: "FAC-2214", proveedor: "Ergosillas SAS", fecha: "21 feb 2026", st: "Pagada",
    items: [{ activo: "Silla ergonómica", cant: 1, precio: 980000 }],
  },
  {
    id: "FAC-2240", proveedor: "Dell Colombia", fecha: "30 may 2026", st: "Pendiente",
    items: [{ activo: "Dell Latitude", cant: 1, precio: 5400000 }],
  },
  {
    id: "FAC-2255", proveedor: "MacroTech SAS", fecha: "12 jun 2026", st: "Pendiente",
    items: [{ activo: "Teclado mecánico", cant: 2, precio: 320000 }],
  },
];

const PEDIDOS = [
  { id: "PED-501", item: "Monitor LG 27''", proveedor: "LG Electronics", cant: 3, precioEst: 1400000, fecha: "15 jun 2026", st: "Solicitado", quien: "Daniel Ospina" },
  { id: "PED-502", item: 'MacBook Air M3', proveedor: "Apple Colombia SAS", cant: 2, precioEst: 7200000, fecha: "17 jun 2026", st: "Aprobado", quien: "Camila Restrepo" },
  { id: "PED-503", item: "Silla ergonómica", proveedor: "Ergosillas SAS", cant: 5, precioEst: 1000000, fecha: "12 jun 2026", st: "Facturado", quien: "Andrés Mora" },
  { id: "PED-504", item: "Licencias Adobe CC", proveedor: "Adobe Colombia", cant: 4, precioEst: 620000, fecha: "19 jun 2026", st: "Solicitado", quien: "Valentina Ruiz" },
];

const ROLES = ["Administrador", "Líder de equipo", "Empleado"];
const PERMS_DEFAULT = {
  "Administrador": { dashboard: true, empleados: true, asistencia: true, nomina: true, capacitacion: true, riesgos: true, firmas: true, inventario: true, documentos: true, consultoria: true, tickets: true, calendario: true, trazabilidad: true, ia: true, configuracion: true },
  "Líder de equipo": { dashboard: true, empleados: true, asistencia: true, nomina: false, capacitacion: true, riesgos: true, firmas: true, inventario: true, documentos: true, consultoria: true, tickets: true, calendario: true, trazabilidad: true, ia: true, configuracion: false },
  "Empleado": { dashboard: true, empleados: false, asistencia: false, nomina: false, capacitacion: true, riesgos: false, firmas: false, inventario: false, documentos: true, consultoria: false, tickets: true, calendario: true, trazabilidad: false, ia: false, configuracion: false },
};
const PERM_LABELS = {
  dashboard: "Dashboard", empleados: "Empleados", asistencia: "Asistencia",
  nomina: "Nómina", capacitacion: "Capacitación", talento: "Talento",
  riesgos: "Centro de Riesgos",
  firmas: "Firmas", inventario: "Inventario", documentos: "Documentos",
  consultoria: "Consultoría", tickets: "Tickets", calendario: "Calendario", trazabilidad: "Trazabilidad", configuracion: "Configuración",
};

const MEETINGS = [
  { id: "M-01", title: "Entrevista — Backend Senior", type: "Entrevista", day: 9, time: "10:00", dur: "45 min", with: "Juan Pérez", loc: "Sala 2 · Bogotá" },
  { id: "M-02", title: "Onboarding — Sebastián Cano", type: "Onboarding", day: 12, time: "09:00", dur: "1 h", with: "Camila Restrepo", loc: "Virtual · Meet" },
  { id: "M-03", title: "1:1 — Valentina Ruiz", type: "1:1", day: 15, time: "15:30", dur: "30 min", with: "Camila Restrepo", loc: "Virtual · Meet" },
  { id: "M-04", title: "Sesión de consultoría laboral", type: "Consultoría", day: 18, time: "11:00", dur: "1 h", with: "Asesor externo", loc: "Virtual · Meet" },
  { id: "M-05", title: "1:1 — Daniel Ospina", type: "1:1", day: 22, time: "14:00", dur: "30 min", with: "Camila Restrepo", loc: "Sala 1 · Bogotá" },
  { id: "M-06", title: "Entrevista — Diseñador UX", type: "Entrevista", day: 23, time: "16:00", dur: "45 min", with: "Sebastián Cano", loc: "Virtual · Meet" },
  { id: "M-07", title: "Revisión de cumplimiento laboral", type: "Consultoría", day: 25, time: "10:30", dur: "1 h", with: "Asesor externo", loc: "Virtual · Meet" },
  { id: "M-08", title: "Onboarding — Nuevo ingreso Finanzas", type: "Onboarding", day: 29, time: "09:30", dur: "1 h", with: "Andrés Mora", loc: "Sala 2 · Bogotá" },
];
const MEET_TONE = { "Entrevista": "blu", "Onboarding": "grn", "1:1": "vio", "Consultoría": "red" };

/* Centro de Riesgos */
const RIESGOS_SEED = [
  { id: "R-01", tipo: "Contrato vence",        empleado: "Andrés Mora",    area: "Finanzas",    sev: "Alta",  detalle: "Contrato vence en 8 días (30 jun 2026)",              accion: "Renovar antes del 30 jun" },
  { id: "R-02", tipo: "Firma vencida",          empleado: "María González", area: "Personas",    sev: "Alta",  detalle: "Anexo de teletrabajo vencido hace 18 días sin firma", accion: "Reenviar con urgencia hoy" },
  { id: "R-03", tipo: "Bajo rendimiento",       empleado: "Valentina Ruiz", area: "Marketing",   sev: "Alta",  detalle: "Score 3.2 / 5 · solo 2 de 5 objetivos Q2 cumplidos", accion: "Iniciar plan de mejora de desempeño" },
  { id: "R-04", tipo: "Rotación alta",          empleado: null,             area: "Marketing",   sev: "Alta",  detalle: "Tasa del 14.5% — mayor de toda la empresa",           accion: "Análisis de retención urgente" },
  { id: "R-05", tipo: "Vacaciones acumuladas",  empleado: "Juan Pérez",     area: "Ingeniería",  sev: "Media", detalle: "18 días disponibles sin tomar — riesgo de vencimiento", accion: "Programar antes del cierre de Q3" },
  { id: "R-06", tipo: "Evaluación pendiente",   empleado: "Daniel Ospina",  area: "Ingeniería",  sev: "Media", detalle: "Evaluación Q2 sin completar (21 días pendiente)",      accion: "Completar antes del viernes" },
  { id: "R-07", tipo: "Ausencia activa",        empleado: "Andrés Mora",    area: "Finanzas",    sev: "Media", detalle: "Incapacidad de 7 días activa hasta el 23 jun",         accion: "Asegurar cobertura del rol" },
  { id: "R-08", tipo: "Vacante sin cubrir",     empleado: null,             area: "Finanzas",    sev: "Media", detalle: "Analista de Nómina sin cubrir hace 11 días",           accion: "Priorizar entrevistas esta semana" },
  { id: "R-09", tipo: "Ticket sin respuesta",   empleado: null,             area: "Nómina",      sev: "Baja",  detalle: "TK-1284 lleva 4 días sin primera respuesta",           accion: "Escalar al líder del área" },
  { id: "R-10", tipo: "Capacitación atrasada",  empleado: null,             area: "General",     sev: "Baja",  detalle: "2 cursos con menos del 30% de avance",                accion: "Enviar recordatorio al equipo" },
];

const HEALTH_FACTORS = [
  { nombre: "Cumplimiento documental", score: 94, tone: "grn" },
  { nombre: "Clima laboral (eNPS)",    score: 75, tone: "grn" },
  { nombre: "Desempeño",              score: 79, tone: "grn" },
  { nombre: "Retención de talento",   score: 83, tone: "grn" },
  { nombre: "Asistencia",             score: 88, tone: "grn" },
  { nombre: "Reclutamiento",          score: 68, tone: "amb" },
];
const HEALTH_SCORE = Math.round(HEALTH_FACTORS.reduce((s, f, i) => s + f.score * [.2, .2, .2, .15, .15, .1][i], 0));

const RECOMENDACIONES_SEED = [
  { id: "RC-01", prioridad: "Urgente",    cat: "Retención",    titulo: "Plan de retención en Marketing",      razon: "Tasa de rotación 14.5% y desempeño bajo detectado en el área", tone: "red" },
  { id: "RC-02", prioridad: "Importante", cat: "Cumplimiento", titulo: "Renovar contratos antes del 30 jun",  razon: "3 contratos expiran en los próximos 8 días",                    tone: "amb" },
  { id: "RC-03", prioridad: "Pronto",     cat: "Desarrollo",   titulo: "Activar plan de formación Q3",        razon: "2 cursos activos con menos del 30% de avance en el equipo",    tone: "blu" },
];

/* Mapa de talento */
const SKILLS_LIST = ["React/Frontend", "Python/Backend", "SQL/Datos", "Diseño UX", "Liderazgo", "Gestión proyectos", "Excel/Finanzas", "Comunicación"];
const SKILL_LEVELS = {
  "María González":  [3, 0, 0, 3, 1, 2, 0, 3],
  "Juan Pérez":      [1, 3, 2, 0, 1, 1, 0, 2],
  "Camila Restrepo": [0, 0, 1, 0, 3, 3, 1, 3],
  "Andrés Mora":     [0, 0, 2, 0, 2, 2, 3, 2],
  "Valentina Ruiz":  [1, 0, 0, 2, 1, 2, 0, 3],
  "Sebastián Cano":  [2, 0, 0, 2, 0, 1, 0, 2],
  "Laura Jiménez":   [0, 0, 2, 0, 1, 1, 3, 2],
  "Daniel Ospina":   [0, 2, 1, 0, 0, 0, 0, 1],
};
const SKILL_LEVEL_LABELS = ["—", "Básico", "Intermedio", "Avanzado"];
const SKILL_LEVEL_COLORS = ["var(--line2)", "#dce9fd", "#7aa2ff", "#3b6fe0"];

const SUCESIONES = [
  { cargo: "Líder de RRHH", criticidad: "Alta", titular: "Camila Restrepo",
    candidatos: [{ name: "María González", readiness: "Listo en 1 año", score: 75 }, { name: "Laura Jiménez", readiness: "Listo en 2 años", score: 55 }] },
  { cargo: "Líder de Ingeniería", criticidad: "Alta", titular: null,
    candidatos: [{ name: "Juan Pérez", readiness: "Listo ahora", score: 90 }, { name: "Daniel Ospina", readiness: "Listo en 1 año", score: 62 }] },
  { cargo: "Analista Senior Finanzas", criticidad: "Media", titular: "Andrés Mora",
    candidatos: [{ name: "Laura Jiménez", readiness: "Listo en 6 meses", score: 83 }] },
  { cargo: "Especialista Marketing", criticidad: "Media", titular: "Valentina Ruiz",
    candidatos: [{ name: "Sebastián Cano", readiness: "Listo en 1 año", score: 48 }] },
];

/* Employee Journey */
const EMP_JOURNEY = {
  "María González": [
    { fecha: "Mar 2024", tipo: "Contratación", desc: "Ingreso como Diseñadora Junior", tone: "grn" },
    { fecha: "Ago 2024", tipo: "Capacitación", desc: "Certificación Scrum Product Owner", tone: "blu" },
    { fecha: "Ene 2025", tipo: "Promoción", desc: "Ascenso a Diseñadora de Producto", tone: "vio" },
    { fecha: "Mar 2026", tipo: "Evaluación", desc: "Score 4.6/5 — Supera expectativas", tone: "grn" },
    { fecha: "Jun 2026", tipo: "Reconocimiento", desc: "Empleada del trimestre Q2 2026", tone: "amb" },
  ],
  "Juan Pérez": [
    { fecha: "Jun 2023", tipo: "Contratación", desc: "Ingreso como Desarrollador Junior", tone: "grn" },
    { fecha: "Dic 2024", tipo: "Ajuste salarial", desc: "+12% por desempeño destacado", tone: "grn" },
    { fecha: "Mar 2026", tipo: "Evaluación", desc: "Score 4.1/5 — Cumple expectativas", tone: "grn" },
  ],
  "Camila Restrepo": [
    { fecha: "Ene 2022", tipo: "Contratación", desc: "Ingreso como Líder de RRHH", tone: "grn" },
    { fecha: "Jul 2023", tipo: "Capacitación", desc: "Diplomado en Gestión del Talento", tone: "blu" },
    { fecha: "Ene 2025", tipo: "Ajuste salarial", desc: "+18% por resultados organizacionales", tone: "grn" },
    { fecha: "Mar 2026", tipo: "Evaluación", desc: "Score 4.9/5 — Excelente liderazgo", tone: "grn" },
  ],
  "Valentina Ruiz": [
    { fecha: "Sep 2024", tipo: "Contratación", desc: "Ingreso como Especialista Marketing", tone: "grn" },
    { fecha: "Mar 2026", tipo: "Evaluación", desc: "Score 3.2/5 — Por debajo del esperado", tone: "red" },
    { fecha: "Jun 2026", tipo: "Plan de mejora", desc: "Inicio plan de desarrollo Q3 2026", tone: "amb" },
  ],
  "Daniel Ospina": [
    { fecha: "Feb 2024", tipo: "Contratación", desc: "Ingreso como Soporte TI Junior", tone: "grn" },
    { fecha: "Jun 2026", tipo: "Certificación", desc: "AWS Cloud Practitioner obtenida", tone: "blu" },
  ],
};

/* Heatmap de ausentismo — Junio 2026, empieza lunes 1 jun */
const HEATMAP_JUNE = [
  0,0,1,0,0,0,0,
  0,1,2,1,0,0,0,
  0,1,3,3,2,0,0,
  1,2,2,1,1,0,0,
  0,1,0,
];

/* Employee Journey stages */
const JOURNEY_STAGES = [
  { id: "candidato",   label: "Candidatos",    ico: Briefcase,  tone: "blu", emps: [],
    stats: [{ k: "En proceso", v: "6" }, { k: "Tiempo prom.", v: "23 días" }] },
  { id: "onboarding",  label: "Onboarding",    ico: UserCheck,  tone: "vio", emps: ["Sebastián Cano"],
    stats: [{ k: "Activos", v: "1" }, { k: "Duración", v: "30 días" }] },
  { id: "activo",      label: "Activos",       ico: Users,      tone: "grn", emps: ["María González", "Juan Pérez", "Valentina Ruiz", "Laura Jiménez", "Daniel Ospina"],
    stats: [{ k: "Promedio antigüedad", v: "1.8 años" }, { k: "eNPS del grupo", v: "52" }] },
  { id: "consolidado", label: "Consolidados",  ico: Award,      tone: "amb", emps: ["Camila Restrepo", "Andrés Mora"],
    stats: [{ k: "Promedio antigüedad", v: "3.4 años" }, { k: "Retención", v: "100%" }] },
  { id: "alumni",      label: "Alumni",        ico: UserMinus,  tone: "ink",
    emps: ["Ricardo Méndez", "Daniela Suárez", "Jorge Ramírez", "Carolina Pinto"],
    stats: [{ k: "Salidas últimos 4 m", v: "4" }, { k: "Tipo mayoritario", v: "Voluntaria" }] },
];

/* Predicción de rotación */
const ROTATION_RISK = [
  { name: "Valentina Ruiz",  riesgo: 78, factores: ["Bajo rendimiento", "Poca formación reciente"] },
  { name: "Andrés Mora",     riesgo: 62, factores: ["Ausencia prolongada", "Alta carga laboral"] },
  { name: "Daniel Ospina",   riesgo: 34, factores: ["Evaluación pendiente"] },
  { name: "Juan Pérez",      riesgo: 29, factores: ["Vacaciones acumuladas (18 días)"] },
  { name: "Sebastián Cano",  riesgo: 22, factores: ["Nuevo en la empresa"] },
  { name: "Laura Jiménez",   riesgo: 15, factores: [] },
  { name: "María González",  riesgo: 11, factores: [] },
  { name: "Camila Restrepo", riesgo: 7,  factores: [] },
];

/* Benchmarking por área */
const BENCH_AREAS = [
  { area: "Ingeniería", desempeno: 4.1, clima: 78, rotacion: 9.2,  capacitacion: 82 },
  { area: "Producto",   desempeno: 4.4, clima: 82, rotacion: 6.4,  capacitacion: 76 },
  { area: "Finanzas",   desempeno: 3.9, clima: 71, rotacion: 11.8, capacitacion: 68 },
  { area: "Marketing",  desempeno: 3.2, clima: 64, rotacion: 14.5, capacitacion: 55 },
  { area: "Personas",   desempeno: 4.9, clima: 90, rotacion: 2.1,  capacitacion: 94 },
];

/* Reclutamiento */
const VACANTES = [
  { id: "VAC-01", titulo: "Desarrollador Frontend Senior", area: "Ingeniería", abierta: "02 jun 2026", candidatos: 14, st: "Abierta" },
  { id: "VAC-02", titulo: "Diseñador UX", area: "Producto", abierta: "28 may 2026", candidatos: 9, st: "Abierta" },
  { id: "VAC-03", titulo: "Analista de Nómina", area: "Finanzas", abierta: "10 jun 2026", candidatos: 5, st: "Abierta" },
  { id: "VAC-04", titulo: "Account Manager", area: "Marketing", abierta: "15 abr 2026", candidatos: 21, st: "Cerrada" },
];
const CANDIDATOS = [
  { id: "CAN-101", name: "Felipe Castro", vacante: "Desarrollador Frontend Senior", fuente: "LinkedIn", etapa: "Entrevista" },
  { id: "CAN-102", name: "Natalia Bermúdez", vacante: "Desarrollador Frontend Senior", fuente: "Referido", etapa: "Oferta" },
  { id: "CAN-103", name: "Camilo Rojas", vacante: "Diseñador UX", fuente: "Portal de empleo", etapa: "Aplicó" },
  { id: "CAN-104", name: "Isabela Torres", vacante: "Diseñador UX", fuente: "LinkedIn", etapa: "Entrevista" },
  { id: "CAN-105", name: "Mateo Salazar", vacante: "Analista de Nómina", fuente: "Referido", etapa: "Aplicó" },
  { id: "CAN-106", name: "Paula Vélez", vacante: "Desarrollador Frontend Senior", fuente: "Portal de empleo", etapa: "Contratado" },
];
const RECLUT_STAGES = ["Aplicó", "Entrevista", "Oferta", "Contratado", "Rechazado"];

/* Rotación */
const SALIDAS = [
  { id: "SAL-01", name: "Ricardo Méndez", area: "Ingeniería", fecha: "14 may 2026", tipo: "Voluntaria", motivo: "Mejor oferta salarial", antig: "2.1 años" },
  { id: "SAL-02", name: "Daniela Suárez", area: "Marketing", fecha: "28 abr 2026", tipo: "Voluntaria", motivo: "Cambio de ciudad", antig: "1.4 años" },
  { id: "SAL-03", name: "Jorge Ramírez", area: "Finanzas", fecha: "30 mar 2026", tipo: "Despido", motivo: "Reestructuración", antig: "3.0 años" },
  { id: "SAL-04", name: "Carolina Pinto", area: "Producto", fecha: "12 feb 2026", tipo: "Voluntaria", motivo: "Estudios", antig: "0.8 años" },
];
const ROTACION_AREA = [
  { area: "Ingeniería", tasa: 9.2 }, { area: "Marketing", tasa: 14.5 }, { area: "Finanzas", tasa: 11.8 },
  { area: "Producto", tasa: 6.4 }, { area: "Personas", tasa: 2.1 },
];

/* Asistencia */
const AUSENCIAS = [
  { id: "AUS-01", name: "Andrés Mora", tipo: "Incapacidad", desde: "16 jun 2026", hasta: "23 jun 2026", dias: 7, st: "Activa" },
  { id: "AUS-02", name: "Sebastián Cano", tipo: "Vacaciones", desde: "10 jun 2026", hasta: "14 jun 2026", dias: 5, st: "Finalizada" },
  { id: "AUS-03", name: "Valentina Ruiz", tipo: "Permiso", desde: "20 jun 2026", hasta: "20 jun 2026", dias: 1, st: "Activa" },
  { id: "AUS-04", name: "Daniel Ospina", tipo: "Vacaciones", desde: "29 jun 2026", hasta: "03 jul 2026", dias: 5, st: "Programada" },
];
const VACACIONES = [
  { name: "María González", disponibles: 15, tomados: 5 }, { name: "Juan Pérez", disponibles: 18, tomados: 2 },
  { name: "Andrés Mora", disponibles: 9, tomados: 11 }, { name: "Valentina Ruiz", disponibles: 12, tomados: 8 },
  { name: "Sebastián Cano", disponibles: 20, tomados: 0 }, { name: "Daniel Ospina", disponibles: 14, tomados: 6 },
];

/* Nómina */
const NOMINA_AREA = [
  { area: "Ingeniería", costo: 84000000, personas: 2 }, { area: "Producto", costo: 38000000, personas: 2 },
  { area: "Finanzas", costo: 31000000, personas: 2 }, { area: "Marketing", costo: 14500000, personas: 1 },
  { area: "Personas", costo: 16500000, personas: 1 },
];
const NOMINA_HIST = [178, 182, 184, 188, 191, 184];
const BENEFICIOS = [
  { nombre: "Medicina prepagada", cobertura: "100% del equipo", costoMes: 9200000 },
  { nombre: "Auxilio de conectividad", cobertura: "100% del equipo", costoMes: 2400000 },
  { nombre: "Bonos de bienestar", cobertura: "82% del equipo", costoMes: 5100000 },
];

/* Desempeño */
const EVALUACIONES = [
  { id: "EV-01", name: "María González", periodo: "Q2 2026", score: 4.6, objetivos: "5/5", st: "Completada" },
  { id: "EV-02", name: "Juan Pérez", periodo: "Q2 2026", score: 4.1, objetivos: "4/5", st: "Completada" },
  { id: "EV-03", name: "Valentina Ruiz", periodo: "Q2 2026", score: 3.2, objetivos: "2/5", st: "Completada" },
  { id: "EV-04", name: "Daniel Ospina", periodo: "Q2 2026", score: null, objetivos: "—", st: "Pendiente" },
  { id: "EV-05", name: "Sebastián Cano", periodo: "Q2 2026", score: null, objetivos: "—", st: "Pendiente" },
];

/* Capacitación */
const CURSOS = [
  { id: "CUR-01", nombre: "Liderazgo de equipos remotos", horas: 8, inscritos: 12, completados: 9 },
  { id: "CUR-02", nombre: "Seguridad de la información", horas: 3, inscritos: 20, completados: 20 },
  { id: "CUR-03", nombre: "Excel avanzado", horas: 6, inscritos: 7, completados: 4 },
  { id: "CUR-04", nombre: "Atención al cliente con IA", horas: 4, inscritos: 10, completados: 2 },
];
const CERTIFICACIONES = [
  { name: "María González", cert: "Scrum Product Owner", fecha: "Mar 2026" },
  { name: "Andrés Mora", cert: "Certificación NIIF", fecha: "May 2026" },
  { name: "Daniel Ospina", cert: "AWS Cloud Practitioner", fecha: "Jun 2026" },
];

/* Clima laboral */
const ENPS_HIST = [38, 41, 44, 40, 46, 49];
const ENCUESTAS = [
  { id: "ENC-01", nombre: "Pulso trimestral Q2", participacion: 86, fecha: "05 jun 2026", st: "Cerrada" },
  { id: "ENC-02", nombre: "Clima — equipo Ingeniería", participacion: 64, fecha: "18 jun 2026", st: "Abierta" },
];

function exportExcel(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
const cop = (n) => "$" + n.toLocaleString("es-CO");

const DOCS = [
  { id: "F-9001", name: "Manual de convivencia", type: "Política", who: "Personas", date: "Jun 2026", tags: ["Vigente", "Reglamento"], ai: "Sin riesgos" },
  { id: "F-9002", name: "Contrato laboral — plantilla", type: "Contrato", who: "Legal", date: "May 2026", tags: ["Plantilla"], ai: "Cláusula a revisar" },
  { id: "F-9003", name: "Política de datos personales", type: "Política", who: "Legal", date: "Abr 2026", tags: ["Habeas Data", "Confidencial"], ai: "Vence 30 sep" },
  { id: "F-9004", name: "Acta de entrega de equipo", type: "Acta", who: "TI", date: "Jun 2026", tags: ["Inventario"], ai: "Sin riesgos" },
  { id: "F-9005", name: "Plan de capacitación 2026", type: "Plan", who: "Personas", date: "Feb 2026", tags: ["Formación"], ai: "Sin riesgos" },
  { id: "F-9006", name: "Reglamento de seguridad", type: "Política", who: "SST", date: "Ene 2026", tags: ["SST", "Obligatorio"], ai: "Falta firma" },
];

const CONSULTAS = [
  { id: "CN-218", tema: "Liquidación de contrato a término fijo", quien: "Andrés Mora", consultor: "Asesoría laboral", st: "En curso", date: "Hoy" },
  { id: "CN-215", tema: "Política de teletrabajo y horarios", quien: "Camila Restrepo", consultor: "Cumplimiento", st: "Agendada", date: "22 jun" },
  { id: "CN-210", tema: "Revisión de cláusula de confidencialidad", quien: "Legal", consultor: "Asesoría laboral", st: "Resuelta", date: "14 jun" },
  { id: "CN-204", tema: "Afiliación a seguridad social — nuevo ingreso", quien: "Sebastián Cano", consultor: "Nómina", st: "Resuelta", date: "08 jun" },
];

const TICKETS = [
  { id: "TK-1287", asunto: "Solicitud de certificado laboral", quien: "Juan Pérez", area: "Personas", prio: "Media", st: "Abierto", t: "hace 2 h", ai: true },
  { id: "TK-1286", asunto: "Error al acceder al correo corporativo", quien: "Valentina Ruiz", area: "TI", prio: "Alta", st: "En proceso", t: "hace 4 h" },
  { id: "TK-1285", asunto: "Solicitud de vacaciones", quien: "Sebastián Cano", area: "Personas", prio: "Baja", st: "Abierto", t: "hace 5 h" },
  { id: "TK-1284", asunto: "Ajuste en liquidación de nómina de mayo", quien: "Andrés Mora", area: "Nómina", prio: "Alta", st: "Abierto", t: "hace 6 h", ai: true },
  { id: "TK-1283", asunto: "Reembolso de gastos de viaje", quien: "Laura Jiménez", area: "Finanzas", prio: "Baja", st: "En proceso", t: "Ayer" },
  { id: "TK-1282", asunto: "Cambio de equipo de cómputo", quien: "Daniel Ospina", area: "TI", prio: "Media", st: "En proceso", t: "Ayer" },
  { id: "TK-1281", asunto: "Revisión de contrato de proveedor", quien: "Camila Restrepo", area: "Legal", prio: "Media", st: "Abierto", t: "Ayer", ai: true },
  { id: "TK-1280", asunto: "Certificado de ingresos y retenciones", quien: "María González", area: "Finanzas", prio: "Media", st: "Resuelto", t: "18 jun" },
  { id: "TK-1279", asunto: "Restablecer contraseña de la VPN", quien: "Juan Pérez", area: "TI", prio: "Alta", st: "Resuelto", t: "18 jun" },
  { id: "TK-1278", asunto: "Actualización de datos de contacto", quien: "Valentina Ruiz", area: "Personas", prio: "Baja", st: "Resuelto", t: "17 jun" },
  { id: "TK-1277", asunto: "Anticipo de nómina", quien: "Andrés Mora", area: "Nómina", prio: "Media", st: "Resuelto", t: "16 jun" },
  { id: "TK-1276", asunto: "Consulta sobre afiliación a EPS", quien: "Sebastián Cano", area: "Personas", prio: "Baja", st: "Resuelto", t: "16 jun" },
];

const AREA = { TI: "#3b82f6", "Nómina": "#8b5cf6", Personas: "#e5484d", Finanzas: "#1f9d63", Legal: "#bf8410" };
const AREA_GRAD = {
  TI: ["#7aa2ff", "#3b82f6"], "Nómina": ["#b298f2", "#8b5cf6"], Personas: ["#ff8a8d", "#e5484d"],
  Finanzas: ["#3ed694", "#1f9d63"], Legal: ["#f0bd5a", "#bf8410"],
};
const DEPT_GRAD = {
  Producto: ["#7aa2ff", "#3b82f6"], "Ingeniería": ["#b298f2", "#8b5cf6"], Personas: ["#ff8a8d", "#e5484d"],
  Finanzas: ["#3ed694", "#1f9d63"], Marketing: ["#f0bd5a", "#bf8410"],
};
const prioTone = (p) => ({ Alta: "red", Media: "amb", Baja: "neu" }[p] || "neu");

const ACTIVIDAD = [
  { m: "Ene", firmas: 38, docs: 26 }, { m: "Feb", firmas: 31, docs: 30 },
  { m: "Mar", firmas: 52, docs: 41 }, { m: "Abr", firmas: 44, docs: 37 },
  { m: "May", firmas: 61, docs: 48 }, { m: "Jun", firmas: 84, docs: 57 },
];

const EVENTOS = [
  { g: "Hoy", items: [
    { who: "María González", act: "firmó", obj: "Acuerdo de confidencialidad", t: "09:42", type: "Firma", red: true },
    { who: "Juan Pérez", act: "abrió un ticket:", obj: "Certificado laboral (TK-1287) · área Personas", t: "08:50", type: "Ticket" },
    { who: "Asistente IA", act: "detectó", obj: "3 contratos por vencer este mes", t: "08:15", type: "IA" },
    { who: "Daniel Ospina", act: "registró entrada de", obj: "Teclado mecánico (INV-0601)", t: "07:50", type: "Inventario" },
  ]},
  { g: "Ayer", items: [
    { who: "Camila Restrepo", act: "subió", obj: "Plan de capacitación 2026", t: "17:20", type: "Documento" },
    { who: "Sistema", act: "asignó", obj: 'MacBook Pro 14" a María González', t: "11:05", type: "Inventario" },
    { who: "Valentina Ruiz", act: "completó", obj: "Onboarding documental", t: "09:30", type: "Empleado" },
  ]},
  { g: "18 jun 2026", items: [
    { who: "Camila Restrepo", act: "solicitó firma de", obj: "Contrato laboral a Sebastián Cano", t: "16:12", type: "Firma" },
    { who: "Asistente IA", act: "resumió", obj: "estado de cumplimiento documental (94%)", t: "10:00", type: "IA" },
  ]},
];

const tone = (st) => ({
  Activo: "grn", Firmado: "grn", Asignado: "grn", Disponible: "grn", Resuelta: "grn", Vigente: "grn",
  Pendiente: "amb", Onboarding: "amb", Mantenimiento: "amb", "En licencia": "amb", "En curso": "amb",
  Agendada: "amb", "Vencido": "red",
  Abierto: "neu", "En proceso": "amb", Resuelto: "grn",
  Solicitado: "amb", Aprobado: "blu", Facturado: "grn",
  Alta: "red", Media: "amb", Baja: "neu",
  Urgente: "red", Importante: "amb", Pronto: "blu",
  Abierta: "grn", Cerrada: "neu", Activa: "amb", Finalizada: "grn", Programada: "blu",
  Completada: "grn", Aplicó: "neu", Entrevista: "blu", Oferta: "amb", Contratado: "grn", Rechazado: "red",
  Voluntaria: "amb", Despido: "red",
}[st] || "neu");

/* ------------------------------------------------------------------ */
/*  Small components                                                   */
/* ------------------------------------------------------------------ */
const Badge = ({ st }) => (
  <span className={`badge b-${tone(st)}`}><span className="bd" />{st}</span>
);

const SC_ICO = { ok: Check, err: X, pending: Clock, warn: AlertCircle };
const StatusCard = ({ tone = "ok", title, sub, children }) => {
  const Ico = SC_ICO[tone] || Check;
  return (
    <div className={`statuscard ${tone}`}>
      <div className="scico"><Ico size={22} /></div>
      <div className="sctitle">{title}</div>
      {sub && <div className="scsub">{sub}</div>}
      {children && <div className="scacts">{children}</div>}
    </div>
  );
};

const AV_GRADS = [
  ["#7aa2ff", "#3b6fe0"], ["#3ed694", "#1f9d63"], ["#f0bd5a", "#bf8410"],
  ["#b298f2", "#7c5cd6"], ["#ff8a8d", "#e5484d"], ["#5ed3d6", "#1f9098"],
  ["#f79bc4", "#db5897"], ["#8fd16a", "#4f9e2e"],
];
const avHash = (n = "") => { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0; return Math.abs(h) % AV_GRADS.length; };
const Avatar = ({ name, size = 34 }) => {
  const [c1, c2] = AV_GRADS[avHash(name)];
  return (
    <div className="av" style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(145deg,${c1},${c2})`, boxShadow: `0 4px 10px -4px ${c2}88` }}>{initials(name)}</div>
  );
};

const PRIO = { Alta: "red", Media: "amb", Baja: "neu" };
const Prio = ({ prio }) => (
  <span className={`badge b-${PRIO[prio] || "neu"}`}><span className="bd" />{prio}</span>
);

function Spark({ data, color = "#e5484d" }) {
  const w = 84, h = 30, max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TONE = {
  red: ["#ff8a8d", "#e5484d"], grn: ["#3ed694", "#1f9d63"], amb: ["#f0bd5a", "#bf8410"],
  blu: ["#7aa2ff", "#3b6fe0"], vio: ["#b298f2", "#7c5cd6"], ink: ["#a6a6b2", "#6b6b76"],
  neu: ["#a6a6b2", "#6b6b76"],
};

const Kpi = ({ ico: Ico, label, value, delta, up, dir, vs, spark, tone = "ink" }) => {
  const down = (dir || (up ? "up" : "down")) === "down";
  const [c1, c2] = TONE[tone];
  return (
    <div className="card kpi">
      <div className="klab">
        <span className="kico" style={{ background: `linear-gradient(145deg,${c1},${c2})`, boxShadow: `0 6px 14px -6px ${c2}99` }}>
          <Ico size={14} />
        </span>
        {label}
      </div>
      <div className="kval">{value}</div>
      <div className="kfoot">
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span className={`delta ${up ? "up" : "dn"}`}><ArrowUp size={11} style={{ transform: down ? "rotate(180deg)" : "none" }} />{delta}</span>
          <span className="kvs">{vs}</span>
        </div>
        <Spark data={spark} color={c2} />
      </div>
    </div>
  );
};

const Stat = ({ ico: Ico, tone = "ink", label, value, sub }) => {
  const [c1, c2] = TONE[tone];
  return (
    <div className="card stat">
      <span className="sic" style={{ background: `linear-gradient(145deg,${c1},${c2})`, boxShadow: `0 6px 14px -6px ${c2}99` }}>
        <Ico size={16} />
      </span>
      <div className="stxt">
        <div className="slab">{label}</div>
        <div className="sval">{value}</div>
        {sub && <div className="ssub">{sub}</div>}
      </div>
    </div>
  );
};

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div className="tm">{label} 2026</div>
      {payload.map((p) => (
        <div className="tr" key={p.dataKey}>
          <span className="lgd" style={{ background: p.color }} />
          {p.dataKey === "firmas" ? "Firmas" : "Documentos"}: <b style={{ color: "var(--ink)" }}>{p.value}</b>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Views                                                              */
/* ------------------------------------------------------------------ */
const FALLBACK_INSIGHTS = [
  { title: "Riesgo de cumplimiento", desc: "3 contratos vencen este mes. Recomiendo renovar antes del 30 de junio.", tone: "red" },
  { title: "Firmas estancadas", desc: "2 documentos llevan más de 8 días esperando firma.", tone: "amb" },
  { title: "Inventario optimizable", desc: "2 equipos sin asignar disponibles para nuevos ingresos.", tone: "grn" },
];
const INSIGHT_ICO = { red: AlertCircle, amb: PenLine, grn: Boxes, blu: TrendingUp, vio: Award };

function Dashboard({ go, openAI, notify }) {
  const [insights, setInsights] = useState(FALLBACK_INSIGHTS);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [recs, setRecs] = useState(RECOMENDACIONES_SEED);
  const [updatedAgo, setUpdatedAgo] = useState("hace 2 min");

  const genInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 800,
          system: AI_SYSTEM,
          messages: [{ role: "user", content: `Genera DOS listas JSON en un solo objeto. Responde SOLO JSON válido sin backticks: {"insights":[{"title":"...","desc":"...","tone":"red|amb|grn|blu|vio"}],"recs":[{"prioridad":"Urgente|Importante|Pronto","cat":"...","titulo":"...","razon":"...","tone":"red|amb|blu|vio|grn"}]}. insights: 3 items, title ≤4 palabras, desc ≤100 chars. recs: 3 acciones concretas ordenadas por impacto, titulo ≤6 palabras, razon ≤90 chars.` }],
        }),
      });
      const data = await res.json();
      const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);
      if (parsed.insights?.length) setInsights(parsed.insights.slice(0, 3));
      if (parsed.recs?.length) setRecs(parsed.recs.slice(0, 3).map((r, i) => ({ ...r, id: `RC-0${i + 1}` })));
      setUpdatedAgo("hace un momento");
    } catch (e) {
      notify("Usando datos del último análisis disponible", "info");
    } finally { setLoadingInsights(false); }
  };

  useEffect(() => { genInsights(); }, []);

  const hixColor = HEALTH_SCORE >= 80 ? "grn" : HEALTH_SCORE >= 60 ? "amb" : "red";

  return (
    <>
      {/* KPIs */}
      <div className="gkpi">
        <div className="rise d1"><Kpi ico={Users} tone="blu" label="Empleados activos" value="142" delta="4.2%" up vs="vs. mes anterior" spark={[120, 124, 128, 131, 137, 142]} /></div>
        <div className="rise d2"><Kpi ico={FileCheck2} tone="grn" label="Documentos firmados" value="84" delta="8.1%" up vs="este mes" spark={[38, 31, 52, 44, 61, 84]} /></div>
        <div className="rise d3"><Kpi ico={ShieldCheck} tone="vio" label="Cumplimiento" value="94%" delta="1.4%" up vs="vs. mes anterior" spark={[88, 89, 90, 91, 93, 94]} /></div>
        <div className="rise d4"><Kpi ico={ShieldAlert} tone="red" label="Riesgos activos" value={RIESGOS_SEED.filter(r => r.sev === "Alta").length} delta={RIESGOS_SEED.length} up={false} dir="up" vs="total detectados" spark={[2, 3, 2, 4, 3, 4]} /></div>
      </div>

      {/* Índice de salud organizacional */}
      <div className="card cpad rise d2" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
          <div className="ctitle">Índice de Salud Organizacional</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className={`badge b-${hixColor}`}>{HEALTH_SCORE >= 80 ? "Saludable" : HEALTH_SCORE >= 60 ? "Moderado" : "Crítico"}</span>
            <button className="clink" onClick={() => go("riesgos")}>Ver riesgos <ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="hix">
          <div className="hix-score">
            <div className={`hix-num ${hixColor}`}>{HEALTH_SCORE}</div>
            <div className="hix-lbl">de 100 pts</div>
            <div className="hix-track"><div className={`hix-fill ${hixColor}`} style={{ width: `${HEALTH_SCORE}%` }} /></div>
          </div>
          <div className="hix-bars">
            {HEALTH_FACTORS.map((f) => (
              <div className="hix-row" key={f.nombre}>
                <div className="hix-name">{f.nombre}</div>
                <div className="hix-bar"><div className={`hix-bar-fill ${f.tone}`} style={{ width: `${f.score}%` }} /></div>
                <div className="hix-bar-val">{f.score}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart + Insights */}
      <div className="g2">
        <div className="card rise d3">
          <div className="chead">
            <div className="ctitle">Actividad de RRHH</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div className="legend">
                <span className="lg"><span className="lgd" style={{ background: "#e5484d" }} />Firmas</span>
                <span className="lg"><span className="lgd" style={{ background: "#15151a" }} />Documentos</span>
              </div>
              <span className="range">Últimos 6 meses</span>
            </div>
          </div>
          <div className="cpad" style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ACTIVIDAD} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e5484d" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#e5484d" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gK" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#15151a" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#15151a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f1f3" />
                <XAxis dataKey="m" tickLine={false} axisLine={false} dy={8} tick={{ fill: "#9494a0", fontSize: 12, fontWeight: 600 }} />
                <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: "#b6b6bd", fontSize: 11 }} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: "#e6e6ea", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="docs" stroke="#15151a" strokeWidth={2} fill="url(#gK)" />
                <Area type="monotone" dataKey="firmas" stroke="#e5484d" strokeWidth={2.6} fill="url(#gR)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card ins-top rise d4">
          <div className="chead">
            <div className="ctitle">Resumen ejecutivo IA</div>
            <button className="iref" data-tip="Actualizar resumen" onClick={genInsights} disabled={loadingInsights} title="Actualizar">
              {loadingInsights ? <span className="ispin" /> : <span className="kvs">{updatedAgo}</span>}
            </button>
          </div>
          {loadingInsights ? (
            <div className="cpad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="skel" /><div className="skel" /><div className="skel" style={{ width: "70%" }} />
            </div>
          ) : insights.map((ins, i) => {
            const Ico = INSIGHT_ICO[ins.tone] || Info;
            return (
              <div className="insight" key={i}>
                <div className={`iico ${ins.tone}`}><Ico size={17} /></div>
                <div><div className="it">{ins.title}</div><div className="id">{ins.desc}</div></div>
              </div>
            );
          })}
          <div className="cpad" style={{ paddingTop: 14, paddingBottom: 16 }}>
            <button className="btn pri" style={{ width: "100%", justifyContent: "center" }} onClick={openAI}>
              <Sparkles size={15} />Preguntar al asistente IA
            </button>
          </div>
        </div>
      </div>

      {/* Recomendaciones accionables */}
      <div className="card rise d5" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Recomendaciones accionables</div>
          {loadingInsights && <span className="ispin" />}
        </div>
        <div className="reccards cpad">
          {recs.map((r) => (
            <div className={`reccard ${r.tone}`} key={r.id}>
              <div className="rechd">
                <Badge st={r.prioridad} />
                <span className="reccat">{r.cat}</span>
              </div>
              <div className="recto">{r.titulo}</div>
              <div className="recra">{r.razon}</div>
              <div className="recft">
                <button className="btn" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => go("riesgos")}>
                  <ChevronRight size={13} />Ver en riesgos
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Firmas + Trazabilidad */}
      <div className="g2b" style={{ marginTop: 16 }}>
        <div className="card rise d5">
          <div className="chead">
            <div className="ctitle">Firmas pendientes</div>
            <button className="clink" onClick={() => go("firmas")}>Ver todo <ChevronRight size={14} /></button>
          </div>
          <table className="tbl">
            <tbody>
              {FIRMAS.filter((f) => f.st !== "Firmado").map((f) => (
                <tr className="trow" key={f.id}>
                  <td>
                    <div className="cename">{f.name}</div>
                    <div className="ceid mono">{f.id} · {f.who}</div>
                  </td>
                  <td className="muted" style={{ textAlign: "right" }}>{f.days} d</td>
                  <td style={{ textAlign: "right" }}><Badge st={f.st} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card rise d6">
          <div className="chead">
            <div className="ctitle">Trazabilidad reciente</div>
            <button className="clink" onClick={() => go("trazabilidad")}>Ver todo <ChevronRight size={14} /></button>
          </div>
          <div className="tl">
            {EVENTOS[0].items.concat(EVENTOS[1].items.slice(0, 1)).map((e, i, arr) => (
              <div className={`tli ${i === arr.length - 1 ? "last" : ""}`} key={i}>
                <div className="tlrail"><div className={`tlnode ${e.red ? "red" : ""}`} /></div>
                <div className="tlbody">
                  <div className="tltop">
                    <div className="tltxt"><b>{e.who}</b> {e.act} {e.obj}</div>
                    <div className="tltime mono">{e.t}</div>
                  </div>
                  <span className="tltag">{e.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function OrgNode({ emp, all, onOpen, overlay }) {
  const children = all.filter((e) => e.manager === emp.name);
  let badgeColor = null;
  if (overlay === "riesgo") {
    const r = ROTATION_RISK.find(x => x.name === emp.name);
    if (r) badgeColor = r.riesgo >= 60 ? "var(--redd)" : r.riesgo >= 35 ? "var(--amb)" : "var(--grn)";
  } else if (overlay === "desempeno") {
    const ev = EVALUACIONES.find(e => e.name === emp.name);
    if (ev?.score) badgeColor = ev.score >= 4 ? "var(--grn)" : ev.score >= 3.5 ? "var(--amb)" : "var(--redd)";
  }
  return (
    <div className="orgnode">
      <div className="orgcard"
        style={badgeColor ? { outline: `2px solid ${badgeColor}`, outlineOffset: 2 } : {}}
        onClick={() => onOpen(emp)}>
        <div style={{ position: "relative" }}>
          <Avatar name={emp.name} size={38} />
          {badgeColor && <span className="orgnode-badge" style={{ background: badgeColor }} />}
        </div>
        <div className="orgname">{emp.name.split(" ")[0]} {emp.name.split(" ")[1]?.[0]}.</div>
        <div className="orgrole">{emp.role}</div>
        <div className="orgdept">{emp.dept}</div>
      </div>
      {children.length > 0 && (
        <div className="orgconnect">
          <div className="orgline-v" />
          <div className="orgchildren">
            {children.map((c, i) => (
              <div key={c.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {children.length > 1 && (
                  <div style={{ height: 1.5, background: "#e4e4e8", width: "100%", marginBottom: 0 }} />
                )}
                <div className="orgline-v" />
                <OrgNode emp={c} all={all} onOpen={onOpen} overlay={overlay} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewEmployeeModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [dept, setDept] = useState("Producto");
  const [loc, setLoc] = useState("Bogotá");
  useEffect(() => { if (open) { setName(""); setRole(""); setDept("Producto"); setLoc("Bogotá"); } }, [open]);
  if (!open) return null;
  const depts = ["Producto", "Ingeniería", "Finanzas", "Marketing", "Personas"];
  const locs = ["Bogotá", "Medellín", "Cali", "Popayán"];
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Nuevo empleado</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Nombre completo</div>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Felipe Castro" />
          <div className="flabel">Cargo</div>
          <input className="field" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ej. Desarrollador Frontend" />
          <div className="flabel">Departamento</div>
          <div className="chips">{depts.map((d) => <button key={d} className={`chip ${dept === d ? "on" : ""}`} onClick={() => setDept(d)}>{d}</button>)}</div>
          <div className="flabel">Ubicación</div>
          <div className="chips">{locs.map((l) => <button key={l} className={`chip ${loc === l ? "on" : ""}`} onClick={() => setLoc(l)}>{l}</button>)}</div>
        </div>
        <div className="mfoot">
          <span />
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn dark" onClick={() => name.trim() && role.trim() && onCreate({ name, role, dept, loc })}>Crear</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Empleados({ notify, firmasState }) {
  const [employees, setEmployees] = useState(EMPLEADOS);
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState(null);
  const [view, setView] = useState("directorio");
  const [overlay, setOverlay] = useState("ninguno");
  const [addOpen, setAddOpen] = useState(false);
  const rows = employees.filter((e) =>
    (e.name + e.role + e.dept + e.loc).toLowerCase().includes(q.toLowerCase()));
  const exportRows = () => {
    exportExcel(rows.map((e) => ({ ID: e.id, Nombre: e.name, Cargo: e.role, Departamento: e.dept, Ubicación: e.loc, Estado: e.st })), "empleados-whitebox");
    notify("Excel exportado", "ok");
  };
  const root = employees.find((e) => !e.manager);
  const sel = employees.find((e) => e.id === selId) || null;

  const addEmployee = (d) => {
    const id = `EMP-1${50 + employees.length}`;
    setEmployees((es) => [{ id, ...d, st: "Onboarding", perm: "Empleado", manager: root ? root.name : null }, ...es]);
    notify("Empleado añadido", "ok");
    setAddOpen(false);
  };
  const updateEmployee = (id, patch) => {
    setEmployees((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    notify("Empleado actualizado", "ok");
  };
  const deleteEmployee = (id) => {
    const removed = employees.find((e) => e.id === id);
    setEmployees((es) => es.filter((e) => e.id !== id));
    setSelId(null);
    notify(`${removed.name} eliminado`, "info", "Deshacer", () => setEmployees((es) => [removed, ...es]));
  };

  return (
    <>
      <div className="card rise d1">
        <div className="chead">
          <div className="chips">
            <button className={`chip ${view === "directorio" ? "on" : ""}`} onClick={() => setView("directorio")}><Users size={13} />Directorio</button>
            <button className={`chip ${view === "organigrama" ? "on" : ""}`} onClick={() => setView("organigrama")}><BarChart3 size={13} />Organigrama</button>
          </div>
          {view === "directorio" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="search" style={{ width: 220 }}>
                <Search size={15} />
                <input placeholder="Buscar empleado…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
              <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nuevo empleado</button>
            </div>
          )}
        </div>
        {view === "directorio" ? (
          <table className="tbl">
            <thead><tr><th>Empleado</th><th>Cargo</th><th>Departamento</th><th>Ubicación</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6}><div className="dempty" style={{ padding: "22px 0", textAlign: "center" }}>No se encontraron empleados para "{q}".</div></td></tr>
              ) : rows.map((e) => (
                <tr className="trow" key={e.id} style={{ cursor: "pointer" }} onClick={() => setSelId(e.id)}>
                  <td><div className="cemp"><Avatar name={e.name} /><div><div className="cename">{e.name}</div><div className="ceid mono">{e.id}</div></div></div></td>
                  <td className="muted">{e.role}</td>
                  <td className="muted">{e.dept}</td>
                  <td className="muted">{e.loc}</td>
                  <td><Badge st={e.st} /></td>
                  <td style={{ textAlign: "right" }}><ChevronRight size={16} color="#c4c4cc" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="orgwrap">
          <div className="orgmetasel">
              <span className="kvs">Ver por:</span>
              {[["ninguno","Estándar"],["riesgo","Riesgo rotación"],["desempeno","Desempeño"]].map(([id, lbl]) => (
                <button key={id} className={`chip ${overlay === id ? "on" : ""}`} onClick={() => setOverlay(id)}>{lbl}</button>
              ))}
              {overlay !== "ninguno" && (
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {[["var(--grn)","Alto"],["var(--amb)","Medio"],["var(--redd)","Bajo/Riesgo"]].map(([c, l]) => (
                    <span key={l} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />{l}
                    </span>
                  ))}
                </span>
              )}
            </div>
            {root && <OrgNode emp={root} all={employees} onOpen={(e) => setSelId(e.id)} overlay={overlay === "ninguno" ? null : overlay} />}
          </div>
        )}
      </div>
      <EmployeeDrawer e={sel} onClose={() => setSelId(null)} notify={notify} onUpdate={updateEmployee} onDelete={deleteEmployee} firmasState={firmasState} />
      <NewEmployeeModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={addEmployee} />
    </>
  );
}

function EmployeeDrawer({ e, onClose, notify, onUpdate, onDelete, firmasState }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  useEffect(() => { if (e) { setForm({ name: e.name, role: e.role, dept: e.dept, loc: e.loc, st: e.st }); setEditing(false); } }, [e && e.id]);
  if (!e || !form) return null;
  const [g1, g2] = DEPT_GRAD[e.dept] || ["#a6a6b2", "#6b6b76"];
  const email = e.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".") + "@whitebox.com";
  const idNum = parseInt(String(e.id).replace(/\D/g, ""), 10) || 0;
  const digits = String(1000000000 + ((idNum * 137) % 900000000)).slice(-9);
  const phone = `+57 3${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
  const liveFirmas = firmasState || FIRMAS;
  const pendingDocs = liveFirmas.filter((f) => f.who === e.name && f.st !== "Firmado");
  const assets = INVENTARIO.filter((it) => it.who === e.name);
  const depts = ["Producto", "Ingeniería", "Finanzas", "Marketing", "Personas"];
  const locs = ["Bogotá", "Medellín", "Cali", "Popayán"];
  const sts = ["Activo", "Onboarding", "En licencia"];
  const save = () => { onUpdate(e.id, form); setEditing(false); };
  return (
    <>
      <div className="ovl" onClick={onClose} />
      <aside className="drawer">
        <div className="dhead tkhead">
          <div className="kglow" style={{ background: g1 }} />
          <div style={{
            width: 44, height: 44, borderRadius: 13, position: "relative", zIndex: 1, flexShrink: 0,
            background: `linear-gradient(145deg,${g1},${g2})`, boxShadow: `0 8px 18px -8px ${g2}99`,
            display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 15,
          }}>{initials(e.name)}</div>
          <div style={{ flex: 1, position: "relative", zIndex: 1, minWidth: 0 }}>
            <div className="dh-t">{e.name}</div>
            <div className="dh-s">{e.role}</div>
          </div>
          <button className="ibtn" onClick={onClose} style={{ position: "relative", zIndex: 1 }}><X size={18} /></button>
        </div>
        <div className="dbody">
          {editing ? (
            <>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input className="field" value={form.name} onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))} />
              <div className="flabel">Cargo</div>
              <input className="field" value={form.role} onChange={(ev) => setForm((f) => ({ ...f, role: ev.target.value }))} />
              <div className="flabel">Departamento</div>
              <div className="chips">{depts.map((d) => <button key={d} className={`chip ${form.dept === d ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, dept: d }))}>{d}</button>)}</div>
              <div className="flabel">Ubicación</div>
              <div className="chips">{locs.map((l) => <button key={l} className={`chip ${form.loc === l ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, loc: l }))}>{l}</button>)}</div>
              <div className="flabel">Estado</div>
              <div className="chips">{sts.map((s) => <button key={s} className={`chip ${form.st === s ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, st: s }))}>{s}</button>)}</div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Badge st={e.st} /></div>
              <div className="treq">
                <span className="treqarea"><span className="areadot" style={{ background: g2 }} />{e.dept}</span>
                <span>· {e.loc}</span>
              </div>

              <div className="dsect">Contacto</div>
              <div className="ccrow"><Mail size={15} />{email}</div>
              <div className="ccrow"><Phone size={15} />{phone}</div>
              <div className="ccrow"><MapPin size={15} />{e.loc}, Colombia</div>

              <div className="dsect">Firmas pendientes</div>
              {pendingDocs.length ? pendingDocs.map((f) => (
                <div className="elrow" key={f.id}>
                  <div><div className="eltxt">{f.name}</div><div className="elsub mono">{f.id} · {f.date}</div></div>
                  <Badge st={f.st} />
                </div>
              )) : <div className="dempty">Sin firmas pendientes.</div>}

              <div className="dsect">Activos asignados</div>
              {assets.length ? assets.map((it) => (
                <div className="elrow" key={it.id}>
                  <div><div className="eltxt">{it.item}</div><div className="elsub mono">{it.serial}</div></div>
                  <Badge st={it.st} />
                </div>
              )) : <div className="dempty">Sin activos asignados.</div>}

              {(EMP_JOURNEY[e.name] || []).length > 0 && (<>
                <div className="dsect">Historial</div>
                <div>
                  {(EMP_JOURNEY[e.name] || []).slice().reverse().map((ev, i, arr) => (
                    <div className={`tli ${i === arr.length - 1 ? "last" : ""}`} key={i}>
                      <div className="tlrail"><div className={`tlnode ${ev.tone === "red" ? "red" : ev.tone === "vio" ? "vio" : ""}`} /></div>
                      <div className="tlbody">
                        <div className="tltop">
                          <div className="tltxt">{ev.desc}</div>
                          <div className="tltime mono">{ev.fecha}</div>
                        </div>
                        <span className="tltag">{ev.tipo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>)}
            </>
          )}
        </div>
        <div className="dacts">
          {editing ? (
            <>
              <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => setEditing(false)}>Cancelar</button>
              <button className="btn dark" style={{ flex: 1, justifyContent: "center" }} onClick={save}><Check size={15} />Guardar</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setEditing(true)}><PenLine size={15} />Editar</button>
              <button className="btn dark" style={{ flex: 1, justifyContent: "center" }} onClick={() => notify(`Mensaje enviado a ${e.name}`, "ok")}><MessageSquare size={15} />Enviar mensaje</button>
              <button className="ibtn" style={{ color: "var(--redd)", borderColor: "#f7cbcb" }} data-tip="Eliminar empleado" onClick={() => onDelete(e.id)}><Trash2 size={17} /></button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function SignModal({ open, onClose, onSign }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHasInk(false); setAgree(false); setErr(false); setDone(false);
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#15151a";
    ctxRef.current = ctx;
  }, [open]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; const { x, y } = pos(e); ctxRef.current.beginPath(); ctxRef.current.moveTo(x, y); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const { x, y } = pos(e); ctxRef.current.lineTo(x, y); ctxRef.current.stroke(); if (!hasInk) setHasInk(true); };
  const end = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current; ctxRef.current.clearRect(0, 0, c.width, c.height); setHasInk(false); };
  const sign = () => {
    if (!agree || !hasInk) { setErr(true); return; }
    onSign(canvasRef.current.toDataURL("image/png"));
    setDone(true);
  };

  if (!open) return null;
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div className="mtitle">Firmar contrato</div>
          <button className="ibtn" onClick={onClose}><X size={18} /></button>
        </div>
        {done ? (
          <StatusCard tone="ok" title="¡Contrato firmado!" sub="Tu firma quedó registrada y el documento se marcó como completado.">
            <button className="btn" onClick={onClose}>Cerrar</button>
            <button className="btn dark" onClick={onClose}>Ver firma</button>
          </StatusCard>
        ) : (
          <>
            <div className="mbody">
              <div className="sigarea">
                <canvas ref={canvasRef}
                  onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
                  onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
                {!hasInk && <div className="sighint">Dibuja tu firma aquí</div>}
              </div>
              <div className="sigbar"><button onClick={clear}><Eraser size={14} />Limpiar</button></div>
              <div className={`agree ${err && !agree ? "bad" : ""}`}>
                <button className={`sw ${agree ? "on" : ""}`} onClick={() => { setAgree((v) => !v); setErr(false); }} aria-label="Aceptar términos" />
                <div className="agreetxt">Al firmar, confirmo que he leído y acepto todos los términos contractuales, que pasan a ser legalmente vinculantes.</div>
              </div>
              {err && <div className="errline"><AlertCircle size={14} />{!agree ? "Confirma que aceptas los términos antes de firmar." : "Dibuja tu firma para continuar."}</div>}
            </div>
            <div className="mfoot">
              <button className="btn" style={{ border: "none", boxShadow: "none", padding: "9px 4px", color: "var(--ink2)" }} onClick={onClose}><PenLine size={14} />Gestionar firmas</button>
              <div style={{ display: "flex", gap: 9 }}>
                <button className="btn" onClick={onClose}>Cancelar</button>
                <button className="btn dark" onClick={sign}>Firmar contrato</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Firmas({ notify, firmasState, setFirmasState }) {
  const [signOpen, setSignOpen] = useState(false);
  const [sig, setSig] = useState(null);
  const rows = firmasState;
  const setRows = setFirmasState;
  const request = () => {
    const id = `DOC-${3200 + Math.floor(Math.random() * 90)}`;
    setRows((r) => [{ id, name: "Acuerdo de confidencialidad", who: "Nuevo ingreso", type: "Acuerdo", st: "Pendiente", date: "21 jun 2026", days: 0 }, ...r]);
    notify("Firma solicitada correctamente", "ok");
  };
  return (
    <div className="g2">
      <div className="card rise d1">
        <div className="chead"><div className="ctitle">Documentos para firma</div><span className="kvs">{rows.length} en total</span></div>
        <table className="tbl">
          <thead><tr><th>Documento</th><th>Empleado</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((f) => (
              <tr className="trow" key={f.id}>
                <td><div className="cename">{f.name}</div><div className="ceid mono">{f.id}</div></td>
                <td className="muted">{f.who}</td>
                <td className="muted">{f.type}</td>
                <td className="muted mono" style={{ fontSize: 12 }}>{f.date}</td>
                <td><Badge st={f.st} /></td>
                <td style={{ textAlign:"right" }}><button className="ibtn" style={{ width:28,height:28 }} data-tip="Eliminar" onClick={() => { setRows(r=>r.filter(x=>x.id!==f.id)); notify("Firma eliminada","ok"); }}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card cpad rise d2">
          <div className="ctitle" style={{ marginBottom: 14 }}>Subir y solicitar firma</div>
          <div className="drop">
            <div className="dico"><Upload size={20} /></div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Arrastra un documento aquí</div>
            <div style={{ color: "var(--ink2)", fontSize: 12.5, marginTop: 3 }}>PDF, DOCX · hasta 20 MB</div>
          </div>
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} onClick={request}><Plus size={15} />Solicitar firma</button>
        </div>

        <div className="card cpad rise d3">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div><div className="ctitle">Tu firma</div><div className="kvs" style={{ marginTop: 2 }}>Camila Restrepo · Líder de RRHH</div></div>
            <div className="badge b-grn"><Check size={12} />Verificada</div>
          </div>
          <div className="signpad">
            {sig
              ? <img src={sig} alt="Firma" style={{ maxHeight: 110, maxWidth: "90%" }} />
              : <svg width="180" height="56" viewBox="0 0 180 56"><path d="M8 40 C 22 8, 30 8, 34 36 C 38 16, 46 16, 50 38 C 60 20, 70 44, 84 28 C 96 16, 104 46, 120 30 C 134 18, 150 40, 172 22" fill="none" stroke="#15151a" strokeWidth="2.4" strokeLinecap="round" /></svg>}
          </div>
          <button className="btn dark" style={{ width: "100%", marginTop: 14 }} onClick={() => setSignOpen(true)}><PenLine size={15} />Firmar contrato</button>
        </div>
      </div>

      <SignModal open={signOpen} onClose={() => setSignOpen(false)} onSign={(url) => setSig(url)} />
    </div>
  );
}

function NewPedidoModal({ open, onClose, onCreate }) {
  const [item, setItem] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [cant, setCant] = useState(1);
  const [precio, setPrecio] = useState("");
  useEffect(() => { if (open) { setItem(""); setProveedor(""); setCant(1); setPrecio(""); } }, [open]);
  if (!open) return null;
  const create = () => {
    if (!item.trim() || !proveedor.trim()) return;
    onCreate({ item, proveedor, cant: Number(cant) || 1, precioEst: Number(precio) || 0 });
  };
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Nuevo pedido</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Artículo</div>
          <input className="field" value={item} onChange={(e) => setItem(e.target.value)} placeholder="Ej. Monitor LG 27''" />
          <div className="flabel">Proveedor</div>
          <input className="field" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ej. LG Electronics" />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Cantidad</div>
              <input className="field" type="number" min="1" value={cant} onChange={(e) => setCant(e.target.value)} />
            </div>
            <div style={{ flex: 2 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Precio estimado (unitario)</div>
              <input className="field" type="number" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>
        <div className="mfoot">
          <span />
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn dark" onClick={create}>Crear pedido</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditActivoModal({ item, onClose, onSave }) {
  const [nombre, setNombre] = useState("");
  const [who, setWho] = useState("");
  const [st, setSt] = useState("Disponible");
  useEffect(() => { if (item) { setNombre(item.item); setWho(item.who); setSt(item.st); } }, [item]);
  if (!item) return null;
  const sts = ["Disponible", "Asignado", "Mantenimiento"];
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Editar activo</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Activo</div>
          <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <div className="flabel">Asignado a</div>
          <input className="field" value={who} onChange={(e) => setWho(e.target.value)} placeholder="— si no está asignado" />
          <div className="flabel">Estado</div>
          <div className="chips">{sts.map((s) => <button key={s} className={`chip ${st === s ? "on" : ""}`} onClick={() => setSt(s)}>{s}</button>)}</div>
        </div>
        <div className="mfoot">
          <span />
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn dark" onClick={() => onSave(item.id, { item: nombre, who, st })}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inventario({ notify }) {
  const [items, setItems] = useState(INVENTARIO);
  const [facturas, setFacturas] = useState(FACTURAS);
  const [pedidos, setPedidos] = useState(PEDIDOS);
  const [view, setView] = useState("activos");
  const [selFacturaId, setSelFacturaId] = useState(null);
  const [pedidoOpen, setPedidoOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newItem, setNewItem] = useState({ nombre: "", cat: "Cómputo", serial: "", who: "—" });

  const addItem = () => {
    if (!newItem.nombre.trim()) return;
    const id = `INV-0${600 + Math.floor(Math.random() * 90)}`;
    setItems(it => [{ id, item: newItem.nombre, cat: newItem.cat, who: newItem.who || "—",
      serial: newItem.serial || `NW-${Math.floor(Math.random() * 90000)}`, st: "Disponible", date: "Jun 2026" }, ...it]);
    notify("Activo añadido al inventario", "ok");
    setAddOpen(false);
    setNewItem({ nombre: "", cat: "Cómputo", serial: "", who: "—" });
  };
  const updateItem = (id, patch) => {
    setItems((it) => it.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    notify("Activo actualizado", "ok");
    setEditItem(null);
  };
  const deleteItem = (id) => {
    const removed = items.find((x) => x.id === id);
    setItems((it) => it.filter((x) => x.id !== id));
    notify(`"${removed.item}" eliminado`, "info", "Deshacer", () => setItems((it) => [removed, ...it]));
  };
  const updateFactura = (id, patch) => {
    setFacturas((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    notify("Factura actualizada", "ok");
  };
  const deleteFactura = (id) => {
    const removed = facturas.find((x) => x.id === id);
    setFacturas((f) => f.filter((x) => x.id !== id));
    setSelFacturaId(null);
    notify(`Factura ${id} eliminada`, "info", "Deshacer", () => setFacturas((f) => [removed, ...f]));
  };
  const total = (f) => f.items.reduce((s, it) => s + it.cant * it.precio, 0);
  const selFactura = facturas.find((x) => x.id === selFacturaId) || null;

  const exportActivos = () => {
    exportExcel(items.map((it) => ({ ID: it.id, Activo: it.item, Categoría: it.cat, "Asignado a": it.who, Serial: it.serial, Ingreso: it.date, Estado: it.st })), "activos-whitebox");
    notify("Excel exportado", "ok");
  };
  const exportFacturas = () => {
    exportExcel(facturas.map((f) => ({ Factura: f.id, Proveedor: f.proveedor, Fecha: f.fecha, Estado: f.st, Total: total(f) })), "facturas-whitebox");
    notify("Excel exportado", "ok");
  };
  const exportPedidos = () => {
    exportExcel(pedidos.map((p) => ({ Pedido: p.id, Artículo: p.item, Proveedor: p.proveedor, Cantidad: p.cant, "Precio est.": p.precioEst, Fecha: p.fecha, Estado: p.st, "Solicitado por": p.quien })), "pedidos-whitebox");
    notify("Excel exportado", "ok");
  };

  const addPedido = (d) => {
    const id = `PED-${505 + pedidos.length}`;
    setPedidos((p) => [{ id, ...d, fecha: "21 jun 2026", st: "Solicitado", quien: "Camila Restrepo" }, ...p]);
    notify("Pedido creado", "ok");
    setPedidoOpen(false);
  };
  const approvePedido = (id) => {
    setPedidos((p) => p.map((x) => (x.id === id ? { ...x, st: "Aprobado" } : x)));
    notify("Pedido aprobado", "ok");
  };
  const invoicePedido = (id) => {
    const ped = pedidos.find((x) => x.id === id);
    if (!ped) return;
    setPedidos((p) => p.map((x) => (x.id === id ? { ...x, st: "Facturado" } : x)));
    const facId = `FAC-${2256 + facturas.length}`;
    setFacturas((f) => [{ id: facId, proveedor: ped.proveedor, fecha: "21 jun 2026", st: "Pendiente", items: [{ activo: ped.item, cant: ped.cant, precio: ped.precioEst }] }, ...f]);
    notify(`Pedido facturado · ${facId} creada`, "ok");
  };

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={Boxes} tone="ink" label="Total de activos" value="234" /></div>
        <div className="rise d2"><Stat ico={Users} tone="blu" label="Asignados" value="188" /></div>
        <div className="rise d3"><Stat ico={Package} tone="grn" label="Disponibles" value="34" /></div>
        <div className="rise d4"><Stat ico={AlertCircle} tone="amb" label="En mantenimiento" value="12" /></div>
      </div>
      <div className="card rise d2">
        <div className="chead">
          <div className="chips">
            <button className={`chip ${view === "activos" ? "on" : ""}`} onClick={() => setView("activos")}><Boxes size={13} />Activos</button>
            <button className={`chip ${view === "pedidos" ? "on" : ""}`} onClick={() => setView("pedidos")}><ShoppingCart size={13} />Pedidos</button>
            <button className={`chip ${view === "facturas" ? "on" : ""}`} onClick={() => setView("facturas")}><Receipt size={13} />Facturas</button>
          </div>
          {view === "activos" && (
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={exportActivos}><FileSpreadsheet size={15} />Exportar</button>
              <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Añadir activo</button>
            </div>
          )}
          {view === "pedidos" && (
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={exportPedidos}><FileSpreadsheet size={15} />Exportar</button>
              <button className="btn pri" onClick={() => setPedidoOpen(true)}><Plus size={15} />Nuevo pedido</button>
            </div>
          )}
          {view === "facturas" && (
            <button className="btn" onClick={exportFacturas}><FileSpreadsheet size={15} />Exportar</button>
          )}
        </div>

        {view === "activos" && (
          <table className="tbl">
            <thead><tr><th>Activo</th><th>Categoría</th><th>Asignado a</th><th>Serial</th><th>Ingreso</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr className="trow" key={it.id}>
                  <td><div className="cename">{it.item}</div><div className="ceid mono">{it.id}</div></td>
                  <td className="muted">{it.cat}</td>
                  <td className="muted">{it.who}</td>
                  <td className="mono muted" style={{ fontSize: 12 }}>{it.serial}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{it.date}</td>
                  <td><Badge st={it.st} /></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                      <button className="ibtn" style={{ width:30,height:30,borderRadius:9 }} data-tip="Editar" onClick={() => setEditItem(it)}><PenLine size={14} /></button>
                      <button className="ibtn" style={{ width:30,height:30,borderRadius:9,color:"var(--redd)" }} data-tip="Eliminar" onClick={() => deleteItem(it.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === "pedidos" && (
          <table className="tbl">
            <thead><tr><th>Pedido</th><th>Proveedor</th><th>Cant.</th><th>Estimado</th><th>Solicitado por</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {pedidos.map((p) => (
                <tr className="trow" key={p.id}>
                  <td><div className="cename">{p.item}</div><div className="ceid mono">{p.id}</div></td>
                  <td className="muted">{p.proveedor}</td>
                  <td className="muted">{p.cant}</td>
                  <td className="muted">{cop(p.cant * p.precioEst)}</td>
                  <td className="muted">{p.quien}</td>
                  <td><Badge st={p.st} /></td>
                  <td style={{ textAlign: "right" }}>
                    {p.st === "Solicitado" && <button className="btn" style={{ padding: "6px 11px", fontSize: 12 }} onClick={() => approvePedido(p.id)}>Aprobar</button>}
                    {p.st === "Aprobado" && <button className="btn dark" style={{ padding: "6px 11px", fontSize: 12 }} onClick={() => invoicePedido(p.id)}>Facturar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {view === "facturas" && (
          <table className="tbl">
            <thead><tr><th>Factura</th><th>Proveedor</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>
              {facturas.map((f) => (
                <tr className="trow" key={f.id} style={{ cursor: "pointer" }} onClick={() => setSelFacturaId(f.id)}>
                  <td><div className="cename mono">{f.id}</div><div className="ceid">{f.items.length} {f.items.length === 1 ? "ítem" : "ítems"}</div></td>
                  <td className="muted">{f.proveedor}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{f.fecha}</td>
                  <td className="cename">{cop(total(f))}</td>
                  <td><Badge st={f.st} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <FacturaDrawer f={selFactura} onClose={() => setSelFacturaId(null)} notify={notify} onUpdate={updateFactura} onDelete={deleteFactura} />
      <NewPedidoModal open={pedidoOpen} onClose={() => setPedidoOpen(false)} onCreate={addPedido} />
      <EditActivoModal item={editItem} onClose={() => setEditItem(null)} onSave={updateItem} />
      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal t-modal is-open" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo activo</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre del activo</div>
              <input className="field" placeholder="Ej. MacBook Pro 14" value={newItem.nombre} onChange={e => setNewItem(n => ({ ...n, nombre: e.target.value }))} />
              <div className="flabel">Categoría</div>
              <select className="field" value={newItem.cat} onChange={e => setNewItem(n => ({ ...n, cat: e.target.value }))}>
                {["Cómputo","Mobiliario","Herramientas","Vehículos","Electrónica","Otro"].map(c => <option key={c}>{c}</option>)}
              </select>
              <div className="flabel">Serial / Ref.</div>
              <input className="field" placeholder="NW-12345" value={newItem.serial} onChange={e => setNewItem(n => ({ ...n, serial: e.target.value }))} />
              <div className="flabel">Asignado a</div>
              <select className="field" value={newItem.who} onChange={e => setNewItem(n => ({ ...n, who: e.target.value }))}>
                <option>—</option>
                {EMPLEADOS.map(e => <option key={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="mfoot"><span /><div style={{ display: "flex", gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addItem}>Añadir activo</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  );
}

function FacturaDrawer({ f, onClose, notify, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  useEffect(() => { if (f) { setForm({ proveedor: f.proveedor, fecha: f.fecha, st: f.st }); setEditing(false); } }, [f && f.id]);
  if (!f || !form) return null;
  const total = f.items.reduce((s, it) => s + it.cant * it.precio, 0);
  const [g1, g2] = ["#b298f2", "#8b5cf6"];
  const exportRow = () => {
    exportExcel(f.items.map((it) => ({ Factura: f.id, Proveedor: f.proveedor, Activo: it.activo, Cantidad: it.cant, "Precio unitario": it.precio, Subtotal: it.cant * it.precio })), `${f.id}-whitebox`);
    notify("Excel exportado", "ok");
  };
  const save = () => { onUpdate(f.id, form); setEditing(false); };
  const sts = ["Pendiente", "Pagada"];
  return (
    <>
      <div className="ovl" onClick={onClose} />
      <aside className="drawer">
        <div className="dhead tkhead">
          <div className="kglow" style={{ background: g1 }} />
          <div className="dmark" style={{ background: `linear-gradient(145deg,${g1},${g2})`, boxShadow: `0 8px 18px -8px ${g2}99` }}>
            <Receipt size={19} color="#fff" />
          </div>
          <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
            <div className="dh-t mono">{f.id}</div>
            <div className="dh-s">{f.proveedor}</div>
          </div>
          <button className="ibtn" onClick={onClose} style={{ position: "relative", zIndex: 1 }}><X size={18} /></button>
        </div>
        <div className="dbody">
          {editing ? (
            <>
              <div className="flabel" style={{ marginTop: 0 }}>Proveedor</div>
              <input className="field" value={form.proveedor} onChange={(e) => setForm((x) => ({ ...x, proveedor: e.target.value }))} />
              <div className="flabel">Fecha</div>
              <input className="field" value={form.fecha} onChange={(e) => setForm((x) => ({ ...x, fecha: e.target.value }))} />
              <div className="flabel">Estado</div>
              <div className="chips">{sts.map((s) => <button key={s} className={`chip ${form.st === s ? "on" : ""}`} onClick={() => setForm((x) => ({ ...x, st: s }))}>{s}</button>)}</div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Badge st={f.st} /><span className="kvs">{f.fecha}</span></div>

              <div className="dsect">Ítems facturados</div>
              {f.items.map((it, i) => (
                <div className="elrow" key={i}>
                  <div><div className="eltxt">{it.activo}</div><div className="elsub">{it.cant} × {cop(it.precio)}</div></div>
                  <div className="eltxt">{cop(it.cant * it.precio)}</div>
                </div>
              ))}
              <div className="elrow" style={{ borderBottom: "none", paddingTop: 14 }}>
                <div className="eltxt" style={{ fontSize: 14 }}>Total</div>
                <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.04em" }}>{cop(total)}</div>
              </div>
            </>
          )}
        </div>
        <div className="dacts">
          {editing ? (
            <>
              <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => setEditing(false)}>Cancelar</button>
              <button className="btn dark" style={{ flex: 1, justifyContent: "center" }} onClick={save}><Check size={15} />Guardar</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={exportRow}><FileSpreadsheet size={15} /></button>
              <button className="btn" onClick={() => setEditing(true)}><PenLine size={15} /></button>
              <button className="btn dark" style={{ flex: 1, justifyContent: "center" }} onClick={() => window.print()}><Printer size={15} />Imprimir / PDF</button>
              <button className="ibtn" style={{ color: "var(--redd)", borderColor: "#f7cbcb" }} data-tip="Eliminar factura" onClick={() => onDelete(f.id)}><Trash2 size={17} /></button>
            </>
          )}
        </div>
      </aside>

      <div className="printarea">
        <div className="pinv-head">
          <div>
            <div className="pinv-logo">Whitebox</div>
            <div className="pinv-sub">Factura de compra de activo</div>
          </div>
          <div className="pinv-meta">
            <div><b>Factura</b> {f.id}</div>
            <div><b>Fecha</b> {f.fecha}</div>
            <div><b>Estado</b> {f.st}</div>
          </div>
        </div>
        <div className="pinv-parties">
          <div><div className="pinv-label">Proveedor</div><div>{f.proveedor}</div></div>
          <div><div className="pinv-label">Facturado a</div><div>Whitebox SAS · NIT 900.123.456-7</div></div>
        </div>
        <table className="pinv-table">
          <thead><tr><th>Activo</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead>
          <tbody>
            {f.items.map((it, i) => (
              <tr key={i}><td>{it.activo}</td><td>{it.cant}</td><td>{cop(it.precio)}</td><td>{cop(it.cant * it.precio)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="pinv-total">Total: {cop(total)}</div>
        <div className="pinv-foot">Whitebox SAS — documento generado automáticamente.</div>
      </div>
    </>
  );
}

const SHARE_PEOPLE = [
  { name: "Camila Restrepo", email: "camila.r@empresa.co", owner: true },
  { name: "Juan Pérez", email: "juan.p@empresa.co", role: "Puede editar" },
  { name: "Laura Jiménez", email: "laura.j@empresa.co", role: "Puede ver" },
];

function ShareModal({ open, name, onClose, notify }) {
  const [people, setPeople] = useState(SHARE_PEOPLE);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Puede ver");
  const [access, setAccess] = useState("invited");
  useEffect(() => { if (open) { setPeople(SHARE_PEOPLE); setEmail(""); setInviteRole("Puede ver"); } }, [open]);
  if (!open) return null;
  const cycleRole = (r) => (r === "Puede ver" ? "Puede editar" : "Puede ver");
  const invite = () => {
    const v = email.trim(); if (!v) return;
    const nm = v.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    setPeople((p) => [...p, { name: nm, email: v, role: inviteRole }]);
    setEmail(""); notify("Invitación enviada", "ok");
  };
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div><div className="mtitle">Compartir</div><div className="kvs" style={{ marginTop: 2 }}>{name}</div></div>
          <button className="ibtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mbody">
          <div className="invite">
            <input className="field" style={{ flex: 1, minWidth: 0 }} placeholder="Correo o nombre…" value={email}
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && invite()} />
            <button className="role" onClick={() => setInviteRole(cycleRole)}>{inviteRole} <ChevronDown size={13} /></button>
            <button className="btn dark" onClick={invite}>Invitar</button>
          </div>
          <div className="flabel" style={{ marginTop: 14 }}>Acceso general</div>
          <button className="acc" onClick={() => { setAccess("invited"); notify("Acceso limitado a invitados", "ok"); }}>
            <span className="acico"><Users size={17} /></span>
            <div style={{ flex: 1 }}><div className="act">Solo invitados</div><div className="acs">{people.length} personas con acceso</div></div>
            {access === "invited" ? <Check size={16} color="var(--grn)" /> : <ChevronDown size={16} color="#c4c4cc" />}
          </button>
          <button className="acc" onClick={() => { setAccess("link"); notify("Acceso por enlace activado", "ok"); }}>
            <span className="acico"><Link2 size={17} /></span>
            <div style={{ flex: 1 }}><div className="act">Acceso por enlace</div><div className="acs">Solo quien tenga el enlace</div></div>
            {access === "link" ? <Check size={16} color="var(--grn)" /> : <ChevronDown size={16} color="#c4c4cc" />}
          </button>
          <div className="flabel">Personas con acceso</div>
          {people.map((p, i) => (
            <div className="prow" key={i}>
              <Avatar name={p.name} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}><div className="cename">{p.name}</div><div className="ceid" style={{ fontSize: 12 }}>{p.email}</div></div>
              {p.owner
                ? <span className="prole" style={{ color: "var(--grn)" }}><ShieldCheck size={13} />Propietario</span>
                : <>
                    <button className="prole" onClick={() => setPeople((x) => x.map((pp, j) => j === i ? { ...pp, role: cycleRole(pp.role) } : pp))}>{p.role} <ChevronDown size={13} /></button>
                    <button className="premove" title="Quitar" onClick={() => setPeople((x) => x.filter((_, j) => j !== i))}><X size={14} /></button>
                  </>}
            </div>
          ))}
          <div className="copybar">
            <span className="lk">nucleo.rh/doc/{(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 18)}</span>
            <button className="btn" onClick={() => notify("Enlace copiado", "ok")}><Copy size={14} />Copiar enlace</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const COMPOSER_SEED = "Estimado equipo,\n\nLes compartimos la actualización de la política de teletrabajo, vigente a partir del próximo mes. Por favor revisen los puntos clave y confirmen su lectura.\n\nQuedamos atentos a sus comentarios.";
const TONOS = ["Formal", "Profesional", "Cercano", "Conciso", "Optimista"];

function AIComposer({ open, onClose, notify }) {
  const [text, setText] = useState(COMPOSER_SEED);
  const [loading, setLoading] = useState(false);
  const [tone, setTone] = useState(false);
  const taRef = useRef(null);
  useEffect(() => { if (open) { setText(COMPOSER_SEED); setTone(false); } }, [open]);

  const wrap = (before, after = before) => {
    const ta = taRef.current; if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = text.slice(s, e) || "texto";
    const next = text.slice(0, s) + before + sel + after + text.slice(e);
    setText(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  const linePrefix = (prefix, numbered = false) => {
    const ta = taRef.current; if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const lineStart = text.lastIndexOf("\n", s - 1) + 1;
    const lineEnd = text.indexOf("\n", e); const end = lineEnd === -1 ? text.length : lineEnd;
    const block = text.slice(lineStart, end);
    const lines = block.split("\n").map((l, i) => (numbered ? `${i + 1}. ` : prefix) + l);
    const next = text.slice(0, lineStart) + lines.join("\n") + text.slice(end);
    setText(next);
    requestAnimationFrame(() => ta.focus());
  };

  async function run(instruction) {
    if (loading) return;
    setLoading(true); setTone(false);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          system: "Eres un asistente de redacción para comunicaciones internas de RRHH. Aplica la instrucción al texto y devuelve ÚNICAMENTE el texto resultante en español, sin comillas ni comentarios.",
          messages: [{ role: "user", content: `Instrucción: ${instruction}.\n\nTexto:\n${text}` }],
        }),
      });
      const data = await res.json();
      const out = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (out) setText(out);
    } catch (e) { notify("No se pudo conectar con la IA", "err"); }
    finally { setLoading(false); }
  }

  if (!open) return null;
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal modalw" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Redactar con IA</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="fbar">
            <button className="aipill" onClick={() => run("Mejora la redacción y la claridad")}><Sparkles size={14} />Editar con IA</button>
            <span className="fsep" />
            <button className="ftxt" onClick={() => linePrefix("# ")}><Type size={14} />Texto <ChevronDown size={12} /></button>
            <span className="fsep" />
            <button className="fbtn" onClick={() => wrap("**")}><Bold size={15} /></button>
            <button className="fbtn" onClick={() => wrap("*")}><Italic size={15} /></button>
            <button className="fbtn" onClick={() => wrap("<u>", "</u>")}><Underline size={15} /></button>
            <button className="fbtn" onClick={() => wrap("~~")}><Strikethrough size={15} /></button>
            <span className="fsep" />
            <button className="fbtn" onClick={() => linePrefix("- ")}><List size={15} /></button>
            <button className="fbtn" onClick={() => linePrefix("", true)}><ListOrdered size={15} /></button>
            <span className="fsep" />
            <button className="fbtn" onClick={() => wrap("[", "](enlace)")}><Link2 size={15} /></button>
            <button className="fbtn" onClick={() => wrap("![", "](imagen)")}><Image size={15} /></button>
            <button className="fbtn" onClick={() => linePrefix("> ")}><Quote size={15} /></button>
          </div>
          <textarea ref={taRef} className="editor" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="aibar">
            <div className="aibar-h"><Sparkles size={14} style={{ color: "var(--red)" }} />{loading ? "La IA está escribiendo…" : tone ? "Cambiar tono a…" : "Preguntar a la IA"}</div>
            {loading ? <div className="typing"><i /><i /><i /></div>
              : tone ? (
                <div className="aichips">
                  {TONOS.map((t) => <button key={t} className="aichip" onClick={() => run(`Cambia el tono a ${t.toLowerCase()}`)}>{t}</button>)}
                  <button className="aichip" onClick={() => setTone(false)}>Cancelar</button>
                </div>
              ) : (
                <div className="aichips">
                  <button className="aichip" onClick={() => run("Mejora la redacción y la claridad")}><Sparkles size={12} />Mejorar redacción</button>
                  <button className="aichip" onClick={() => setTone(true)}>Cambiar tono</button>
                  <button className="aichip" onClick={() => run("Hazlo más corto y directo")}>Hacer más corto</button>
                  <button className="aichip" onClick={() => run("Amplía el contenido con más detalle")}>Ampliar</button>
                </div>
              )}
          </div>
        </div>
        <div className="mfoot">
          <span />
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn dark" onClick={() => { notify("Documento guardado", "ok"); onClose(); }}>Guardar documento</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const UPLOAD_NAMES = [
  "Política de vacaciones 2026.pdf",
  "Acta de comité SST — junio.pdf",
  "Anexo contractual — teletrabajo.pdf",
];

function UploadCard({ u, onCancel }) {
  const tone = u.stage === "done" ? "grn" : u.stage === "uploading" ? "blu" : "ink";
  return (
    <div className="upcard">
      <div className="uphead">
        <span className={`upico ${tone}`}>{u.stage === "done" ? <Check size={14} /> : <Upload size={14} />}</span>
        <div className="uptxt">
          <div className="uptitle">{u.stage === "done" ? "Subido" : "Subiendo"} "<b>{u.name}</b>"</div>
          <div className="upsub">
            {u.stage === "done" ? "¡Subido correctamente!" : u.stage === "uploading" ? "Subiendo tu archivo…" : "Preparando la subida…"}
          </div>
        </div>
        <button className="upx" onClick={() => onCancel(u.id)}><X size={14} /></button>
      </div>
      <div className="upbar">
        <div className="upfill" style={{ width: `${u.pct}%`, background: tone === "grn" ? "var(--grn)" : tone === "blu" ? "var(--blu)" : "var(--ink3)" }} />
      </div>
      <div className="upfoot"><span className="uppct">{u.pct}% subido{u.stage !== "done" ? "…" : ""}</span></div>
    </div>
  );
}

function EditDocModal({ doc, onClose, onSave }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Política");
  useEffect(() => { if (doc) { setName(doc.name); setType(doc.type); } }, [doc]);
  if (!doc) return null;
  const types = ["Contrato", "Política", "Acta"];
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Editar documento</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flabel">Tipo</div>
          <div className="chips">{types.map((t) => <button key={t} className={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>{t}</button>)}</div>
        </div>
        <div className="mfoot">
          <span />
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn dark" onClick={() => name.trim() && onSave(doc.id, { name, type })}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocCard({ d, index, onShare, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const viewUrl = d.url || `https://drive.google.com/search?q=${encodeURIComponent(d.name)}`;
  const iconClass = { Contrato: "ctr", "Política": "pol", Acta: "act", Plan: "pla" }[d.type] || "";
  return (
    <div className="docrow" onClick={() => window.open(viewUrl, "_blank")}>
      <div className="doc-name">
        <div className={`doc-icon ${iconClass}`}><FileText size={15} /></div>
        <div style={{ minWidth: 0 }}>
          <div className="doc-nametext">{d.name}</div>
          <div className="doc-id">{d.id}</div>
        </div>
      </div>
      <div className="doc-meta">{d.who}</div>
      <div className="doc-meta">{d.date}</div>
      <div className="doc-acts" onClick={e => e.stopPropagation()}>
        <button className="ibtn" style={{ width: 28, height: 28, borderRadius: 8 }} data-tip="Compartir" onClick={() => onShare(d.name)}><Share2 size={13} /></button>
        <button className="ibtn" style={{ width: 28, height: 28, borderRadius: 8 }} onClick={() => setMenuOpen(v => !v)}><MoreHorizontal size={14} /></button>
        {menuOpen && (
          <>
            <div className="popcatch" onClick={() => setMenuOpen(false)} />
            <div className="usermenu t-dropdown is-open" style={{ bottom: "auto", top: "calc(100% + 4px)", right: 0, width: 160 }}>
              <button className="umitem" onClick={() => { setMenuOpen(false); window.open(viewUrl, "_blank"); }}><Eye size={14} />Ver</button>
              <button className="umitem" onClick={() => { setMenuOpen(false); onEdit(d); }}><PenLine size={14} />Editar</button>
              <button className="umitem" style={{ color:"var(--redd)" }} onClick={() => { setMenuOpen(false); onDelete(d.id); }}><Trash2 size={14} />Eliminar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Documentos({ notify }) {
  const [shareDoc, setShareDoc] = useState(null);
  const [docs, setDocs] = useState(DOCS);
  const [uploads, setUploads] = useState([]);
  const [cat, setCat] = useState("Todos");
  const [editDoc, setEditDoc] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const upId = useRef(0);
  const CATS = { Todos: null, Contratos: "Contrato", "Políticas": "Política", Actas: "Acta" };
  const filtered = docs.filter((d) => !CATS[cat] || d.type === CATS[cat]);

  const startUpload = () => {
    const id = ++upId.current;
    const name = UPLOAD_NAMES[Math.floor(Math.random() * UPLOAD_NAMES.length)];
    setUploads((u) => [...u, { id, name, pct: 0, stage: "queued" }]);
    setTimeout(() => setUploads((u) => u.map((x) => (x.id === id ? { ...x, pct: 50, stage: "uploading" } : x))), 650);
    setTimeout(() => setUploads((u) => u.map((x) => (x.id === id ? { ...x, pct: 100, stage: "done" } : x))), 1650);
    setTimeout(() => {
      setUploads((u) => u.filter((x) => x.id !== id));
      setDocs((d) => [{ id: `F-${9010 + Math.floor(Math.random() * 89)}`, name: name.replace(/\.pdf$/, ""), type: "Política", who: "Personas", date: "Jun 2026", tags: ["Nuevo"], ai: "Sin riesgos" }, ...d]);
      notify("Documento subido correctamente", "ok");
    }, 2950);
  };
  const cancelUpload = (id) => setUploads((u) => u.filter((x) => x.id !== id));
  const updateDoc = (id, patch) => {
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    notify("Documento actualizado", "ok");
    setEditDoc(null);
  };
  const deleteDoc = (id) => {
    const removed = docs.find((d) => d.id === id);
    setDocs((d) => d.filter((x) => x.id !== id));
    notify(`"${removed.name}" eliminado`, "info", "Deshacer", () => setDocs((d) => [removed, ...d]));
  };

  return (
    <>
      <div className="phead" style={{ marginBottom: 16 }}>
        <div className="chips">
          {Object.keys(CATS).map((c) => (
            <button key={c} className={`docchip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" style={{ background:"#fff", boxShadow:"0 1px 3px rgba(20,20,26,.08)" }} onClick={() => setAiOpen(true)}><Sparkles size={15} style={{ color: "var(--red)" }} />Redactar con IA</button>
          <button className="btn" style={{ background:"#fff", boxShadow:"0 1px 3px rgba(20,20,26,.08)" }} onClick={startUpload}><Upload size={15} />Subir documento</button>
        </div>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="doclist-head">
          <div>Nombre</div>
          <div>Área</div>
          <div>Fecha</div>
          <div></div>
        </div>
        <div className="doclist">
          {filtered.length === 0 ? (
            <div className="dempty" style={{ padding: "28px 0", textAlign: "center" }}>No hay documentos en esta categoría.</div>
          ) : filtered.map((d, i) => (
            <DocCard key={d.id} d={d} index={i} onShare={setShareDoc} onEdit={setEditDoc} onDelete={deleteDoc} />
          ))}
        </div>
      </div>
      <AIComposer open={aiOpen} onClose={() => setAiOpen(false)} notify={notify} />
      <ShareModal open={!!shareDoc} name={shareDoc} onClose={() => setShareDoc(null)} notify={notify} />
      <EditDocModal doc={editDoc} onClose={() => setEditDoc(null)} onSave={updateDoc} />
      {uploads.length > 0 && (
        <div className="upwrap">
          {uploads.map((u) => <UploadCard key={u.id} u={u} onCancel={cancelUpload} />)}
        </div>
      )}
    </>
  );
}

function Consultoria({ notify, onSchedule, consultaMeetings = [] }) {
  const [consultas, setConsultas] = useState(CONSULTAS);
  const [addOpen, setAddOpen] = useState(false);
  const [tema, setTema] = useState("");
  const [quien, setQuien] = useState(EMPLEADOS[0].name);
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedForm, setSchedForm] = useState({ titulo: "Sesión de consultoría laboral", fecha: "25", hora: "10:00", dur: "1 h", asesor: "Asesor laboral externo" });

  const pendientes = consultas.filter(c => c.st === "Agendada" || c.st === "En curso").length;
  const resueltas = consultas.filter(c => c.st === "Resuelta").length;

  const addConsulta = () => {
    if (!tema.trim()) return;
    const id = `CON-0${consultas.length + 1}`;
    setConsultas(cs => [{ id, tema, quien, consultor: "Asesor laboral", date: "21 jun 2026", st: "Agendada" }, ...cs]);
    notify("Consulta registrada", "ok");
    setAddOpen(false); setTema("");
  };
  const advanceSt = (id) => {
    setConsultas(cs => cs.map(c => {
      if (c.id !== id) return c;
      const next = { "Agendada": "En curso", "En curso": "Resuelta" };
      return { ...c, st: next[c.st] || c.st };
    }));
  };
  const agendar = () => {
    if (!schedForm.titulo.trim()) return;
    onSchedule && onSchedule(schedForm);
    notify("Sesión agendada — revisa el Calendario", "ok");
    setSchedOpen(false);
    setSchedForm({ titulo: "Sesión de consultoría laboral", fecha: "25", hora: "10:00", dur: "1 h", asesor: "Asesor laboral externo" });
  };

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={MessageSquare} tone="blu" label="Consultas totales" value={consultas.length} /></div>
        <div className="rise d2"><Stat ico={Clock} tone="amb" label="Pendientes / En curso" value={pendientes} /></div>
        <div className="rise d3"><Stat ico={Check} tone="grn" label="Resueltas" value={resueltas} /></div>
        <div className="rise d4"><Stat ico={Calendar} tone="vio" label="Sesiones en calendario" value={consultaMeetings.length} /></div>
      </div>
      <div className="g2">
        <div className="card rise d1">
          <div className="chead">
            <div className="ctitle">Solicitudes de consultoría</div>
            <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nueva consulta</button>
          </div>
          <table className="tbl">
            <thead><tr><th>Tema</th><th>Solicitante</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {consultas.map(c => (
                <tr className="trow" key={c.id}>
                  <td><div className="cename">{c.tema}</div><div className="ceid mono">{c.id} · {c.date}</div></td>
                  <td className="muted">{c.quien}</td>
                  <td><Badge st={c.st} /></td>
                  <td style={{ textAlign: "right" }}>
                    {c.st !== "Resuelta" && (
                      <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => advanceSt(c.id)}>
                        {c.st === "Agendada" ? "Iniciar" : "Resolver"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card cpad rise d2" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="ctitle">Asesoría laboral</div>
            <Badge st="Activo" />
          </div>
          <p style={{ color: "var(--ink2)", fontSize: 13.5, margin: 0, lineHeight: 1.55 }}>
            Acompañamiento en contratación, cumplimiento y normativa laboral colombiana. Respuesta dentro de 24 horas hábiles.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, borderTop: "1px solid var(--line2)", paddingTop: 14 }}>
            <div><div className="kvs">Tiempo de respuesta</div><div style={{ fontWeight: 800, fontSize: 16, marginTop: 3, letterSpacing: "-.04em" }}>24 h hábiles</div></div>
            <div><div className="kvs">Consultas este mes</div><div style={{ fontWeight: 800, fontSize: 16, marginTop: 3, letterSpacing: "-.04em" }}>{consultas.length}</div></div>
          </div>
          {consultaMeetings.length > 0 && (
            <>
              <div className="dsect" style={{ margin: "0" }}>Sesiones agendadas</div>
              {consultaMeetings.slice(0, 3).map(m => (
                <div className="elrow" key={m.id}>
                  <div><div className="eltxt">{m.title}</div><div className="elsub">{m.day} jun · {m.time} · {m.dur}</div></div>
                  <Badge st="Agendada" />
                </div>
              ))}
            </>
          )}
          <button className="btn pri" style={{ justifyContent: "center", marginTop: "auto" }} onClick={() => setSchedOpen(true)}><CalendarClock size={15} />Agendar sesión</button>
        </div>
      </div>
      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nueva consulta</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Tema</div>
              <input className="field" value={tema} onChange={e => setTema(e.target.value)} placeholder="Ej. Revisión de contrato laboral" />
              <div className="flabel">Solicitante</div>
              <select className="field" value={quien} onChange={e => setQuien(e.target.value)}>
                {EMPLEADOS.map(e => <option key={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="mfoot"><span /><div style={{ display: "flex", gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addConsulta}>Registrar</button>
            </div></div>
          </div>
        </div>
      )}
      {schedOpen && (
        <div className="mwrap" onClick={() => setSchedOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Agendar sesión</div><button className="ibtn" onClick={() => setSchedOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Título de la sesión</div>
              <input className="field" value={schedForm.titulo} onChange={e => setSchedForm(f => ({ ...f, titulo: e.target.value }))} />
              <div className="flabel">Día (junio 2026)</div>
              <input className="field" type="number" min="22" max="30" value={schedForm.fecha} onChange={e => setSchedForm(f => ({ ...f, fecha: e.target.value }))} />
              <div className="flabel">Hora</div>
              <input className="field" value={schedForm.hora} onChange={e => setSchedForm(f => ({ ...f, hora: e.target.value }))} placeholder="10:00" />
              <div className="flabel">Duración</div>
              <select className="field" value={schedForm.dur} onChange={e => setSchedForm(f => ({ ...f, dur: e.target.value }))}>
                {["30 min","1 h","1 h 30 min","2 h"].map(d => <option key={d}>{d}</option>)}
              </select>
              <div className="flabel">Asesor</div>
              <input className="field" value={schedForm.asesor} onChange={e => setSchedForm(f => ({ ...f, asesor: e.target.value }))} />
            </div>
            <div className="mfoot"><span /><div style={{ display: "flex", gap: 9 }}>
              <button className="btn" onClick={() => setSchedOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={agendar}><CalendarClock size={14} />Agendar</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  );
}

const COLDOT = { Abierto: "#9494a0", "En proceso": "#bf8410", Resuelto: "#1f9d63" };
const descOf = (t) => `${t.quien} solicita: ${t.asunto.toLowerCase()}. Pendiente de gestión por el equipo de ${t.area}.`;
const aiSugOf = (t) => `Clasificado automáticamente para el área de ${t.area}. Prioridad sugerida: ${t.prio}. Tiempo de respuesta estimado: 5 h.`;

function TicketCard({ t, onOpen }) {
  return (
    <div className="tkcard" onClick={() => onOpen(t.id)}>
      <div className="tktop">
        <span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: AREA[t.area] }} />{t.area}
        </span>
        <Prio prio={t.prio} />
      </div>
      <div className="tkas">{t.asunto}{t.ai && <Sparkles size={13} style={{ color: "var(--red)", flexShrink: 0, marginTop: 2 }} />}</div>
      <div className="ceid mono" style={{ marginTop: 4 }}>{t.id}</div>
      <div className="tkmeta">
        <span className="tkwho"><Avatar name={t.quien} size={22} />{t.quien.split(" ")[0]}</span>
        <span className="tltime mono">{t.t}</span>
      </div>
    </div>
  );
}

function TicketDrawer({ t, onClose, onStatus, onUpdate, onDelete, notify }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  useEffect(() => { if (t) { setForm({ asunto: t.asunto, area: t.area, prio: t.prio }); setEditing(false); } }, [t && t.id]);
  if (!t || !form) return null;
  const trans = t.st === "Abierto" ? { label: "Tomar ticket", to: "En proceso" }
    : t.st === "En proceso" ? { label: "Marcar como resuelto", to: "Resuelto" }
    : { label: "Reabrir ticket", to: "Abierto" };
  let acts = [{ txt: `${t.quien} creó el ticket` }];
  if (t.st !== "Abierto") acts.push({ txt: `Asignado al equipo de ${t.area}` });
  if (t.st === "Resuelto") acts.push({ txt: "Resuelto y cerrado" });
  acts = acts.reverse();
  const [g1, g2] = AREA_GRAD[t.area] || ["#a6a6b2", "#6b6b76"];
  const save = () => { onUpdate(t.id, form); setEditing(false); };
  return (
    <>
      <div className="ovl" onClick={onClose} />
      <aside className="drawer">
        <div className="dhead tkhead">
          <div className="kglow" style={{ background: g1 }} />
          <div className="dmark" style={{ background: `linear-gradient(145deg,${g1},${g2})`, boxShadow: `0 8px 18px -8px ${g2}99` }}>
            <Ticket size={19} color="#fff" />
          </div>
          <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
            <div className="dh-t mono">{t.id}</div>
            <div className="dh-s">{t.area} · creado {t.t}</div>
          </div>
          <button className="ibtn" onClick={onClose} style={{ position: "relative", zIndex: 1 }}><X size={18} /></button>
        </div>
        <div className="dbody">
          {editing ? (
            <>
              <div className="flabel" style={{ marginTop: 0 }}>Asunto</div>
              <input className="field" value={form.asunto} onChange={(ev) => setForm((f) => ({ ...f, asunto: ev.target.value }))} />
              <div className="flabel">Área</div>
              <div className="chips">{ATAGS.map((a) => <button key={a} className={`chip ${form.area === a ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, area: a }))}>{a}</button>)}</div>
              <div className="flabel">Prioridad</div>
              <div className="chips">{["Alta", "Media", "Baja"].map((p) => <button key={p} className={`chip ${form.prio === p ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, prio: p }))}>{p}</button>)}</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.04em" }}>{t.asunto}</div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                <Badge st={t.st} />
                <Prio prio={t.prio} />
              </div>
              <div className="treq">
                <Avatar name={t.quien} size={24} />
                <span><b>{t.quien}</b> · equipo de</span>
                <span className="treqarea">
                  <span className="areadot" style={{ background: AREA[t.area] }} />{t.area}
                </span>
              </div>

              <div className="dsect">Sugerencia IA</div>
              <div className="aibox">
                <div className="kglow" />
                <div className="aii"><Sparkles size={16} /></div>
                <div><div className="at">Acción recomendada</div><div className="ad">{aiSugOf(t)}</div></div>
              </div>

              <div className="dsect">Descripción</div>
              <p style={{ fontSize: 13.5, color: "var(--ink2)", margin: 0, lineHeight: 1.55 }}>{descOf(t)}</p>

              <div className="dsect">Actividad</div>
              <div>
                {acts.map((a, i) => (
                  <div className={`tli ${i === acts.length - 1 ? "last" : ""}`} key={i}>
                    <div className="tlrail"><div className={`tlnode ${i === 0 ? "red" : ""}`} /></div>
                    <div className="tlbody"><div className="tltxt">{a.txt}</div></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="dacts">
          {editing ? (
            <>
              <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => setEditing(false)}>Cancelar</button>
              <button className="btn dark" style={{ flex: 1, justifyContent: "center" }} onClick={save}><Check size={15} />Guardar</button>
            </>
          ) : (
            <>
              <button className="btn pri" style={{ flex: 1, justifyContent: "center" }} onClick={() => onStatus(t.id, trans.to)}>{trans.label}</button>
              <button className="btn" onClick={() => setEditing(true)}><PenLine size={15} /></button>
              <button className="ibtn" style={{ color: "var(--redd)", borderColor: "#f7cbcb" }} title="Eliminar ticket" onClick={() => onDelete(t.id)}><Trash2 size={17} /></button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

const ATAGS = ["TI", "Nómina", "Personas", "Finanzas", "Legal"];

function NewTicketModal({ open, onClose, onCreate }) {
  const [tipo, setTipo] = useState("Solicitud");
  const [asunto, setAsunto] = useState("");
  const [area, setArea] = useState("TI");
  const [prio, setPrio] = useState("Media");
  const [err, setErr] = useState(false);
  useEffect(() => { if (open) { setTipo("Solicitud"); setAsunto(""); setArea("TI"); setPrio("Media"); setErr(false); } }, [open]);
  if (!open) return null;
  const crear = () => {
    if (!asunto.trim()) { setErr(true); return; }
    onCreate({ asunto: asunto.trim(), area, prio, tipo });
    onClose();
  };
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Nuevo ticket</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="optgrid">
            {[["Solicitud", "Petición o trámite"], ["Incidencia", "Reporte de un problema"]].map(([t, d]) => (
              <div key={t} className={`optcard ${tipo === t ? "on" : ""}`} onClick={() => setTipo(t)}>
                <div className="optcheck"><Check size={12} /></div>
                <div className="ot">{t}</div><div className="od">{d}</div>
              </div>
            ))}
          </div>
          <div className="flabel">Asunto</div>
          <input className="field" placeholder="Describe brevemente el ticket…" value={asunto}
            onChange={(e) => { setAsunto(e.target.value); setErr(false); }} />
          {err && <div className="errline"><AlertCircle size={14} />Escribe un asunto para continuar.</div>}
          <div className="flabel">Área</div>
          <div className="chips">
            {ATAGS.map((a) => (
              <button key={a} className={`chip ${area === a ? "on" : ""}`} onClick={() => setArea(a)}>
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: AREA[a], marginRight: 7, verticalAlign: "middle" }} />{a}
              </button>
            ))}
          </div>
          <div className="flabel">Prioridad</div>
          <div className="chips" style={{ marginBottom: 4 }}>
            {["Alta", "Media", "Baja"].map((p) => (
              <button key={p} className={`chip ${prio === p ? "on" : ""}`} onClick={() => setPrio(p)}>{p}</button>
            ))}
          </div>
        </div>
        <div className="mfoot">
          <span />
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn pri" onClick={crear}>Crear ticket</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tickets({ notify }) {
  const [items, setItems] = useState(TICKETS);
  const [area, setArea] = useState("Todos");
  const [mode, setMode] = useState("board");
  const [sel, setSel] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const nextId = useRef(1288);
  const areas = ["Todos", "TI", "Nómina", "Personas", "Finanzas", "Legal"];
  const cols = ["Abierto", "En proceso", "Resuelto"];
  const rows = items.filter((t) => area === "Todos" || t.area === area);
  const count = (st) => items.filter((t) => t.st === st).length;
  const setStatus = (id, to, silent) => {
    const prev = items.find((x) => x.id === id)?.st;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, st: to } : x)));
    setSel(null);
    if (!silent) notify(`Estado actualizado: ${to}`, to === "Resuelto" ? "ok" : "info", "Deshacer", () => setStatus(id, prev, true));
  };
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null); // col id
  const [dropIdx, setDropIdx] = useState(null);   // index within col

  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      document.querySelector(`[data-tkid="${id}"]`)?.classList.add("is-dragging");
    }, 0);
  };

  // Calculate drop index from mouse Y position over a card element
  const getDropIdx = (e, cardEls, col) => {
    const colCards = items.filter(t => t.st === col && (area === "Todos" || t.area === area));
    for (let i = 0; i < cardEls.length; i++) {
      const rect = cardEls[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) return i;
    }
    return colCards.length;
  };

  const onColDragOver = (e, col) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(col);
    const cardEls = [...e.currentTarget.querySelectorAll("[data-tkid]")];
    setDropIdx(getDropIdx(e, cardEls, col));
  };

  const onDragLeave = (e) => {
    // only clear when leaving the column entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(null); setDropIdx(null);
    }
  };

  const onDrop = (e, col) => {
    e.preventDefault();
    if (!dragId) { setDragOver(null); setDropIdx(null); return; }
    const dragged = items.find(x => x.id === dragId);
    if (!dragged) { setDragId(null); setDragOver(null); setDropIdx(null); return; }

    // build new items array with card inserted at exact position
    const withoutDragged = items.filter(x => x.id !== dragId);
    const colItems = withoutDragged.filter(x => x.st === col);
    const otherItems = withoutDragged.filter(x => x.st !== col);
    const insertAt = Math.min(dropIdx ?? colItems.length, colItems.length);
    const updated = { ...dragged, st: col };
    colItems.splice(insertAt, 0, updated);
    setItems([...otherItems, ...colItems]);

    const prevSt = dragged.st;
    if (prevSt !== col) {
      notify(`Movido a ${col}`, col === "Resuelto" ? "ok" : "info",
        "Deshacer", () => setItems(prev => {
          const w = prev.filter(x => x.id !== dragId);
          return [...w, { ...prev.find(x => x.id === dragId) || dragged, st: prevSt }];
        }));
    }

    // animate card entering
    setTimeout(() => {
      const el = document.querySelector(`[data-tkid="${dragId}"]`);
      if (el) {
        el.classList.remove("card-enter"); void el.offsetWidth;
        el.classList.add("card-enter");
        el.addEventListener("animationend", () => el.classList.remove("card-enter"), { once: true });
      }
    }, 20);

    setDragId(null); setDragOver(null); setDropIdx(null);
  };

  const onDragEnd = () => {
    document.querySelectorAll(".tkcard.is-dragging").forEach(el => el.classList.remove("is-dragging"));
    setDragId(null); setDragOver(null); setDropIdx(null);
  };
  const updateTicket = (id, patch) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    notify("Ticket actualizado", "ok");
  };
  const deleteTicket = (id) => {
    const removed = items.find((x) => x.id === id);
    setItems((xs) => xs.filter((x) => x.id !== id));
    setSel(null);
    notify(`Ticket ${id} eliminado`, "info", "Deshacer", () => setItems((xs) => [removed, ...xs]));
  };
  const addTicket = (d) => {
    const id = `TK-${nextId.current++}`;
    setItems((xs) => [{ id, asunto: d.asunto, area: d.area, prio: d.prio, quien: "Camila Restrepo", t: "ahora", ai: false, st: "Abierto" }, ...xs]);
    notify(`Ticket creado: ${id}`, "ok");
  };
  const selected = items.find((t) => t.id === sel) || null;
  const exportRows = () => {
    exportExcel(rows.map((t) => ({ ID: t.id, Asunto: t.asunto, Área: t.area, Solicitante: t.quien, Prioridad: t.prio, Estado: t.st, Creado: t.t })), "tickets-whitebox");
    notify("Excel exportado", "ok");
  };
  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={Ticket} tone="amb" label="Abiertos" value={count("Abierto")} /></div>
        <div className="rise d2"><Stat ico={Clock} tone="blu" label="En proceso" value={count("En proceso")} /></div>
        <div className="rise d3"><Stat ico={Check} tone="grn" label="Resueltos" value={count("Resuelto")} /></div>
        <div className="rise d4"><Stat ico={Activity} tone="vio" label="Tiempo medio" value="5.2 h" sub="primera respuesta" /></div>
      </div>

      {/* toolbar — sin card wrapper, limpio */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div className="chips">
          {areas.map((a) => (
            <button key={a} className={`chip ${area === a ? "on" : ""}`} onClick={() => setArea(a)}>
              {a !== "Todos" && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: AREA[a], marginRight: 5, verticalAlign: "middle" }} />}
              {a}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="seg">
            <button className={mode === "board" ? "on" : ""} onClick={() => setMode("board")}><LayoutGrid size={14} />Tablero</button>
            <button className={mode === "list" ? "on" : ""} onClick={() => setMode("list")}><List size={14} />Lista</button>
          </div>
          <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nuevo ticket</button>
          <button className="btn" onClick={exportRows} title="Exportar"><FileSpreadsheet size={15} /></button>
        </div>
      </div>

      {mode === "board" ? (
        <div className="board">
          {cols.map((c) => {
            const cards = rows.filter((t) => t.st === c);
            const isOver = dragOver === c;
            return (
              <div className={`col${isOver ? " drag-over" : ""}`} key={c}
                onDragOver={e => onColDragOver(e, c)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, c)}>
                <div className="colh">
                  <span className="cdot" style={{ background: COLDOT[c] }} />
                  {c}
                  <span className="cn">{cards.length}</span>
                </div>
                <div className="col-cards">
                  {/* line before first card */}
                  {isOver && dropIdx === 0 && <div className="drop-line" key="dl-0" />}
                  {cards.length === 0 && !isOver && <div className="colempty">Sin tickets</div>}
                  {cards.length === 0 && isOver && <div className="colempty" style={{ opacity: .4 }}>Soltar aquí</div>}
                  {cards.map((t, idx) => (
                    <React.Fragment key={t.id}>
                      <div data-tkid={t.id} draggable
                        onDragStart={e => onDragStart(e, t.id)}
                        onDragEnd={onDragEnd}>
                        <TicketCard t={t} onOpen={setSel} />
                      </div>
                      {isOver && dropIdx === idx + 1 && <div className="drop-line" key={`dl-${idx+1}`} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card rise d2">
          <table className="tbl">
            <thead><tr><th>Ticket</th><th>Solicitante</th><th>Área</th><th>Prioridad</th><th>Estado</th><th>Tiempo</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6}><div className="dempty" style={{ padding: "22px 0", textAlign: "center" }}>No hay tickets.</div></td></tr>
              ) : rows.map((t) => (
                <tr className="trow" key={t.id} style={{ cursor: "pointer" }} onClick={() => setSel(t.id)}>
                  <td><div className="cename" style={{ display: "flex", alignItems: "center", gap: 7 }}>{t.asunto}{t.ai && <Sparkles size={13} style={{ color: "var(--red)" }} />}</div><div className="ceid mono">{t.id}</div></td>
                  <td className="muted">{t.quien}</td>
                  <td><span className="tag" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: AREA[t.area] }} />{t.area}</span></td>
                  <td><Prio prio={t.prio} /></td>
                  <td><Badge st={t.st} /></td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{t.t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TicketDrawer t={selected} onClose={() => setSel(null)} onStatus={setStatus} onUpdate={updateTicket} onDelete={deleteTicket} notify={notify} />
      <NewTicketModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={addTicket} />
    </>
  );

function NewMeetingModal({ open, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Entrevista");
  const [day, setDay] = useState(22);
  const [time, setTime] = useState("10:00");
  const [withWhom, setWithWhom] = useState("");
  useEffect(() => { if (open) { setTitle(""); setType("Entrevista"); setDay(22); setTime("10:00"); setWithWhom(""); } }, [open]);
  if (!open) return null;
  const types = ["Entrevista", "Onboarding", "1:1", "Consultoría"];
  const create = () => {
    if (!title.trim()) return;
    onCreate({ title, type, day: Math.min(30, Math.max(1, Number(day) || 1)), time, dur: "30 min", with: withWhom.trim() || "Por confirmar", loc: "Virtual · Meet" });
  };
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Agendar reunión</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Título</div>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Entrevista — Backend Senior" />
          <div className="flabel">Tipo</div>
          <div className="chips">{types.map((t) => <button key={t} className={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>{t}</button>)}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Día (junio)</div>
              <input className="field" type="number" min="1" max="30" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Hora</div>
              <input className="field" value={time} onChange={(e) => setTime(e.target.value)} placeholder="10:00" />
            </div>
          </div>
          <div className="flabel">Con quién</div>
          <input className="field" value={withWhom} onChange={(e) => setWithWhom(e.target.value)} placeholder="Nombre" />
        </div>
        <div className="mfoot">
          <span />
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn dark" onClick={create}>Agendar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Calendario({ notify, meetings, setMeetings }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState(null);
  const today = 21;
  const cells = Array.from({ length: 35 }, (_, i) => (i + 1 <= 30 ? i + 1 : null));
  const byDay = (d) => meetings.filter((m) => m.day === d);
  const upcoming = meetings.filter((m) => m.day >= today).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
  const addMeeting = (d) => {
    const id = `M-${meetings.length + 1}`;
    setMeetings((m) => [...m, { id, ...d }]);
    notify("Reunión agendada", "ok");
    setAddOpen(false);
  };
  const updateMeeting = (id, patch) => {
    setMeetings(ms => ms.map(m => m.id === id ? { ...m, ...patch } : m));
    notify("Reunión actualizada", "ok");
    setEditMeeting(null);
  };
  const deleteMeeting = (id) => {
    const removed = meetings.find(m => m.id === id);
    setMeetings(ms => ms.filter(m => m.id !== id));
    notify(`Reunión eliminada`, "info", "Deshacer", () => setMeetings(ms => [...ms, removed]));
  };
  return (
    <div className="g2 calgrid">
      <div className="card cpad rise d1">
        <div className="calhead">
          <button className="ibtn" disabled><ChevronLeft size={16} /></button>
          <div className="ctitle">Junio 2026</div>
          <button className="ibtn" disabled><ChevronRight size={16} /></button>
        </div>
        <div className="calgridwrap">
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => <div className="caldow" key={d}>{d}</div>)}
          {cells.map((d, i) => (
            <div key={i} className={`calcell ${d === today ? "today" : ""} ${!d ? "empty" : ""}`}>
              {d && (
                <>
                  <span className="caldnum">{d}</span>
                  <div className="caldots">
                    {byDay(d).slice(0, 4).map((m) => <span key={m.id} className={`caldot ${MEET_TONE[m.type]}`} />)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="card cpad rise d2">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="ctitle">Próximas reuniones</div>
          <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={14} />Agendar</button>
        </div>
        {upcoming.length === 0 ? <div className="dempty">No hay reuniones próximas.</div> : upcoming.map((m) => (
          <div className="meetrow" key={m.id}>
            <div className={`meetdate ${MEET_TONE[m.type]}`}><div className="meetday">{m.day}</div><div className="meetmon">Jun</div></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eltxt">{m.title}</div>
              <div className="elsub">{m.time} · {m.dur} · {m.with}</div>
            </div>
            <span className={`badge b-${MEET_TONE[m.type]}`}>{m.type}</span>
            <button className="ibtn" style={{ width: 28, height: 28, flexShrink: 0 }} data-tip="Editar" onClick={() => setEditMeeting(m)}>
              <PenLine size={13} />
            </button>
            <button className="ibtn" style={{ width: 28, height: 28, flexShrink: 0 }} data-tip="Eliminar" onClick={() => deleteMeeting(m.id)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <NewMeetingModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={addMeeting} />
      {editMeeting && (
        <div className="mwrap" onClick={() => setEditMeeting(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Editar reunión</div><button className="ibtn" onClick={() => setEditMeeting(null)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Título</div>
              <input className="field" value={editMeeting.title} onChange={e => setEditMeeting(m => ({ ...m, title: e.target.value }))} />
              <div className="flabel">Hora</div>
              <input className="field" value={editMeeting.time} onChange={e => setEditMeeting(m => ({ ...m, time: e.target.value }))} />
              <div className="flabel">Duración</div>
              <input className="field" value={editMeeting.dur} onChange={e => setEditMeeting(m => ({ ...m, dur: e.target.value }))} />
              <div className="flabel">Con quien</div>
              <input className="field" value={editMeeting.with} onChange={e => setEditMeeting(m => ({ ...m, with: e.target.value }))} />
            </div>
            <div className="mfoot">
              <button className="btn" style={{ color: "var(--redd)" }} onClick={() => { deleteMeeting(editMeeting.id); }}>Eliminar</button>
              <div style={{ display: "flex", gap: 9 }}>
                <button className="btn" onClick={() => setEditMeeting(null)}>Cancelar</button>
                <button className="btn dark" onClick={() => updateMeeting(editMeeting.id, editMeeting)}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Asistencia({ notify }) {
  const [ausencias, setAusencias] = useState(AUSENCIAS);
  const [vacaciones, setVacaciones] = useState(VACACIONES);
  const [addOpen, setAddOpen] = useState(false);
  const [empSel, setEmpSel] = useState(EMPLEADOS[0].name);
  const [tipo, setTipo] = useState("Vacaciones");
  const [desde, setDesde] = useState("2026-06-24");
  const [hasta, setHasta] = useState("2026-06-30");

  const activas = ausencias.filter(a => a.st === "Activa").length;
  const incapacidades = ausencias.filter(a => a.tipo === "Incapacidad").length;
  const vacPendientes = vacaciones.reduce((s, v) => s + v.disponibles, 0);
  const horasExtra = 142;

  const addAusencia = () => {
    const d1 = new Date(desde), d2 = new Date(hasta);
    const dias = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
    const id = `AUS-${(ausencias.length + 1).toString().padStart(2, "0")}`;
    setAusencias(a => [{ id, name: empSel, tipo, desde, hasta, dias, st: "Activa" }, ...a]);
    if (tipo === "Vacaciones") {
      setVacaciones(v => v.map(x => x.name === empSel
        ? { ...x, disponibles: Math.max(0, x.disponibles - dias), tomados: x.tomados + dias }
        : x));
    }
    notify(`Ausencia registrada para ${empSel.split(" ")[0]}`, "ok");
    setAddOpen(false);
  };

  const resolveAusencia = (id) => {
    setAusencias(a => a.map(x => x.id === id ? { ...x, st: "Resuelta" } : x));
    notify("Ausencia marcada como resuelta", "ok");
  };

  const deleteAusencia = (id) => {
    const a = ausencias.find(x => x.id === id);
    setAusencias(as => as.filter(x => x.id !== id));
    notify("Ausencia eliminada", "ok", "Deshacer", () => setAusencias(as => [a, ...as]));
  };

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={UserMinus} tone="amb" label="Ausencias activas" value={activas} /></div>
        <div className="rise d2"><Stat ico={AlertCircle} tone="red" label="Incapacidades" value={incapacidades} /></div>
        <div className="rise d3"><Stat ico={Clock} tone="vio" label="Horas extra (mes)" value={horasExtra} /></div>
        <div className="rise d4"><Stat ico={Calendar} tone="grn" label="Vacaciones pendientes" value={`${vacPendientes} días`} /></div>
      </div>
      <div className="g2">
        <div className="card rise d2">
          <div className="chead">
            <div className="ctitle">Registro de ausencias</div>
            <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={14} />Registrar</button>
          </div>
          <table className="tbl">
            <thead><tr><th>Empleado</th><th>Tipo</th><th>Desde</th><th>Días</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {ausencias.map(a => (
                <tr className="trow" key={a.id}>
                  <td><div className="cemp"><Avatar name={a.name} size={26} /><div className="cename">{a.name}</div></div></td>
                  <td className="muted">{a.tipo}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{a.desde}</td>
                  <td className="muted">{a.dias}d</td>
                  <td><Badge st={a.st} /></td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                      {a.st === "Activa" && (
                        <button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => resolveAusencia(a.id)}><Check size={13} />Resolver</button>
                      )}
                      <button className="ibtn" style={{ width: 30, height: 30 }} data-tip="Eliminar" onClick={() => deleteAusencia(a.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card cpad rise d3">
          <div className="ctitle" style={{ marginBottom: 12 }}>Vacaciones por persona</div>
          {vacaciones.map(v => {
            const tot = v.disponibles + v.tomados;
            return (
              <div className="elrow" key={v.name}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div className="eltxt">{v.name}</div>
                    <div className="elsub">{v.disponibles}d disp.</div>
                  </div>
                  <div className="bartrack"><div className="barfill grn" style={{ width: `${tot ? (v.tomados / tot) * 100 : 0}%` }} /></div>
                  <div className="elsub" style={{ marginTop: 4 }}>{v.tomados}/{tot} días tomados</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Heatmap de ausentismo — Junio 2026</div>
          <div className="heatlegend">
            {[["l0","Sin ausencias"],["l1","1"],["l2","2"],["l3","3-4"],["l4","5+"]].map(([cls,lbl]) => (
              <span key={cls} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span className={`heatcell ${cls}`} style={{ width: 14, height: 14, borderRadius: 3 }} />
                <span className="elsub">{lbl}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="heatwrap cpad">
          <div className="heatdows">{["L","M","X","J","V","S","D"].map(d => <div key={d} className="heatdow">{d}</div>)}</div>
          <div className="heatgrid">
            {Array.from({ length: 35 }, (_, i) => {
              const day = i + 1;
              if (day > 30) return <div key={i} className="heatcell e" />;
              const count = HEATMAP_JUNE[day - 1] || 0;
              const level = count === 0 ? "l0" : count === 1 ? "l1" : count === 2 ? "l2" : count <= 4 ? "l3" : "l4";
              return <div key={i} className={`heatcell ${level}`} title={`${day} jun · ${count} ausencia${count !== 1 ? "s" : ""}`}>{day}</div>;
            })}
          </div>
        </div>
      </div>
      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Registrar ausencia</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Empleado</div>
              <select className="field" value={empSel} onChange={e => setEmpSel(e.target.value)}>
                {EMPLEADOS.map(e => <option key={e.id}>{e.name}</option>)}
              </select>
              <div className="flabel">Tipo de ausencia</div>
              <select className="field" value={tipo} onChange={e => setTipo(e.target.value)}>
                {["Vacaciones","Incapacidad","Permiso","Licencia","Otro"].map(t => <option key={t}>{t}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><div className="flabel">Desde</div><input className="field" type="date" value={desde} onChange={e => setDesde(e.target.value)} /></div>
                <div><div className="flabel">Hasta</div><input className="field" type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></div>
              </div>
            </div>
            <div className="mfoot"><span /><div style={{ display: "flex", gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addAusencia}>Registrar ausencia</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  );
}

function Nomina({ notify }) {
  const total = NOMINA_AREA.reduce((s, a) => s + a.costo, 0);
  const personas = NOMINA_AREA.reduce((s, a) => s + a.personas, 0);
  const promedio = Math.round(total / personas);
  const variacion = (((NOMINA_HIST[5] - NOMINA_HIST[4]) / NOMINA_HIST[4]) * 100).toFixed(1);
  const beneficiosTotal = BENEFICIOS.reduce((s, b) => s + b.costoMes, 0);
  const exportNomina = () => {
    exportExcel(NOMINA_AREA.map((a) => ({ Área: a.area, Personas: a.personas, "Costo mensual": a.costo })), "nomina-whitebox");
    notify("Excel exportado", "ok");
  };

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={Wallet} tone="grn" label="Costo total de nómina" value={cop(total)} sub="mensual" /></div>
        <div className="rise d2"><Stat ico={Users} tone="blu" label="Costo promedio" value={cop(promedio)} sub="por persona" /></div>
        <div className="rise d3"><Stat ico={ShieldCheck} tone="vio" label="Beneficios otorgados" value={cop(beneficiosTotal)} sub="mensual" /></div>
        <div className="rise d4"><Stat ico={variacion >= 0 ? TrendingUp : TrendingDown} tone={variacion >= 0 ? "amb" : "grn"} label="Variación mensual" value={`${variacion > 0 ? "+" : ""}${variacion}%`} /></div>
      </div>
      <div className="g2">
        <div className="card rise d2">
          <div className="chead"><div className="ctitle">Evolución de nómina</div><span className="range">Últimos 6 meses</span></div>
          <div className="cpad" style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={NOMINA_HIST.map((v, i) => ({ m: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"][i], v }))} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f9d63" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#1f9d63" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f1f3" />
                <XAxis dataKey="m" tickLine={false} axisLine={false} dy={8} tick={{ fill: "#9494a0", fontSize: 12, fontWeight: 600 }} />
                <YAxis tickLine={false} axisLine={false} width={32} tick={{ fill: "#b6b6bd", fontSize: 11 }} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: "#e6e6ea", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="v" stroke="#1f9d63" strokeWidth={2.4} fill="url(#gN)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card cpad rise d3">
          <div className="ctitle" style={{ marginBottom: 14 }}>Beneficios</div>
          {BENEFICIOS.map((b) => (
            <div className="elrow" key={b.nombre}>
              <div><div className="eltxt">{b.nombre}</div><div className="elsub">{b.cobertura}</div></div>
              <div className="eltxt">{cop(b.costoMes)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Costo por departamento</div>
          <button className="btn" onClick={exportNomina}><FileSpreadsheet size={15} />Exportar</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Área</th><th>Personas</th><th>Costo mensual</th><th>Costo / persona</th></tr></thead>
          <tbody>
            {NOMINA_AREA.map((a) => (
              <tr className="trow" key={a.area}>
                <td className="cename">{a.area}</td>
                <td className="muted">{a.personas}</td>
                <td className="cename">{cop(a.costo)}</td>
                <td className="muted">{cop(Math.round(a.costo / a.personas))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Capacitacion({ notify }) {
  const [cursos, setCursos] = useState(CURSOS);
  const [certs, setCerts] = useState(CERTIFICACIONES);
  const [assignOpen, setAssignOpen] = useState(null);
  const [empSel, setEmpSel] = useState(EMPLEADOS[0].name);
  const [newCursoOpen, setNewCursoOpen] = useState(false);
  const [newCurso, setNewCurso] = useState({ nombre: "", horas: "8", plataforma: "Interna" });
  const [deleteCursoId, setDeleteCursoId] = useState(null);

  const horasTotal = cursos.reduce((s, c) => s + c.horas * c.completados, 0);
  const completados = cursos.reduce((s, c) => s + c.completados, 0);
  const progresoProm = Math.round(cursos.reduce((s, c) => s + (c.completados / c.inscritos) * 100, 0) / cursos.length);

  const addCurso = () => {
    if (!newCurso.nombre.trim()) return;
    const id = `C-0${cursos.length + 10}`;
    setCursos(cs => [...cs, { id, nombre: newCurso.nombre, horas: parseInt(newCurso.horas) || 8,
      plataforma: newCurso.plataforma, inscritos: 0, completados: 0, st: "Activo" }]);
    notify(`Curso "${newCurso.nombre}" creado`, "ok");
    setNewCursoOpen(false);
    setNewCurso({ nombre: "", horas: "8", plataforma: "Interna" });
  };
  const deleteCurso = (id) => {
    const c = cursos.find(x => x.id === id);
    setCursos(cs => cs.filter(x => x.id !== id));
    notify(`Curso "${c.nombre}" eliminado`, "info", "Deshacer", () => setCursos(cs => [...cs, c]));
    setDeleteCursoId(null);
  };

  const inscribir = (cursoId) => {
    setCursos(cs => cs.map(c => c.id === cursoId ? { ...c, inscritos: c.inscritos + 1 } : c));
    notify(`${empSel.split(" ")[0]} inscrito al curso`, "ok");
    setAssignOpen(null);
  };
  const registrarAvance = (cursoId) => {
    setCursos(cs => cs.map(c => c.id === cursoId
      ? { ...c, completados: Math.min(c.completados + 1, c.inscritos) }
      : c));
    notify("Avance registrado", "ok");
  };
  const addCert = () => {
    setCerts(cs => [...cs, { name: empSel, cert: "Certificación nueva", fecha: "Jun 2026" }]);
    notify(`Certificación registrada para ${empSel.split(" ")[0]}`, "ok");
  };

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={Check} tone="grn" label="Completados" value={completados} /></div>
        <div className="rise d2"><Stat ico={Clock} tone="blu" label="Horas de formación" value={horasTotal} /></div>
        <div className="rise d3"><Stat ico={Award} tone="vio" label="Certificaciones" value={certs.length} /></div>
        <div className="rise d4"><Stat ico={Target} tone="amb" label="Progreso promedio" value={`${progresoProm}%`} /></div>
      </div>
      <div className="g2">
        <div className="card rise d2">
          <div className="chead">
            <div className="ctitle">Cursos activos</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn pri" onClick={() => setNewCursoOpen(true)}><Plus size={15} />Nuevo curso</button>
              <button className="btn" onClick={() => setAssignOpen("new")}><Users size={14} />Asignar</button>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>Curso</th><th>Horas</th><th>Progreso</th><th></th></tr></thead>
            <tbody>
              {cursos.map(c => (
                <tr className="trow" key={c.id}>
                  <td className="cename">{c.nombre}</td>
                  <td className="muted">{c.horas} h</td>
                  <td style={{ minWidth: 140 }}>
                    <div className="bartrack"><div className="barfill blu" style={{ width: `${(c.completados / c.inscritos) * 100}%` }} /></div>
                    <div className="elsub" style={{ marginTop: 4 }}>{c.completados}/{c.inscritos} completados</div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {c.completados < c.inscritos && (
                      <button className="btn" style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => registrarAvance(c.id)} title="Registrar un empleado como completado">
                        +1
                      </button>
                    )}
                    <button className="ibtn" style={{ width: 30, height: 30 }} data-tip="Eliminar curso" onClick={() => deleteCurso(c.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card rise d3">
          <div className="chead">
            <div className="ctitle">Certificaciones</div>
            <button className="btn" style={{ padding: "6px 11px", fontSize: 12 }} onClick={addCert}><Plus size={13} />Registrar</button>
          </div>
          <div className="cpad">
          {certs.map((c, i) => (
            <div className="elrow" key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={c.name} size={28} />
                <div><div className="eltxt">{c.name}</div><div className="elsub">{c.cert}</div></div>
              </div>
              <div className="elsub">{c.fecha}</div>
            </div>
          ))}
          </div>
        </div>
      </div>
      {assignOpen && (
        <div className="mwrap" onClick={() => setAssignOpen(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Asignar curso</div><button className="ibtn" onClick={() => setAssignOpen(null)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Empleado</div>
              <select className="field" value={empSel} onChange={e => setEmpSel(e.target.value)}>
                {EMPLEADOS.map(e => <option key={e.id}>{e.name}</option>)}
              </select>
              <div className="flabel">Curso</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cursos.map(c => (
                  <button key={c.id} className="btn" style={{ justifyContent: "space-between" }} onClick={() => inscribir(c.id)}>
                    <span>{c.nombre}</span>
                    <span className="elsub">{c.horas} h</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mfoot"><span /><button className="btn" onClick={() => setAssignOpen(null)}>Cancelar</button></div>
          </div>
        </div>
      )}
      {newCursoOpen && (
        <div className="mwrap" onClick={() => setNewCursoOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo curso</div><button className="ibtn" onClick={() => setNewCursoOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre del curso</div>
              <input className="field" placeholder="Ej. Seguridad en obra" value={newCurso.nombre} onChange={e => setNewCurso(c => ({ ...c, nombre: e.target.value }))} />
              <div className="flabel">Plataforma / Proveedor</div>
              <select className="field" value={newCurso.plataforma} onChange={e => setNewCurso(c => ({ ...c, plataforma: e.target.value }))}>
                {["Interna","Coursera","LinkedIn Learning","Udemy","SENA","Otro"].map(p => <option key={p}>{p}</option>)}
              </select>
              <div className="flabel">Duración (horas)</div>
              <input className="field" type="number" min="1" max="200" value={newCurso.horas} onChange={e => setNewCurso(c => ({ ...c, horas: e.target.value }))} />
            </div>
            <div className="mfoot"><span /><div style={{ display: "flex", gap: 9 }}>
              <button className="btn" onClick={() => setNewCursoOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addCurso}>Crear curso</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  );
}

function CentroRiesgos({ notify }) {
  const [riesgos, setRiesgos] = useState(RIESGOS_SEED);
  const [sevFilter, setSevFilter] = useState("Todos");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [addOpen, setAddOpen] = useState(false);
  const [rTipo, setRTipo] = useState("Contractual");
  const [rSev, setRSev] = useState("Media");
  const [rArea, setRArea] = useState("General");
  const [rDetalle, setRDetalle] = useState("");
  const [rAccion, setRAccion] = useState("");

  const altas = riesgos.filter(r => r.sev === "Alta").length;
  const medias = riesgos.filter(r => r.sev === "Media").length;
  const bajas = riesgos.filter(r => r.sev === "Baja").length;
  const gestionados = RIESGOS_SEED.length - riesgos.length;
  const tipos = ["Todos", ...new Set(riesgos.map(r => r.tipo))];
  const filtered = riesgos.filter(r =>
    (sevFilter === "Todos" || r.sev === sevFilter) &&
    (tipoFilter === "Todos" || r.tipo === tipoFilter)
  );

  const resolver = (id) => {
    const r = riesgos.find(x => x.id === id);
    setRiesgos(rs => rs.filter(x => x.id !== id));
    notify(`Riesgo "${r.tipo}" gestionado`, "ok", "Deshacer", () => setRiesgos(rs => [r, ...rs]));
  };

  const addRiesgo = () => {
    if (!rDetalle.trim()) return;
    const id = `R-${(riesgos.length + 10).toString().padStart(2,"0")}`;
    setRiesgos(rs => [{ id, tipo: rTipo, sev: rSev, area: rArea, detalle: rDetalle, accion: rAccion || "Revisar con el equipo responsable" }, ...rs]);
    notify("Riesgo registrado", "ok");
    setAddOpen(false);
    setRDetalle(""); setRAccion("");
  };

  const SEV_ICO = { Alta: AlertCircle, Media: Clock, Baja: Info };

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={ShieldAlert} tone="red" label="Riesgos críticos" value={altas} sub="Alta prioridad" /></div>
        <div className="rise d2"><Stat ico={Clock} tone="amb" label="Riesgos medios" value={medias} sub="Atención pronto" /></div>
        <div className="rise d3"><Stat ico={Info} tone="neu" label="Riesgos bajos" value={bajas} sub="Monitorear" /></div>
        <div className="rise d4"><Stat ico={Check} tone="grn" label="Gestionados" value={gestionados} sub="este ciclo" /></div>
      </div>
      <div className="card rise d2">
        <div className="chead" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="chips">
            {["Todos","Alta","Media","Baja"].map(s => (
              <button key={s} className={`chip ${sevFilter === s ? "on" : ""}`} onClick={() => setSevFilter(s)}>
                {s === "Todos" ? `Todos · ${riesgos.length}` : `${s} · ${riesgos.filter(r => r.sev === s).length}`}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <select className="field" style={{ width: "auto", padding: "6px 10px", fontSize: 12.5 }} value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}>
              {tipos.map(t => <option key={t}>{t}</option>)}
            </select>
            <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={14} />Nuevo riesgo</button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="dempty" style={{ padding: "48px 0", textAlign: "center" }}>
            <Check size={22} style={{ color: "var(--grn)", margin: "0 auto 8px", display: "block" }} />
            No hay riesgos en esta categoría.
          </div>
        ) : (
          <div className="riskgrid">
            {filtered.map(r => {
              const SevIco = SEV_ICO[r.sev] || Info;
              return (
                <div className={`riskcard sev-${r.sev.toLowerCase()}`} key={r.id}>
                  <div className="riskhead">
                    <Badge st={r.sev} />
                    <span className="tag">{r.tipo}</span>
                    <button className="ibtn" style={{ width: 26, height: 26, marginLeft: "auto" }} data-tip="Eliminar" onClick={() => resolver(r.id)}><Trash2 size={13} /></button>
                  </div>
                  {r.empleado && <div className="riskname">{r.empleado}</div>}
                  <div className="riskarea"><SevIco size={13} />{r.area}</div>
                  <div className="riskdetail">{r.detalle}</div>
                  <div className="riskfooter">
                    <div className="riskaction"><Zap size={13} />{r.accion}</div>
                    <button className="btn" style={{ padding: "5px 12px", fontSize: 12, flexShrink: 0 }} onClick={() => resolver(r.id)}>
                      <Check size={13} />Gestionar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo riesgo</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Tipo</div>
                  <select className="field" value={rTipo} onChange={e => setRTipo(e.target.value)}>
                    {["Contractual","Operacional","Cumplimiento","Financiero","Técnico","HSE","Otro"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Severidad</div>
                  <select className="field" value={rSev} onChange={e => setRSev(e.target.value)}>
                    {["Alta","Media","Baja"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flabel">Área afectada</div>
              <input className="field" value={rArea} onChange={e => setRArea(e.target.value)} placeholder="Ej. Interventoría, Energía, Obras" />
              <div className="flabel">Descripción del riesgo</div>
              <textarea className="field" rows={3} style={{ resize: "none" }} value={rDetalle} onChange={e => setRDetalle(e.target.value)} placeholder="Describe el riesgo identificado…" />
              <div className="flabel">Acción recomendada</div>
              <input className="field" value={rAccion} onChange={e => setRAccion(e.target.value)} placeholder="Ej. Revisar contrato con asesor legal" />
            </div>
            <div className="mfoot"><span /><div style={{ display: "flex", gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addRiesgo}>Registrar riesgo</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  );
}

function Trazabilidad({ notify }) {
  const [f, setF] = useState("Todos");
  const chips = ["Todos", "Firma", "Ticket", "Inventario", "Documento", "Empleado", "IA"];
  const exportLog = () => {
    const rows = EVENTOS.flatMap((grp) => grp.items.filter((e) => f === "Todos" || e.type === f)
      .map((e) => ({ Fecha: grp.g, Hora: e.t, Quién: e.who, Acción: `${e.act} ${e.obj}`, Tipo: e.type })));
    exportExcel(rows, "trazabilidad-whitebox");
    notify("Excel exportado", "ok");
  };
  return (
    <div className="card rise d1">
      <div className="chead">
        <div className="chips">
          {chips.map((c) => (
            <button key={c} className={`chip ${f === c ? "on" : ""}`} onClick={() => setF(c)}>{c}</button>
          ))}
        </div>
        <button className="btn" data-tip="Exportar a Excel" onClick={exportLog}><FileSpreadsheet size={14} />Exportar</button>
      </div>
      <div className="tl">
        {EVENTOS.map((grp) => {
          const items = grp.items.filter((e) => f === "Todos" || e.type === f);
          if (!items.length) return null;
          return (
            <div key={grp.g}>
              <div className="tlg">{grp.g}</div>
              {items.map((e, i) => (
                <div className={`tli ${i === items.length - 1 ? "last" : ""}`} key={i}>
                  <div className="tlrail"><div className={`tlnode ${e.red ? "red" : ""}`} /></div>
                  <div className="tlbody">
                    <div className="tltop">
                      <div className="tltxt"><b>{e.who}</b> {e.act} {e.obj}</div>
                      <div className="tltime mono">{e.t}</div>
                    </div>
                    <span className="tltag">{e.type}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return <button className={`sw ${on ? "on" : ""}`} onClick={onClick} aria-label="toggle" />;
}

function Configuracion({ notify, permissions, setPermissions }) {
  const [tab, setTab] = useState("perfil");
  const [name, setName] = useState("Camila Restrepo");
  const [role, setRole] = useState("Líder de RRHH");
  const [email, setEmail] = useState("camila.restrepo@whitebox.com");
  const [notifs, setNotifs] = useState({ firmas: true, tickets: true, menciones: false, resumen: true });
  const [sec, setSec] = useState({ twofa: true });
  const [company, setCompany] = useState("Whitebox");
  const [industry, setIndustry] = useState("Tecnología");
  const [empRoles, setEmpRoles] = useState(EMPLEADOS);

  const TABS = [
    { id: "perfil", label: "Perfil", ico: Users },
    { id: "notificaciones", label: "Notificaciones", ico: Bell },
    { id: "seguridad", label: "Seguridad", ico: Lock },
    { id: "empresa", label: "Empresa", ico: Building2 },
    { id: "roles", label: "Roles y permisos", ico: Shield },
  ];
  const save = () => notify("Cambios guardados", "ok");
  const toggleNotif = (k) => setNotifs((n) => ({ ...n, [k]: !n[k] }));
  const togglePerm = (r, section) => setPermissions((p) => ({ ...p, [r]: { ...p[r], [section]: !p[r][section] } }));
  const cycleEmpRole = (id) => setEmpRoles((es) => es.map((e) => e.id === id ? { ...e, perm: ROLES[(ROLES.indexOf(e.perm) + 1) % ROLES.length] } : e));

  return (
    <div className="g2 settingsgrid">
      <div className="card cpad" style={{ height: "fit-content", padding: 10 }}>
        {TABS.map((t) => (
          <button key={t.id} className={`nitem ${tab === t.id ? "on" : ""}`} style={{ marginBottom: 2 }} onClick={() => setTab(t.id)}>
            <t.ico size={17} />{t.label}
          </button>
        ))}
      </div>

      <div className="card cpad">
        {tab === "perfil" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 6 }}>
              <Avatar name={name} size={56} />
              <div>
                <button className="btn" onClick={() => notify("Selector de foto próximamente", "info")}><Upload size={14} />Cambiar foto</button>
                <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 6 }}>PNG o JPG · máx. 4 MB</div>
              </div>
            </div>
            <div className="flabel" style={{ marginTop: 18 }}>Nombre completo</div>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flabel">Cargo</div>
            <input className="field" value={role} onChange={(e) => setRole(e.target.value)} />
            <div className="flabel">Correo electrónico</div>
            <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn dark" style={{ marginTop: 18 }} onClick={save}><Check size={15} />Guardar cambios</button>
          </>
        )}

        {tab === "notificaciones" && (
          <>
            <div className="ctitle" style={{ marginBottom: 4 }}>Notificarme cuando…</div>
            <div className="acc"><span className="acico"><PenLine size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Firmas pendientes</div><div className="acs">Recordatorios de documentos por firmar</div></div>
              <Toggle on={notifs.firmas} onClick={() => toggleNotif("firmas")} /></div>
            <div className="acc"><span className="acico"><Ticket size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Tickets asignados</div><div className="acs">Cuando un ticket se asigna a tu equipo</div></div>
              <Toggle on={notifs.tickets} onClick={() => toggleNotif("tickets")} /></div>
            <div className="acc"><span className="acico"><Sparkles size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Menciones en IA</div><div className="acs">Cuando el asistente te incluye en un resumen</div></div>
              <Toggle on={notifs.menciones} onClick={() => toggleNotif("menciones")} /></div>
            <div className="acc"><span className="acico"><Mail size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Resumen semanal por correo</div><div className="acs">Cada lunes a las 8:00 a. m.</div></div>
              <Toggle on={notifs.resumen} onClick={() => toggleNotif("resumen")} /></div>
            <button className="btn dark" style={{ marginTop: 18 }} onClick={save}><Check size={15} />Guardar cambios</button>
          </>
        )}

        {tab === "seguridad" && (
          <>
            <div className="flabel" style={{ marginTop: 0 }}>Contraseña actual</div>
            <input className="field" type="password" placeholder="••••••••" />
            <div className="flabel">Nueva contraseña</div>
            <input className="field" type="password" placeholder="••••••••" />
            <div className="acc" style={{ marginTop: 10 }}><span className="acico"><Lock size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Verificación en dos pasos</div><div className="acs">Código adicional al iniciar sesión</div></div>
              <Toggle on={sec.twofa} onClick={() => setSec((s) => ({ ...s, twofa: !s.twofa }))} /></div>
            <button className="btn dark" style={{ marginTop: 18 }} onClick={save}><Check size={15} />Actualizar contraseña</button>
            <button className="btn" style={{ marginTop: 10, color: "var(--redd)" }} onClick={() => notify("Sesión cerrada en todos los dispositivos", "ok")}><LogOut size={15} />Cerrar sesión en todos los dispositivos</button>
          </>
        )}

        {tab === "empresa" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
              <div className="mark" style={{ width: 48, height: 48 }}>
                <img src="data:image/png;base64,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" alt="Whitebox" />
              </div>
              <div>
                <button className="btn" onClick={() => notify("Selector de logo próximamente", "info")}><Upload size={14} />Cambiar logo</button>
                <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 6 }}>PNG con fondo transparente</div>
              </div>
            </div>
            <div className="flabel" style={{ marginTop: 18 }}>Nombre de la empresa</div>
            <input className="field" value={company} onChange={(e) => setCompany(e.target.value)} />
            <div className="flabel">Industria</div>
            <input className="field" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            <div className="acc" style={{ marginTop: 6 }}><span className="acico"><Globe size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Idioma y región</div><div className="acs">Español (Colombia) · COP</div></div>
              <ChevronRight size={16} color="#c4c4cc" /></div>
            <button className="btn dark" style={{ marginTop: 12 }} onClick={save}><Check size={15} />Guardar cambios</button>
          </>
        )}

        {tab === "roles" && (
          <>
            <div className="ctitle" style={{ marginBottom: 4 }}>Qué puede ver cada rol</div>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl permtbl">
                <thead>
                  <tr>
                    <th>Sección</th>
                    {ROLES.map((r) => <th key={r} style={{ textAlign: "center" }}>{r}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(PERM_LABELS).map((sec) => (
                    <tr className="trow" key={sec}>
                      <td className="cename" style={{ fontSize: 13 }}>{PERM_LABELS[sec]}</td>
                      {ROLES.map((r) => (
                        <td key={r} style={{ textAlign: "center" }}>
                          <button className={`permchk ${permissions[r][sec] ? "on" : ""}`} onClick={() => togglePerm(r, sec)}
                            disabled={r === "Administrador"}>
                            {permissions[r][sec] && <Check size={13} />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ctitle" style={{ marginTop: 24, marginBottom: 4 }}>Rol por persona</div>
            {empRoles.map((e) => (
              <div className="elrow" key={e.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={e.name} size={28} />
                  <div><div className="eltxt">{e.name}</div><div className="elsub">{e.role}</div></div>
                </div>
                <button className="prole" onClick={() => cycleEmpRole(e.id)}>{e.perm} <ChevronDown size={13} /></button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI assistant (real Claude API)                                     */
/* ------------------------------------------------------------------ */
const AI_SYSTEM = `Eres el asistente de IA de "Whitebox", una plataforma de recursos humanos. Responde SIEMPRE en español, de forma breve, clara y profesional (máx. ~5 líneas salvo que pidan más). Usa los siguientes datos del sistema para responder:
- Empleados: 142 activos. Departamentos: Producto, Ingeniería, Personas, Finanzas, Marketing.
- Firmas pendientes (3): Contrato laboral de Sebastián Cano (2 días), Política de seguridad de Juan Pérez (8 días), Anexo de teletrabajo de María González (VENCIDO, 18 días).
- Cumplimiento documental: 94%. 3 contratos vencen este mes (antes del 30 jun 2026).
- Inventario: 234 activos (188 asignados, 34 disponibles, 12 en mantenimiento). 2 equipos sin asignar: iPhone 15 y Dell Latitude. Pedidos de compra: 2 solicitados, 1 aprobado, 1 ya facturado.
- Consultoría: asesoría laboral activa, 12 consultas este mes, respuesta en 24 h hábiles.
- Tickets de soporte: 12 en total (4 abiertos, 3 en proceso, 5 resueltos), distribuidos por áreas TI, Nómina, Personas, Finanzas y Legal. Abiertos destacados: TK-1287 "Certificado laboral" (Personas), TK-1284 "Ajuste de liquidación de nómina" (Nómina, prioridad alta) y TK-1281 "Revisión de contrato de proveedor" (Legal). Tiempo medio de primera respuesta: 5.2 h.
- Reclutamiento: 4 vacantes (3 abiertas, 1 cerrada), 6 candidatos en pipeline (1 en oferta, 1 ya contratado). Tiempo promedio de contratación: 23 días.
- Rotación: tasa anual ~16.7%, 3 renuncias voluntarias y 1 despido en los últimos 4 meses. Marketing es el área con mayor rotación (14.5%).
- Asistencia: 2 ausencias activas (1 incapacidad de Andrés Mora hasta el 23 jun), 142 horas extra acumuladas este mes, 88 días de vacaciones pendientes en total del equipo.
- Nómina: costo mensual total ~$184M COP, ~$23M COP promedio por persona, variación +3.8% vs. mes anterior. Beneficios: medicina prepagada, auxilio de conectividad, bonos de bienestar.
- Desempeño: 3 de 5 evaluaciones Q2 completadas (promedio 3.97/5). Valentina Ruiz tiene desempeño bajo (3.2). Daniel Ospina y Sebastián Cano tienen evaluación pendiente.
- Capacitación: 35 inscripciones en 4 cursos, progreso promedio ~68%. 3 certificaciones obtenidas recientemente.
- Clima laboral: eNPS actual 49 (subiendo, +3 vs. mes anterior). Participación promedio en encuestas: 75%.
Si te piden redactar mensajes o recordatorios, hazlo directo y conciso. Si la pregunta no se relaciona con estos datos, responde de forma útil y general sobre RRHH.`;

const SUGGEST = [
  "¿Qué documentos están pendientes de firma?",
  "¿Qué tickets hay abiertos por área?",
  "Resume el estado del inventario",
  "¿Qué riesgos de cumplimiento hay este mes?",
  "Redacta un recordatorio de firma para los pendientes",
];

function AsistenteIA({ notify }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const autoResize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  };

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...msgs, { role: "user", content }];
    setMsgs(next); setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: AI_SYSTEM,
          messages: next.map(m => ({ role: m.role === "bot" ? "assistant" : "user", content: m.content })) }),
      });
      const data = await res.json();
      const reply = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      setMsgs(m => [...m, { role: "bot", content: reply || "Sin respuesta." }]);
    } catch {
      setMsgs(m => [...m, { role: "bot", content: "Error de conexión." }]);
    } finally { setLoading(false); }
  }

  const PILLS = [
    "Firmas pendientes",
    "Estado del inventario",
    "Riesgos este mes",
    "Tickets abiertos",
  ];

  return (
    <div className="ia-page">
      <div className="ia-msgs">
        <div className="ia-inner">
          {msgs.length === 0 && !loading ? (
            <div className="ia-welcome">
              <div className="ia-orb" />
              <div className="ia-title">¿En qué te ayudo?</div>
              <div className="ia-pills">
                {PILLS.map(p => (
                  <button key={p} className="ia-pill" onClick={() => send(p)}>{p}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {msgs.map((m, i) => (
                <div className={`ia-row ${m.role === "user" ? "me" : "ai"}`} key={i}>
                  {m.role === "bot" && <div className="ia-ava" />}
                  <div className="ia-bub">{m.content}</div>
                </div>
              ))}
              {loading && (
                <div className="ia-row ai">
                  <div className="ia-ava" />
                  <div className="ia-bub"><div className="typing"><i /><i /><i /></div></div>
                </div>
              )}
              <div ref={endRef} style={{ height: 4 }} />
            </>
          )}
        </div>
      </div>
      <div className="ia-composer">
        <div className="ia-box">
          <textarea ref={taRef} rows={1} className="ia-text"
            placeholder="Escribe un mensaje…" value={input}
            onChange={e => { setInput(e.target.value); autoResize(); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <div className="ia-foot">
            <button className="ia-attach" data-tip="Adjuntar" onClick={() => notify("Adjuntar próximamente", "info")}>
              <Plus size={18} />
            </button>
            <div className="ia-foot-space" />
            <button className="ia-go" disabled={!input.trim() || loading} onClick={() => send()}>
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App shell                                                          */
/* ------------------------------------------------------------------ */
const PERIODS = ["Jun 2026", "May 2026", "Abr 2026", "Q2 2026", "Q1 2026", "Todo 2026"];
const NOTIFS = [
  { ico: ShieldAlert, tone: "red", title: "Riesgo de alto impacto", sub: "Se detectó un riesgo contractual en Proyecto Torres · hace 10m" },
  { ico: PenLine, tone: "amb", title: "Firma pendiente", sub: "Contrato de obra TRR-04 vence en 2 días · Sebastián Cano" },
  { ico: FileText, tone: "blu", title: "Documento actualizado", sub: "Especificaciones técnicas v2.1 cargadas por Andrés Mora · hace 1h" },
  { ico: Ticket, tone: "grn", title: "Ticket resuelto", sub: "Solicitud de equipos #TI-038 marcada como completada · hace 3h" },
];
const NAV = [
  { id: "dashboard", label: "Dashboard", ico: LayoutDashboard, group: null },
  { id: "empleados", label: "Empleados", ico: Users, group: "Personas" },
  { id: "asistencia", label: "Asistencia", ico: Clock, group: "Personas" },
  { id: "nomina", label: "Nómina", ico: Wallet, group: "Personas" },
  { id: "capacitacion", label: "Capacitación", ico: GraduationCap, group: "Personas" },
  { id: "firmas", label: "Firmas", ico: PenLine, badge: { n: 3, c: "a" }, group: "Operación" },
  { id: "inventario", label: "Inventario", ico: Package, group: "Operación" },
  { id: "documentos", label: "Documentos", ico: FileText, group: "Operación" },
  { id: "consultoria", label: "Consultoría", ico: MessageSquare, group: "Operación" },
  { id: "tickets", label: "Tickets", ico: Ticket, badge: { n: TICKETS.filter((t) => t.st === "Abierto").length, c: "a" }, group: "Operación" },
  { id: "calendario", label: "Calendario", ico: Calendar, group: "Operación" },
  { id: "riesgos", label: "Centro de Riesgos", ico: ShieldAlert, group: "Personas", badge: { n: RIESGOS_SEED.filter(r => r.sev === "Alta").length, c: "r" } },
  { id: "trazabilidad", label: "Trazabilidad", ico: Activity, group: "Operación" },
  { id: "ia", label: "Asistente IA", ico: Sparkles, group: "Operación" },
];

const META = {
  dashboard: ["Dashboard", "Resumen general de personas, documentos y actividad."],
  empleados: ["Empleados", "Directorio y gestión del equipo."],
  asistencia: ["Asistencia", "Ausencias, incapacidades, horas extra y vacaciones."],
  nomina: ["Nómina", "Costo de nómina, beneficios y evolución salarial."],
  capacitacion: ["Capacitación", "Cursos, horas de formación y certificaciones."],
  firmas: ["Firmas", "Sube documentos y solicita firmas electrónicas."],
  inventario: ["Inventario", "Activos, pedidos de compra y facturación."],
  documentos: ["Documentos", "Repositorio documental con análisis por IA."],
  consultoria: ["Consultoría", "Asesoría laboral y de cumplimiento."],
  tickets: ["Tickets", "Solicitudes de soporte por área: TI, Nómina, Personas, Finanzas y Legal."],
  calendario: ["Calendario", "Entrevistas, onboarding, 1:1s y sesiones de consultoría."],
  riesgos: ["Centro de Riesgos", "Identificación y gestión de riesgos de personas, equipos y áreas."],
  trazabilidad: ["Trazabilidad", "Registro de auditoría de toda la actividad."],
  ia: ["Asistente IA", "Chat inteligente con acceso a los datos de Whitebox."],
  configuracion: ["Configuración", "Preferencias de tu cuenta y de la organización."],
};

function Toasts({ list, dismiss }) {
  const ICO = { ok: Check, err: AlertCircle, info: Info, warn: AlertCircle };
  return (
    <div className="toasts">
      {list.map((t) => {
        const I = ICO[t.kind] || Info;
        return (
          <div className={`toast ${t.leaving ? "out" : ""}`} key={t.id}>
            <span className={`tci ${t.kind}`}><I size={13} /></span>
            <span className="tmsg">{t.msg}</span>
            {t.actionLabel && <button className="tact" onClick={() => { t.onAction && t.onAction(); dismiss(t.id); }}>{t.actionLabel}</button>}
          </div>
        );
      })}
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("camila.restrepo@whitebox.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  const submit = () => {
    if (!email.trim() || !password.trim()) { setErr(true); return; }
    setErr(false);
    setLoading(true);
    setTimeout(() => onLogin(), 650);
  };

  return (
    <div className="loginwrap">
      <div className="loginbox">
        <div className="loginlogo">
          <div className="mark" style={{ width: 44, height: 44 }}>
            <img src="data:image/png;base64,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" alt="Whitebox" />
          </div>
        </div>
        <div className="logintitle">Bienvenido a Whitebox</div>
        <div className="loginsub">Inicia sesión para continuar</div>

        <div className="flabel" style={{ marginTop: 22 }}>Correo electrónico</div>
        <input className="field" type="email" value={email}
          onChange={(e) => { setEmail(e.target.value); setErr(false); }}
          placeholder="tucorreo@empresa.com" />
        <div className="flabel">Contraseña</div>
        <input className="field" type="password" value={password}
          onChange={(e) => { setPassword(e.target.value); setErr(false); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="••••••••" />
        {err && <div className="errline"><AlertCircle size={14} />Ingresa tu correo y contraseña.</div>}

        <div className="loginrow">
          <label className="remember" style={{ cursor:"pointer", userSelect:"none" }}>
                  <span className="chk-box" style={{ width:18,height:18,borderRadius:5,background:"#eeeef1",display:"inline-grid",placeItems:"center",flexShrink:0,transition:".12s" }}>
                    <svg width="11" height="8" viewBox="0 0 11 8" fill="none"><path d="M1 4L4 7L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  Recordarme</label>
          <button className="loginlink" onClick={() => setErr(false)}>¿Olvidaste tu contraseña?</button>
        </div>

        <button className="btn dark" style={{ width: "100%", justifyContent: "center" }} onClick={submit} disabled={loading}>
          {loading ? "Verificando…" : "Iniciar sesión"}
        </button>
        <div className="loginfoot">¿No tienes cuenta? <span className="loginlink" style={{ cursor: "default" }}>Solicita acceso</span></div>
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [active, setActive] = useState("dashboard");
  const [aiOpen, setAiOpen] = useState(false);
  const [sbOpen, setSbOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [period, setPeriod] = useState("Jun 2026");
  const [permissions, setPermissions] = useState(PERMS_DEFAULT);
  const [meetings, setMeetings] = useState(MEETINGS);
  const [firmasState, setFirmasState] = useState(FIRMAS);
  const [viewAsRole, setViewAsRole] = useState("Administrador");
  const [gq, setGq] = useState("");
  const [gqOpen, setGqOpen] = useState(false);
  const searchRef = useRef(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") { setGqOpen(false); searchRef.current?.blur(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (permissions[viewAsRole] && !permissions[viewAsRole][active]) {
      setActive("dashboard");
    }
  }, [viewAsRole]);

  const gqLower = gq.trim().toLowerCase();
  const gResults = gqLower ? {
    empleados: EMPLEADOS.filter((e) => (e.name + e.role + e.dept).toLowerCase().includes(gqLower)).slice(0, 3),
    documentos: DOCS.filter((d) => (d.name + d.type).toLowerCase().includes(gqLower)).slice(0, 3),
    tickets: TICKETS.filter((t) => (t.asunto + t.id).toLowerCase().includes(gqLower)).slice(0, 3),
  } : null;
  const gHasResults = gResults && (gResults.empleados.length || gResults.documentos.length || gResults.tickets.length);

  const dismiss = (id) => {
    setToasts((x) => x.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), 220);
  };
  const notify = (msg, kind = "ok", actionLabel, onAction) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, msg, kind, actionLabel, onAction }]);
    setTimeout(() => dismiss(id), 4000);
  };
  const go = (id) => { setActive(id); setSbOpen(false); };
  const [title, sub] = META[active];
  const navIco = NAV.find((n) => n.id === active)?.ico || (active === "configuracion" ? Settings : LayoutDashboard);
  const NavIco = navIco;

  const View = {
    dashboard: <Dashboard go={go} openAI={() => go("ia")} notify={notify} />,
    empleados: <Empleados notify={notify} firmasState={firmasState} />,
    asistencia: <Asistencia notify={notify} />,
    nomina: <Nomina notify={notify} />,
    capacitacion: <Capacitacion notify={notify} />,
    firmas: <Firmas notify={notify} firmasState={firmasState} setFirmasState={setFirmasState} />,
    inventario: <Inventario notify={notify} />,
    documentos: <Documentos notify={notify} />,
    consultoria: <Consultoria notify={notify} consultaMeetings={meetings.filter(m => m.type === "Consultoría")} onSchedule={() => {
      const day = Math.min(30, Math.max(...meetings.map((m) => m.day), 21) + 1);
      setMeetings((m) => [...m, { id: `M-${m.length + 1}`, title: "Sesión de consultoría laboral", type: "Consultoría", day, time: "11:00", dur: "1 h", with: "Asesor externo", loc: "Virtual · Meet" }]);
      notify("Consultoría agendada — revisa el Calendario", "ok");
    }} />,
    tickets: <Tickets notify={notify} />,
    riesgos: <CentroRiesgos notify={notify} />,
    trazabilidad: <Trazabilidad notify={notify} />,
    ia: <AsistenteIA notify={notify} />,
    calendario: <Calendario notify={notify} meetings={meetings} setMeetings={setMeetings} />,
    configuracion: <Configuracion notify={notify} permissions={permissions} setPermissions={setPermissions} />,
  }[active];

  if (!loggedIn) {
    return (
      <div className="nrh">
        <style>{STYLES}</style>
        <Login onLogin={() => setLoggedIn(true)} />
      </div>
    );
  }

  return (
    <div className="nrh">
      <style>{STYLES}</style>

      {sbOpen && <div className="ovl" style={{ zIndex: 55 }} onClick={() => setSbOpen(false)} />}
      <aside className={`sb ${sbOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="mark">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAIAAAAErfB6AAAL7UlEQVR42u2dW2xc1RVA997n3GuPPX5kPDao4afiUZGQQChEIMEPbcVHQyHBMVVBKhglpRUtFSU4JCXhsz+UNsExCQ6UkKp88YPEI0ACpLRqKypKSQFVESTk0cT2xImfc885e/djxokD1A+Y1OPxXrqy5Id879x19nnvexFoHiiVC+ktUMGKClZUsKKCFRWsqGBFBatgRQUrKlhRwYoKVlSwooJVsKKCFRWsqGBFBSsqWFHBigpWwYoKVlSwooIVFayoYEUFq2BFBSsqWFHBigpWVLCiglWwooIVFayoYEUFKypYUcFKEVvpH9Cc/S0DyIR/zwAAgGPfogouc9z0HEnhr6UC1M4FwfLZeBUzgTkELPxWioEuFWC6kgUjkqGYAwOCsEyh1hUkBhBDBEAsLCyiEVy+ggG9O0FUbYgYGAABAqAUoxrH4vP0VwAhRDDejQDExlYJBpjliitPsAAgAhprfJL78U9W33HH7cKhWAEDTyyYhayJPv740IMPrjtypAfJigouu7hlimKbJMfaVt6+pfOxfH5k6o5Q0IXk2muu/eST/evXPWRtCzOr4LKyi8ZSkvQtWXL15scfPdnf77xDRMSp9ZUEfXBV1cMN9Q2V0ZGutAi21gYebG7O7NjRXVdXPTg4EEVmOrUsIqExhpm/oBM+C6momSwiNIYR3NatT1x66SWDA9O1O9aIV9I9qZCaGRAADGE+3/PIxo3Lly/L9fVZG0ll2ZqDVbQAIIghQhtRMvqftta2dese6O3ttREC+OmWYEFGYBKumGCujAgWMpiMnvjmVdd0btk8NDRIlTLROOcFY8GusB/MZhufemprOl2dJKNoztTbKnh2+yWDBB4gv3Xr4wsXXDgwcNJYgjNzGSp4drfAYoi8P7nh4UdWLF92InfMRgQQ1Ovs7WTJ+N5PbGqS/LHWW7+/fv39uVyvMdVqtHJ60cbYJOlfsnhpV9evh4b7CxV2pQ1j514VjSAEYoliDkkmk/7dji216di5PJJuP6oMwUBExhCD5J/Y2nnZoouHhgaMMeqyIgQLAiARuaTvoQ0dra3f6+vLRVFcXPBDrZ9ndxuMAGSt9e5oa9ttj2zo6O3tsSZihs9trlNmZwTbKPKu94olV3Z1/mbk1LAlo2PdyhGMiBKGMk1NTz3dnU7XJkky1VVeFVz2asEQGQLmwSe6Hl+86NKBgZPWWhEVXBmCAaMo9m5g44YNK1cuy/Uds5Zk3IyHMrsFG2NGR463tv5g/fo1ub4eaw2AyLlcTcDivz59gtm6u2MW9KINkUv6L7/8is4tvxoeHhBABAIAhNJvhzOCIiiAzIJoUPDMDnhkEAKJJiwXZVcOyjyC0SABj86b1/j009vq66rzSULneMYKEZilvqFeREQEhEAIwICY2bg2U9ZXjABEwjK69YmuxYsXnDp1wtpzPt4lsiMjQ9dec3Vd3TyRPJFBNIX5URAC5ImO8qvGDWCqbAVHhpzLPfzwxnvvXdXXdyyO4v9DkULExPv5F3zNu9E9e3aRqYriiECIiAincBARiQqeDDEm9q53xYpbN29+tL+/15JBIDnHk5FYSIwgHM2PXHf9tc6bv/7lz0n+BPPw2DEy4THKPMo8AkJAthxy1xBoXjlVygKCIBTHNsn3L1q04PXXX4jjKARHSHAm7eQcRnCxxywCKPV1mXf+/u6e3XuOH+9BpEm3AYkgIjqXPP/8C4cPH7emxkuigj9zk5DIoIw2NKRe2fXiZZddODg4aIydkeYt+FBbW1ddVQWIU9kGhEjMnkzqzTffWrasbWSYA3gdJo23S4iI6EIY2tLVvWTJwlyux1orIjMyKWmMHR4eHhoammIKGiIIeDK0YOE3mpubP/74ANpoXObqnBeMCNWxHRnt3bBhY1vbzb09x21kCz8vcUESEBGiyf/v2aOyyVckRQxZzA8nzA5g5hPXymmYJBJZOzJ6bPny1l8+3JHryxl7TspfCIEI4tgyh+knD8qEBwAQiEEwCGUxbi4HwQhgEMlEUZLkFi28vKtr0/DQIKBQCSJXzu48BWZubGjyDnt7TqVqGlKp2sA84XnG+Zv0coQAaKwnhhrBACAgiEDWxsJJU7bxmWeebKivc0lCJFKCG1TolhfMBOaQrq3v7Nx+3fXfWbr0hptvbnv3vQ9SNWkf/Bd34lDOOorDnv95CAKAoAiCCHoAwZle7yqDNhhFIIB4CSNdW7qvuGJxb19vFFkpzfZmLA69gLyT5pb5jz3aef8DPwdIIdjXXn153/sfvLV3V8t5DT7JI5rKe3DYTH8eBACOI3RJbt36jpWtN/f29djISPGRGliSEyCCdz6TaX7l5Tc61q6LbCaK6oDiqurzjx498NLLr6TTtYE9VCIzXmDZWpPke2+5pXXjhjW53DFjS950iWeXSqX27z/Q3n53CABgnAsiEkJApJ7jPcXmU4wKLvXpyfjk5MIFS57ctjk/MgjIiFJywYaIWe5uX33k6EFrawKHQotZGC+NDYQIwFReOtNMtsGICOyy2czTz3TW1VcPnBo2tqq0dhGM99yUza5e9dM//mlvFGcT74sN89iDdUCI2AKAYMCK2yIykxFsiDgMLl/RevVVV/Wf7DfGlvj2IjqXZJtbNm3a0r39yaq42Qf+ghiV8eMoraJLO3EFUFtb64MjKn1akXc+09S0a9frHR0PWVsf+PR4aQ4xk1W0SHH2xxhT8gfKMXNtbe3+/Z+2t9+TOEKMmMMcTH2o2IQta4z3vr39nsOHD0W2jlnKc8fFHJjoKPGsCSGyC6Eh07x69c/efntPVNXinBs3D3X2GBnOzHShRnC52wUkgrxz2WzLpt9u2759m42yzjmZbClXNIJnCZw4l8k0v/rqW2vXrrO2MczyJ01qBJ8VwD746pqagweP3nXX6nzCIFWTLdQjACaJU8GzABG21jLDnXeuOnz4kDX1nqe0XPHppwentBSoVfQMtbvFIA2BGxqz99xz/969e+K4JXFuKmUCIPrne/tOnRqyFGkEl2GfuZCjJIlLss0tmzdt735yexQ3u+DGdqJPPFYOhmo++ODDf+37dyqVZg4quAwlU+JDJtP86q431q590NpamcabFtCYaueGfr/zuepUSgWXX7tL6EOoqUkfPHCsvf1H+bwwmBCm2nMWAB8EqfHZnc+++4/3a9N1IYQKGw/PbsEcAhnDTHe1rzp8+IiN6pn9dAa1wpAgxgMDQ7+4v0MkMsZUWByXg+AvO80gwsKNjfPWrFm7963dUdzEYbqpIgzIzCGKG3fv3nXffQ80NDQaY7z3X3n+Q1Tw6RRrYeYpXwmfPrxPmrItmzq7t23ttlGzD6MMybQ/vhAgO5+YKLu9e9sP71otYBoa54WQeD/K7AQYIIydVCbr9CEAMmIQMVgWnmnGI1cEDcUsIsACQSahsGcdQuCmbMvrr+3tWLMuihpDOLM29eUIIZioaeeOnd/+1nf37H67vj6byZxXXV2DQCJ4+ryTXZ0vvMKnuirly6Omn8ncJCKSMHLJJRe/+NLz55/fJMKIhWzrsQAf90ajcWEvIkJkPvrow5tuajt0qCeK0945QfeViyxaE3l3EgBvvPGG225buXTpleed15JK1SCOXU0h/+3z71wqXiezhKo49Yfnnr+7fRVLasZfnTbDyWeGTPCD8y+Yf9FFXw8ujzTpg3Oo2H0ms2/f+319J9DUSXGhN3zljZjFtwMAOA4nATidzl5wwfymTNNYyu8klQQCI6H38rd33vWOkSzz3BZMRAgYfAIwMoUHneCY4ILFlLEmsDvTmkNpMiEQMSJLREmSsOTHGuBiXT6FVo/IpAGL9fmcFlx4khnClF9cNaYQEZmZxX/+V6XoGBSupvA+rc+8AEIm/URSmGoRLoee9AzPRRcKuMCXTuzG0pf4MxoL8cezerlYn7Fc4ahgFayoYEUFKypYUcGKClZUsApWVLCighUVrKhgRQUrKlgFKypYUcGKClZUsKKCFRWsqGAVrKhgRQUrKlhRwYoKVlSwClZUsKKCFRWsqGBFBSsqWAUrKlhRwYoKVlSwooIVFayoYBWsqGBFBSszy38BZ7SlR1P+oDYAAAAASUVORK5CYII=" alt="Whitebox" />
          </div>
          <div className="bname">Whitebox<div className="bsub">People Operating System</div></div>
        </div>

        <nav className="nav">
          {NAV.filter((n) => n.group === null && permissions[viewAsRole]?.[n.id]).map((n) => (
            <button key={n.id} className={`nitem ${active === n.id ? "on" : ""}`} onClick={() => go(n.id)}>
              <n.ico size={18} />{n.label}
              {n.badge && <span className={`nbadge ${n.badge.c}`}>{n.badge.n}</span>}
            </button>
          ))}
          {["Personas", "Operación"].map((g) => {
            const groupItems = NAV.filter((n) => n.group === g && permissions[viewAsRole]?.[n.id]);
            if (!groupItems.length) return null;
            return (
              <div key={g}>
                <div className="nlabel">{g}</div>
                {groupItems.map((n) => (
                  <button key={n.id} className={`nitem ${active === n.id ? "on" : ""}`} onClick={() => go(n.id)}>
                    <n.ico size={18} />{n.label}
                    {n.badge && <span className={`nbadge ${n.badge.c}`}>{n.badge.n}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sfoot">
          {userMenuOpen && (
            <>
              <div className="popcatch" onClick={() => setUserMenuOpen(false)} />
              <div className="usermenu">
                <button className="umitem" onClick={() => { setUserMenuOpen(false); setNotifOpen(true); }}>
                  <Bell size={16} />Notificaciones
                  {NOTIFS.length > 0 && <span className="umbadge">{NOTIFS.length}</span>}
                </button>
                <button className="umitem" onClick={() => { setUserMenuOpen(false); notify("Enlace de invitación copiado", "ok"); }}>
                  <Plus size={16} />Invitar equipo
                </button>
                <button className="umitem" onClick={() => { setUserMenuOpen(false); go("configuracion"); }}>
                  <Settings size={16} />Configuración
                </button>
                <div className="umdiv" />
                <div className="umlabel"><Eye size={12} />Ver como</div>
                {ROLES.map((r) => (
                  <button key={r} className="umitem" onClick={() => { setViewAsRole(r); setUserMenuOpen(false); notify(`Viendo como: ${r}`, "info"); }}>
                    <span style={{ width: 14, display: "inline-flex" }}>{r === viewAsRole && <Check size={14} style={{ color: "var(--red)" }} />}</span>
                    {r}
                  </button>
                ))}
                <div className="umdiv" />
                <button className="umitem" onClick={() => setUserMenuOpen(false)}>
                  <HelpCircle size={16} />Ayuda y soporte
                </button>
                <button className="umitem" style={{ color: "var(--redd)" }} onClick={() => { setUserMenuOpen(false); setLoggedIn(false); }}>
                  <LogOut size={16} color="var(--redd)" />Cerrar sesión
                </button>
              </div>
            </>
          )}
          <button className="suser" data-tip="Mi cuenta" onClick={() => setUserMenuOpen((v) => !v)}>
            <Avatar name="Camila Restrepo" size={36} />
            <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Camila Restrepo</div>
              <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>Líder de RRHH</div>
            </div>
            <ChevronRight size={16} color="#c4c4cc" style={{ transform: userMenuOpen ? "rotate(90deg)" : "none", transition: ".15s" }} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <button className="ibtn ham" data-tip="Menú" onClick={() => setSbOpen(true)}><Menu size={18} /></button>
          <div className="crumb"><NavIco size={15} />{title}</div>
          <div style={{ flex: 1 }} />
          <div className="notifwrap">
            <div className="search">
              <Search size={15} />
              <input ref={searchRef} placeholder="Buscar…" value={gq}
                onChange={(e) => { setGq(e.target.value); setGqOpen(true); }}
                onFocus={() => setGqOpen(true)} />
              {gq ? (
                <button className="gqclear" onClick={() => { setGq(""); searchRef.current?.focus(); }}><X size={13} /></button>
              ) : <span className="kbd">/</span>}
            </div>
            {gqOpen && gqLower && (
              <>
                <div className="popcatch" onClick={() => setGqOpen(false)} />
                <div className="notifpanel" style={{ width: 320 }}>
                  {gHasResults ? (
                    <div className="notiflist">
                      {gResults.empleados.map((e) => (
                        <div className="notifitem" key={e.id} style={{ cursor: "pointer" }}
                          onClick={() => { go("empleados"); setGqOpen(false); setGq(""); }}>
                          <span className="nico blu"><Users size={15} /></span>
                          <div className="ntxt"><b>{e.name}</b><span>{e.role} · {e.dept}</span></div>
                        </div>
                      ))}
                      {gResults.documentos.map((d) => (
                        <div className="notifitem" key={d.id} style={{ cursor: "pointer" }}
                          onClick={() => { go("documentos"); setGqOpen(false); setGq(""); }}>
                          <span className="nico amb"><FileText size={15} /></span>
                          <div className="ntxt"><b>{d.name}</b><span>{d.type} · {d.id}</span></div>
                        </div>
                      ))}
                      {gResults.tickets.map((t) => (
                        <div className="notifitem" key={t.id} style={{ cursor: "pointer" }}
                          onClick={() => { go("tickets"); setGqOpen(false); setGq(""); }}>
                          <span className="nico red"><Ticket size={15} /></span>
                          <div className="ntxt"><b>{t.asunto}</b><span>{t.id} · {t.area}</span></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dempty" style={{ padding: "16px" }}>Sin resultados para "{gq}".</div>
                  )}
                </div>
              </>
            )}
          </div>
          <button className="btn" style={{ background:"#fff", boxShadow:"0 1px 3px rgba(20,20,26,.08)", gap:7, paddingLeft:12 }}
            data-tip="Iniciar reunión"
            onClick={() => window.open("https://meet.google.com/new", "_blank")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Meet
          </button>
          <div className="notifwrap">
            <button className="nbell" onClick={() => setNotifOpen((v) => !v)}>
              <Bell size={17} />{NOTIFS.length > 0 && <span className="nbadge2">{NOTIFS.length}</span>}
            </button>
            {notifOpen && (
              <>
                <div className="popcatch" onClick={() => setNotifOpen(false)} />
                <div className="notifpanel">
                  <div className="notifhead">
                    <b>Notificaciones</b>
                    <button className="notiflink" onClick={() => setNotifOpen(false)}>Marcar leídas</button>
                  </div>
                  <div className="notiflist">
                    {NOTIFS.map((n, i) => (
                      <div className="notifitem" key={i}>
                        <span className={`nico ${n.tone}`}><n.ico size={15} /></span>
                        <div className="ntxt"><b>{n.title}</b><span>{n.sub}</span></div>
                      </div>
                    ))}
                  </div>
                  <div className="notiffoot">
                    <button onClick={() => { setNotifOpen(false); go("trazabilidad"); }}>Ver toda la actividad</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <main className={`content${active === "ia" ? " content-full" : ""}`}>
          {viewAsRole !== "Administrador" && (
            <div className="previewbar">
              <Eye size={14} />Viendo como <b>{viewAsRole}</b> — algunas secciones están ocultas según sus permisos.
              <button onClick={() => setViewAsRole("Administrador")}>Volver a Administrador</button>
            </div>
          )}
          {active !== "ia" && (
            <div className="phead">
              <div>
                <div className="h1">{title}</div>
                <div className="psub">{sub}</div>
              </div>
              {active === "dashboard" && (
                <div style={{ display: "flex", gap: 10 }}>
                  <div className="notifwrap">
                    <button className="btn" style={{ background:"#fff", boxShadow:"0 1px 3px rgba(20,20,26,.08),0 1px 1px rgba(20,20,26,.04)" }} onClick={() => setPeriodOpen((v) => !v)}><CalendarClock size={15} />{period}<ChevronDown size={13} style={{ marginLeft: 2, color: "var(--ink3)" }} /></button>
                    {periodOpen && (
                      <>
                        <div className="popcatch" onClick={() => setPeriodOpen(false)} />
                        <div className="usermenu" style={{ bottom: "auto", top: "calc(100% + 8px)", left: 0, right: "auto", width: 170 }}>
                          {PERIODS.map((p) => (
                            <button key={p} className="umitem" onClick={() => { setPeriod(p); setPeriodOpen(false); notify(`Periodo: ${p}`, "info"); }}>
                              <span style={{ width: 14, display: "inline-flex" }}>{p === period && <Check size={14} style={{ color: "var(--red)" }} />}</span>
                              {p}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <div key={active} style={active === "ia" ? { height: "100%", display: "flex", flexDirection: "column" } : {}}>{View}</div>
        </main>
      </div>

      <Toasts list={toasts} dismiss={dismiss} />
    </div>
  );
}
