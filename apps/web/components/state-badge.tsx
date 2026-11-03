"use client";
import type {ReactNode} from 'react';
import {AlertTriangle,CheckCircle2,Clock3,HardDriveDownload,LockKeyhole,RotateCcw,Users,XCircle} from 'lucide-react';
export function StateBadge({kind,children}:{kind:'confirmed'|'pending'|'local'|'warning'|'locked'|'refund'|'recount'|'closed';children:ReactNode}){const Icon=kind==='confirmed'?CheckCircle2:kind==='pending'?Clock3:kind==='local'?HardDriveDownload:kind==='locked'?LockKeyhole:kind==='refund'?RotateCcw:kind==='recount'?Users:kind==='closed'?XCircle:AlertTriangle;return <span className={`status-tag state-badge ${kind==='confirmed'?'good':kind==='warning'||kind==='locked'||kind==='pending'?'warn':kind==='recount'?'info':'neutral'}`}><Icon size={17} aria-hidden="true"/>{children}</span>;}
