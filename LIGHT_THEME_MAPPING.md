# Light Theme Color Mapping Guide

## Core Transformation Principles

**From Dark → To Light:**
- Dark backgrounds (#0f172a, #1e293b) → Light backgrounds (#ffffff, #f8fafc)
- Light text (#f1f5f9, #cbd5e1) → Dark text (#0f172a, #1e293b)
- Dark borders (#334155) → Light borders (#e2e8f0)
- Dark surfaces → White surfaces
- **Keep**: Vibrant indigo accents (#4f46e5, #6366f1)

## Comprehensive Color Mapping

### Background Colors
| Dark Theme (Old) | Light Theme (New) | Usage |
|------------------|-------------------|-------|
| `bg-slate-900` | `bg-slate-50` | Main app background |
| `bg-slate-800` | `bg-white` | Card surfaces, panels |
| `bg-slate-700` | `bg-slate-100` | Input fields, secondary surfaces |
| `bg-slate-600` | `bg-slate-200` | Hover states, tertiary |
| `bg-slate-500` | `bg-slate-300` | Disabled backgrounds |

### Border Colors
| Dark Theme (Old) | Light Theme (New) | Usage |
|------------------|-------------------|-------|
| `border-slate-700` | `border-slate-200` | Main borders |
| `border-slate-600` | `border-slate-300` | Secondary borders |
| `border-slate-500` | `border-slate-300` | Emphasized borders |

### Text Colors  
| Dark Theme (Old) | Light Theme (New) | Usage |
|------------------|-------------------|-------|
| `text-slate-50` | `text-slate-900` | Primary text (headings) |
| `text-slate-100` | `text-slate-900` | Primary text |
| `text-slate-200` | `text-slate-800` | Secondary text |
| `text-slate-300` | `text-slate-700` | Tertiary text |
| `text-slate-400` | `text-slate-600` | Muted text |
| `text-slate-500` | `text-slate-500` | Very muted text (can stay) |
| `text-slate-600` | `text-slate-400` | Disabled text |

### Hover States
| Dark Theme (Old) | Light Theme (New) | Usage |
|------------------|-------------------|-------|
| `hover:bg-slate-800` | `hover:bg-slate-100` | Hover backgrounds |
| `hover:bg-slate-700` | `hover:bg-slate-200` | Secondary hover |
| `hover:text-slate-200` | `hover:text-slate-900` | Hover text |
| `hover:text-slate-300` | `hover:text-slate-800` | Secondary hover text |
| `hover:border-slate-600` | `hover:border-slate-300` | Hover borders |

### Primary/Accent Colors (UNCHANGED)
| Color | Hex | Usage |
|-------|-----|-------|
| `bg-primary-600` / `bg-indigo-600` | #4f46e5 | Primary buttons |
| `bg-primary-500` / `bg-indigo-500` | #6366f1 | Primary button hover |
| `text-primary-500` / `text-indigo-600` | #4f46e5 | Links, accents |
| `border-primary-500` | #6366f1 | Focus rings |

### Placeholder Text
| Dark Theme (Old) | Light Theme (New) |
|------------------|-------------------|
| `placeholder-slate-400` | `placeholder-slate-400` (stays same) |

### Divide Colors
| Dark Theme (Old) | Light Theme (New) |
|------------------|-------------------|
| `divide-slate-700` | `divide-slate-200` |

## Component-Specific Transformations

### Sidebar
```
FROM (Dark):
- bg-slate-900
- border-slate-700
- text-slate-400
- active: bg-indigo-600/20 text-indigo-300
- hover: hover:bg-slate-800/70

TO (Light):
- bg-white
- border-slate-200
- text-slate-700
- active: bg-indigo-50 text-indigo-700
- hover: hover:bg-slate-100
```

### Cards & Panels
```
FROM (Dark):
- bg-slate-800
- border-slate-700

TO (Light):
- bg-white
- border-slate-200
```

### Tables
```
FROM (Dark):
- bg-slate-800
- border-slate-700
- hover: hover:bg-slate-700/50
- header: bg-slate-900 text-slate-400

TO (Light):
- bg-white
- border-slate-200
- hover: hover:bg-slate-50
- header: bg-slate-50 text-slate-700
```

### Inputs & Forms
```
FROM (Dark):
- bg-slate-700
- border-slate-600
- text-white

TO (Light):
- bg-white
- border-slate-300
- text-slate-900
```

### Modals
```
FROM (Dark):
- backdrop: bg-slate-950/80
- content: bg-slate-800
- border: border-slate-700

TO (Light):
- backdrop: bg-slate-900/40
- content: bg-white
- border: border-slate-200
```

### Buttons
```
FROM (Dark):
- Primary: bg-indigo-600 hover:bg-indigo-500 text-white
- Secondary: bg-slate-700 hover:bg-slate-600 text-slate-100
- Ghost: text-slate-400 hover:text-slate-200 hover:bg-slate-800

TO (Light):
- Primary: bg-indigo-600 hover:bg-indigo-700 text-white (SAME)
- Secondary: bg-slate-100 hover:bg-slate-200 text-slate-900
- Ghost: text-slate-700 hover:text-slate-900 hover:bg-slate-100
```

## Special Cases

### Status Badges (Dark Backgrounds Stay Dark)
Some status badges should keep dark backgrounds for contrast:
- SLA Breach: `bg-red-600 text-white` (stays)
- Critical: `bg-red-600 text-white` (stays)
- But borders lighten: `border-red-900` → `border-red-200`

### Internal Notes
```
FROM (Dark):
- bg-yellow-950/40 border-yellow-900/50

TO (Light):
- bg-yellow-50 border-yellow-200
```

### Message Threads
```
Customer messages:
FROM: bg-slate-700/50 border-slate-600/40
TO: bg-slate-50 border-slate-200

Agent messages:
FROM: bg-indigo-950/30 border-indigo-900/30
TO: bg-indigo-50 border-indigo-200

Internal notes:
FROM: bg-yellow-950/40 border-yellow-900/50
TO: bg-yellow-50 border-yellow-200
```

## Quick Replace Patterns

```bash
# Backgrounds
bg-slate-900 → bg-slate-50
bg-slate-800 → bg-white
bg-slate-700 → bg-slate-100
bg-slate-600 → bg-slate-200

# Borders
border-slate-700 → border-slate-200
border-slate-600 → border-slate-300

# Text
text-slate-50 → text-slate-900
text-slate-100 → text-slate-900
text-slate-200 → text-slate-800
text-slate-300 → text-slate-700
text-slate-400 → text-slate-600

# Hovers
hover:bg-slate-800 → hover:bg-slate-100
hover:bg-slate-700 → hover:bg-slate-200
hover:text-slate-200 → hover:text-slate-900
hover:text-slate-300 → hover:text-slate-800

# Dividers
divide-slate-700 → divide-slate-200
```

## Contrast Guidelines

Light theme must maintain WCAG AAA compliance:
- Primary text (slate-900 on white): **Contrast 16:1** ✓ AAA
- Secondary text (slate-800 on white): **Contrast 12:1** ✓ AAA
- Muted text (slate-600 on white): **Contrast 7:1** ✓ AA
- Primary buttons (white on indigo-600): **Contrast 7.2:1** ✓ AAA
