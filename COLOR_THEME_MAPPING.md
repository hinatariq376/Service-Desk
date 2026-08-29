# Slate & Indigo Theme - Color Mapping Guide

## Color System Transformation

### Background Colors
| Old (Zinc) | New (Slate) | Usage |
|------------|-------------|-------|
| `bg-zinc-950` | `bg-slate-900` | Main app background |
| `bg-zinc-900` | `bg-slate-800` | Card surfaces, panels |
| `bg-zinc-800` | `bg-slate-700` | Input fields, secondary surfaces |
| `bg-zinc-700` | `bg-slate-600` | Hover states |

### Border Colors
| Old (Zinc) | New (Slate) | Usage |
|------------|-------------|-------|
| `border-zinc-800` | `border-slate-700` | Main borders |
| `border-zinc-700` | `border-slate-600` | Secondary borders |
| `border-zinc-600` | `border-slate-500` | Emphasized borders |

### Text Colors
| Old (Zinc) | New (Slate) | Usage |
|------------|-------------|-------|
| `text-zinc-50` | `text-slate-50` | Primary text (high contrast) |
| `text-zinc-100` | `text-slate-100` | Primary text |
| `text-zinc-200` | `text-slate-200` | Secondary text |
| `text-zinc-300` | `text-slate-300` | Tertiary text |
| `text-zinc-400` | `text-slate-400` | Muted text |
| `text-zinc-500` | `text-slate-500` | Very muted text |
| `text-zinc-600` | `text-slate-600` | Disabled text |

### Primary/Accent Colors (Indigo)
| Color | Hex | Usage |
|-------|-----|-------|
| `bg-primary-500` / `bg-indigo-500` | #6366f1 | Primary buttons, links |
| `bg-primary-600` / `bg-indigo-600` | #4f46e5 | Primary button hover |
| `text-primary-500` / `text-indigo-400` | #818cf8 | Links, accents |
| `border-primary-500` | #6366f1 | Focus rings |

### Status/Role Colors
| Status/Role | Background | Text | Border |
|-------------|------------|------|--------|
| ADMIN | `bg-purple-600` | `text-white` | `border-purple-900` |
| SUPPORT_AGENT | `bg-emerald-600` | `text-white` | `border-emerald-900` |
| CUSTOMER | `bg-blue-600` | `text-white` | `border-blue-900` |
| CRITICAL | `bg-red-600` | `text-white` | `border-red-900` |
| HIGH | `bg-orange-600` | `text-white` | `border-orange-900` |
| MEDIUM | `bg-amber-500` | `text-slate-900` | `border-amber-900` |
| LOW | `bg-slate-600` | `text-white` | `border-slate-700` |

### Component-Specific Colors

#### Sidebar
- Background: `bg-slate-900`
- Border: `border-slate-700`
- Active item: `bg-primary-600 text-white`
- Inactive item: `text-slate-400 hover:bg-slate-800`

#### Cards
- Background: `bg-slate-800`
- Border: `border-slate-700`
- Header: `border-b border-slate-700`

#### Tables
- Background: `bg-slate-800`
- Header: `bg-slate-900 text-slate-400`
- Row: `hover:bg-slate-700/50`
- Border: `border-slate-700`

#### Modals
- Overlay: `bg-slate-950/80`
- Content: `bg-slate-800`
- Border: `border-slate-700`

#### Inputs
- Background: `bg-slate-700`
- Border: `border-slate-600`
- Focus: `ring-2 ring-primary-500`
- Text: `text-slate-100`
- Placeholder: `placeholder-slate-400`

#### Buttons
- Primary: `bg-primary-600 hover:bg-primary-500 text-white`
- Secondary: `bg-slate-700 hover:bg-slate-600 text-slate-100`
- Ghost: `text-slate-400 hover:text-slate-200 hover:bg-slate-800`

## Quick Find & Replace Patterns

```bash
# Background colors
zinc-950 → slate-900
zinc-900 → slate-800
zinc-800 → slate-700
zinc-700 → slate-600

# Border colors
border-zinc-800 → border-slate-700
border-zinc-700 → border-slate-600

# Text colors
text-zinc-50 → text-slate-50
text-zinc-100 → text-slate-100
text-zinc-200 → text-slate-200
text-zinc-300 → text-slate-300
text-zinc-400 → text-slate-400
text-zinc-500 → text-slate-500
text-zinc-600 → text-slate-600
```

## Implementation Checklist

- [x] tailwind.config.js - Slate/Indigo color palette
- [x] src/index.css - CSS variables and theme
- [ ] AppLayout.tsx - Sidebar and layout
- [ ] Sidebar.tsx - Navigation
- [ ] TopBar.tsx - Header
- [ ] All Admin pages (UserManagement, AuditLogs, etc.)
- [ ] All Customer pages (DashboardHome, MyTickets, etc.)
- [ ] All Agent pages (TicketDetailPane, TicketListPanel, etc.)
- [ ] Modal components
- [ ] Form components (Login, Register)
- [ ] Status badges
- [ ] Cards and panels
